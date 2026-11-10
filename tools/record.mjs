// Records the site's own tool page being used, for the "test it" part of a tutorial.
// The page is opened at 1280 x 720, the tool is scrolled into view, and a pointer moves, clicks and types on it
// for the length of that part of the video. Camera and microphone tools get Chrome's built-in test picture and tone.
import fs from 'node:fs';
import path from 'node:path';

const BLOCK = /google-analytics|googletagmanager|doubleclick|adsbygoogle|googlesyndication|facebook\.net|hotjar|clarity\.ms/;

export async function recordPage(url, seconds, dir, run) {
  const { chromium } = await import('playwright');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 },
      permissions: ['camera', 'microphone'], colorScheme: 'dark' });
    await ctx.route('**/*', r => BLOCK.test(r.request().url()) ? r.abort() : r.continue());
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.waitForTimeout(3000));
    await page.addStyleTag({ content: '[class*=cookie i],[id*=cookie i],[class*=consent i],[id*=consent i]{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(1200);
    // the tool: the first big interactive area on the page
    const box = await page.evaluate(() => {
      const sel = 'canvas, video, [class*=tool i], [id*=tool i], [class*=tester i], [class*=test-area i], [class*=pad i], [role=application], main button';
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > 220 && r.height > 120) { el.scrollIntoView({ block: 'center' }); const q = el.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }
      }
      window.scrollBy(0, 360);
      return { x: 200, y: 160, w: 880, h: 400 };
    });
    await page.waitForTimeout(600);
    // Chrome's own screen stream: a frame each time the page changes, with its time, put together afterwards
    const cdp = await ctx.newCDPSession(page);
    const shots = [];
    cdp.on('Page.screencastFrame', f => {
      const file = path.join(dir, `f${String(shots.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      shots.push({ file, t: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
    const began = Date.now() / 1000;
    // a start or allow button, if the tool has one
    const start = page.locator('button:visible', { hasText: /^(start|begin|run|test|play|enable|allow|check)/i }).first();
    if (await start.count().catch(() => 0)) await start.click({ timeout: 2000 }).catch(() => {});
    const cx = box.x + box.w / 2, cy = box.y + Math.min(box.h, 520) / 2, end = Date.now() + seconds * 1000;
    const keys = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'Enter'];
    let n = 0;
    while (Date.now() < end) {
      const a = n * 0.7, x = cx + Math.cos(a) * Math.min(160, box.w / 3), y = cy + Math.sin(a * 1.3) * Math.min(90, box.h / 3);
      await page.mouse.move(x, y, { steps: 12 });
      if (n % 2 === 0) await page.mouse.click(x, y, { delay: 60 }).catch(() => {});
      if (n % 3 === 1) await page.keyboard.press(keys[n % keys.length]).catch(() => {});
      await page.waitForTimeout(450);
      n++;
    }
    await cdp.send('Page.stopScreencast').catch(() => {});
    const stopped = Date.now() / 1000;
    await ctx.close();
    if (!shots.length) throw new Error('the page gave no picture');
    const list = path.join(dir, 'frames.txt');
    const t0 = shots[0].t;
    fs.writeFileSync(list, shots.map((sh, i) => `file '${sh.file}'\nduration ${Math.max(0.033, ((shots[i + 1]?.t ?? (stopped - began + t0)) - sh.t)).toFixed(3)}`).join('\n') + `\nfile '${shots.at(-1).file}'\n`);
    const file = path.join(dir, 'page.mp4');
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', file]);
    return { file, lead: 0 };
  } finally { await browser.close().catch(() => {}); }
}

/** For trying the tutorial out locally: a slideshow of page screenshots instead of a live recording. */
export function slideshow(images, seconds, file, run) {
  const each = seconds / images.length;
  const list = path.join(path.dirname(file), 'slides.txt');
  fs.writeFileSync(list, images.map(i => `file '${i}'\nduration ${each.toFixed(2)}`).join('\n') + `\nfile '${images.at(-1)}'\n`);
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x2A2A2A,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', file]);
  return { file, lead: 0 };
}
