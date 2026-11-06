// Renders the videos the private autoposter has planned.
//   node tools/build.mjs --out <dir> [--jobs <file>] [--limit 8] [--only <job id>]
// Jobs come sealed (JOB_KEY) from JOBS_URL or --jobs. Finished videos are sealed with the same key into <out>,
// so this public repository never holds readable site names, scripts or videos.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keyFrom, seal, openJson, sealJson, fileKey } from './seal.mjs';
import { buildScript } from './script.mjs';
import { buildSvml } from './svml.mjs';
import { speakAll } from './voice.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const OUT = path.resolve(opt('out', 'out'));
const WORK = path.resolve(opt('work', path.join(REPO, 'work')));
const LIMIT = Number(opt('limit', process.env.RENDER_LIMIT || 40));
const ONLY = opt('only', '');
const HYPIT = path.resolve(process.env.HYPIT_DIR || path.join(REPO, '.hypit-src'));
const PROJECT = path.join(HYPIT, 'examples', 'autoposter');
const CACHE = path.resolve(process.env.MODEL_CACHE || path.join(REPO, '.cache'));
const AHEAD_MS = 4 * 86400000;
const BUDGET_MS = Number(process.env.RENDER_BUDGET_MIN || 150) * 60000;
const STARTED = Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// error text from the tools can quote script lines; only keep the shape of the problem in these public logs
const redact = s => String(s || '').replace(/"[^"]*"/g, '"…"').replace(/'[^']*'/g, "'…'").replace(/https?:\/\/\S+/g, '<url>').slice(0, 400);

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.status !== 0) {
    const tail = ((r.stdout || '') + '\n' + (r.stderr || '')).split('\n').filter(Boolean).slice(-6).join(' | ');
    throw new Error(`${path.basename(cmd)} failed: ${redact(tail)}`);
  }
  return r.stdout || '';
}

async function loadJobs(key) {
  let text = '';
  const plain = opt('jobs-json', '');
  if (plain) return JSON.parse(fs.readFileSync(plain, 'utf8'));
  const file = opt('jobs', '');
  if (file) text = fs.readFileSync(file, 'utf8');
  else {
    const url = process.env.JOBS_URL;
    if (!url) throw new Error('JOBS_URL is not set');
    for (let i = 1; i <= 4 && !text; i++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'cache-control': 'no-cache' } });
        if (r.status === 404) return { jobs: [] };
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        text = await r.text();
      } catch (e) { log('jobs fetch failed, retrying:', e.message); await new Promise(r => setTimeout(r, 5000 * i)); }
    }
    if (!text) throw new Error('could not read the job list');
  }
  if (!text.trim()) return { jobs: [] };
  return openJson(text, key);
}

/** Phone-sized screenshot of the page for showcase scenes, as a data URI. */
async function pageShot(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1.3, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36', isMobile: true });
    await ctx.route('**/*', r => /google-analytics|googletagmanager|doubleclick|adsbygoogle|googlesyndication|facebook\.net|hotjar|clarity\.ms/.test(r.request().url()) ? r.abort() : r.continue());
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.waitForTimeout(3000));
    await page.addStyleTag({ content: '[class*=cookie i],[id*=cookie i],[class*=consent i],[id*=consent i]{display:none!important}' }).catch(() => {});
    await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'sticky') el.style.setProperty('position', 'static', 'important'); } }).catch(() => {});
    await page.waitForTimeout(600);
    const buf = await page.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: 400, height: 2160 }, fullPage: true });
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  } finally { await browser.close().catch(() => {}); }
}

function hypit(argv, opts = {}) {
  return run(process.execPath, [path.join(HYPIT, 'bin', 'hypit.mjs'), ...argv, '--project', PROJECT], { cwd: HYPIT, ...opts });
}

async function renderOne(job, w) {
  fs.rmSync(w, { recursive: true, force: true });
  fs.mkdirSync(path.join(w, 'assets'), { recursive: true });
  const script = buildScript(job);
  fs.writeFileSync(path.join(w, 'script.json'), JSON.stringify(script));
  await speakAll(script, path.join(w, 'vo'), CACHE);
  run('python3', [path.join(HERE, 'audio.py'), path.join(w, 'script.json'), path.join(w, 'vo'), path.join(w, 'assets')]);
  const timing = JSON.parse(fs.readFileSync(path.join(w, 'assets', 'timing.json'), 'utf8'));
  const images = {};
  for (const [i, b] of job.beats.entries()) if (b.kind === 'showcase') {
    try { images[i] = await pageShot(job.url); } catch (e) { log('screenshot failed:', redact(e.message)); }
  }
  // the project folder is reused for every job; only its source and sound files change
  for (const f of ['voice.wav', 'music.wav', 'sfx.wav']) fs.copyFileSync(path.join(w, 'assets', f), path.join(PROJECT, 'assets', f));
  fs.writeFileSync(path.join(PROJECT, 'video.svml'), buildSvml(job, timing, images));
  hypit(['check', path.join(PROJECT, 'video.svml')]);
  const out = hypit(['build', path.join(PROJECT, 'video.svrun'), '--runtime', path.join(PROJECT, 'hypit.runtime.json'), '--follow'], { timeout: 40 * 60000 });
  const id = [...out.matchAll(/bld_[0-9A-Za-z_]+/g)].map(m => m[0]).pop();
  if (!id) throw new Error('render finished without a build id');
  const raw = path.join(w, 'raw.mp4'), final = path.join(w, 'final.mp4'), thumb = path.join(w, 'thumb.jpg');
  hypit(['get', id, '--output', 'final.video', '--to', raw]);
  run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final]);
  // thumbnail: the cover frame at full size (YouTube and Facebook take it as the video's thumbnail)
  const at = job.cover?.text ? 0.2 : Math.min(Math.max(1, (timing.beats[1]?.start || 3) - 0.4), timing.duration - 0.5);
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', final, '-frames:v', '1', '-q:v', '3', thumb]);
  fs.rmSync(path.join(PROJECT, '.hypit', 'results'), { recursive: true, force: true });
  return { final, thumb, duration: timing.duration };
}

async function main() {
  const key = keyFrom(process.env.JOB_KEY);
  fs.mkdirSync(OUT, { recursive: true });
  const indexFile = path.join(OUT, 'index.bin');
  let index = { items: {} };
  if (fs.existsSync(indexFile)) { try { index = openJson(fs.readFileSync(indexFile, 'utf8'), key); } catch { log('previous index unreadable, starting fresh'); } }
  index.items = index.items || {};
  const { jobs = [] } = await loadJobs(key);
  const now = Date.now();
  const live = new Set(jobs.map(j => j.id));
  let pruned = 0;
  // drop videos that are no longer planned, so this branch only ever holds what is still needed
  for (const [id, it] of Object.entries(index.items)) {
    if (live.has(id)) continue;
    for (const ext of ['v', 't']) if (it.f) fs.rmSync(path.join(OUT, `${it.f}.${ext}`), { force: true });
    delete index.items[id];
    pruned++;
  }
  const todo = jobs.filter(j => (!ONLY || j.id === ONLY) && Date.parse(j.publish_at) > now - 3600000 && Date.parse(j.publish_at) < now + AHEAD_MS)
    .filter(j => { const it = index.items[j.id]; return !it || it.hash !== j.hash || (it.error && (it.n || 0) < 3 && now - (it.at || 0) > 3600000); })
    .sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at)).slice(0, LIMIT);
  log(`jobs ${jobs.length}, to render ${todo.length}`);
  let made = 0;
  for (const job of todo) {
    if (Date.now() - STARTED > BUDGET_MS) { log('time budget reached, the rest wait for the next run'); break; }
    const fk = fileKey(job.id, key);
    const t0 = Date.now();
    try {
      const r = await renderOne(job, path.join(WORK, fk));
      const video = fs.readFileSync(r.final);
      fs.writeFileSync(path.join(OUT, `${fk}.v`), seal(video, key));
      fs.writeFileSync(path.join(OUT, `${fk}.t`), seal(fs.readFileSync(r.thumb), key));
      index.items[job.id] = { hash: job.hash, f: fk, dur: r.duration, bytes: video.length, at: Date.now() };
      made++;
      log(`rendered ${fk} in ${Math.round((Date.now() - t0) / 1000)}s`);
    } catch (e) {
      const prev = index.items[job.id];
      index.items[job.id] = { hash: job.hash, error: redact(e.message), n: (prev?.hash === job.hash ? prev.n || 0 : 0) + 1, at: Date.now() };
      log(`render failed for ${fk}: ${redact(e.message)}`);
    }
    fs.rmSync(path.join(WORK, fk), { recursive: true, force: true });
    fs.writeFileSync(indexFile, sealJson({ ...index, updated: new Date().toISOString() }, key));
  }
  if (made || pruned || todo.length || !fs.existsSync(indexFile)) fs.writeFileSync(indexFile, sealJson({ ...index, updated: new Date().toISOString() }, key));
  log(`done: ${made} new`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${made || todo.length || pruned ? 'true' : 'false'}\n`);
}

main().catch(e => { console.log('stopped:', redact(e.message)); process.exit(1); });
