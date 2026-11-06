import { escHtml } from './util.mjs';

/* ---------- colour helpers ---------- */
function hexToRgb(h) {
  h = String(h || '').trim();
  const rgb = h.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
function lum(hex) {
  const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sat = hex => { const [r, g, b] = hexToRgb(hex).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };

/** Turn detected + configured brand info into a usable palette. Config always wins. */
export function resolveBrand(site, detected = {}) {
  const cfg = site.brand || {};
  const det = (detected.colors || []).map(c => { const r = hexToRgb(c); return r ? toHex(r) : null; }).filter(Boolean)
    .filter(c => sat(c) > 0.25 && lum(c) > 0.02 && lum(c) < 0.6);
  let primary = cfg.primary || (detected.theme && hexToRgb(detected.theme) ? toHex(hexToRgb(detected.theme)) : det[0]) || '#1F4E79';
  let accent = cfg.accent || det.find(c => contrast(c, primary) > 1.6 && Math.abs(lum(c) - lum(primary)) > 0.02) || cfg.accent_fallback || mix(primary, '#E0662A', 0.75);
  let dark = cfg.dark || mix(primary, '#000000', 0.62);
  const cleanFont = f => String(f || '').split(',')[0].replace(/["']/g, '').trim();
  const generic = /^(system-ui|-apple-system|sans-serif|serif|ui-sans-serif|ui-serif|Segoe UI|Helvetica|Arial|BlinkMacSystemFont|Roboto)$/i;
  const detHead = cleanFont(detected.headingFont);
  const detBody = cleanFont(detected.bodyFont);
  const heading = cfg.heading_font || (detHead && !generic.test(detHead) ? detHead : 'Fraunces');
  const body = cfg.body_font || (detBody && !generic.test(detBody) ? detBody : 'Inter');
  return {
    primary, accent, dark,
    onPrimary: contrast('#ffffff', primary) >= 3 ? '#ffffff' : '#111111',
    onAccent: contrast('#ffffff', accent) >= 3 ? '#ffffff' : '#111111',
    tint: mix(primary, '#ffffff', 0.86),
    deep: mix(dark, '#000000', 0.25),
    heading, body,
    fontFaces: detected.fontFaces || '',
    wordmark: cfg.wordmark || detected.siteName || site.name,
    logoPng: cfg.use_logo_image === true ? (detected.logoPng || null) : null
  };
}

/* ---------- shared pieces ---------- */
function fontLinks(b) {
  const fam = n => encodeURIComponent(n).replace(/%20/g, '+');
  const names = [...new Set([b.heading, b.body])];
  return names.map(n =>
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam(n)}:wght@400;500;600;700;800&display=block">` +
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam(n)}&display=block">`
  ).join('');
}

function baseCss(b, w, h) {
  return `
  ${b.fontFaces}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:"${b.body}","Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
  .h{font-family:"${b.heading}","Fraunces",Georgia,serif;font-weight:800;letter-spacing:-0.022em;line-height:.98}
  .fit{overflow:hidden}
  .badge{display:inline-block;font-weight:700;text-transform:uppercase;letter-spacing:.14em;font-size:19px;padding:12px 20px;border-radius:999px;background:${b.accent};color:${b.onAccent}}
  .paper{background:#fff;padding:18px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.04),0 28px 70px rgba(0,0,0,.34)}
  .paper img{display:block;width:100%;height:100%;object-fit:contain}
  `;
}

function mark(b, color, size = 30) {
  if (b.logoPng) return `<img src="data:image/png;base64,${b.logoPng}" style="height:${Math.round(size * 1.5)}px;width:auto;display:block" alt="">`;
  return `<div class="h" style="font-size:${size}px;color:${color};letter-spacing:-0.01em;font-weight:700">${escHtml(b.wordmark)}</div>`;
}

const heroSrc = hero => hero ? `data:${hero.mime || 'image/png'};base64,${hero.b64}` : '';

/** Shrinks text in every .fit box until it fits. Runs inside the page before the screenshot. */
export const FIT_SCRIPT = `(() => {
  for (const el of document.querySelectorAll('.fit')) {
    const max = parseFloat(el.dataset.max), min = parseFloat(el.dataset.min || 28);
    const inner = el.firstElementChild;
    let s = max;
    inner.style.fontSize = s + 'px';
    const limit = parseFloat(el.style.maxHeight || el.style.height) || el.clientHeight;
    while (s > min && (inner.offsetHeight > limit + 1 || inner.scrollWidth > el.clientWidth + 1)) {
      s -= 2; inner.style.fontSize = s + 'px';
    }
  }
})()`;

/* ---------- Pinterest templates, 1000 x 1500 ---------- */
function pinBoard(b, c, hero, domain) {
  const landscape = hero && hero.aspect && hero.aspect < 0.9;
  const cardW = landscape ? 860 : 700;
  return `
  <div style="position:absolute;inset:0;background:${b.primary}"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(1100px 700px at -10% -10%, rgba(255,255,255,.16), transparent 60%),radial-gradient(900px 900px at 120% 110%, rgba(0,0,0,.22), transparent 60%)"></div>
  <div style="position:absolute;left:76px;right:76px;top:70px;display:flex;align-items:center;justify-content:space-between">
    ${mark(b, b.onPrimary, 30)}
    ${c.badge ? `<span class="badge">${escHtml(c.badge)}</span>` : ''}
  </div>
  <div style="position:absolute;left:76px;right:76px;top:172px;display:flex;flex-direction:column;gap:26px">
    <div class="fit" data-max="104" data-min="52" style="max-height:${landscape ? 360 : 300}px">
      <div class="h" style="color:${b.onPrimary}">${escHtml(c.headline)}</div>
    </div>
    <div style="font-size:34px;line-height:1.25;color:${b.onPrimary};opacity:.88;font-weight:500">${escHtml(c.subline)}</div>
  </div>
  <div class="paper" style="position:absolute;width:${cardW}px;height:${landscape ? 520 : 820}px;left:${(1000 - cardW) / 2 + 18}px;top:${landscape ? 700 : 618}px;transform:rotate(-2.2deg)">
    <img src="${heroSrc(hero)}" alt="">
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:92px;background:${b.deep};display:flex;align-items:center;justify-content:center">
    <span style="color:#fff;font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-size:22px">${escHtml(domain)}</span>
  </div>`;
}

function pinSplit(b, c, hero, domain) {
  return `
  <div style="position:absolute;left:0;right:0;top:0;height:930px;background:${b.tint}"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:930px;background-image:radial-gradient(${mix(b.primary, '#ffffff', 0.7)} 1.6px, transparent 1.7px);background-size:26px 26px;opacity:.55"></div>
  <div class="paper" style="position:absolute;left:150px;right:150px;top:70px;height:820px;padding:16px">
    <img src="${heroSrc(hero)}" alt="">
  </div>
  <div style="position:absolute;left:0;right:0;top:930px;bottom:0;background:${b.dark}"></div>
  ${c.badge ? `<span class="badge" style="position:absolute;left:76px;top:904px">${escHtml(c.badge)}</span>` : ''}
  <div class="fit" data-max="94" data-min="48" style="position:absolute;left:76px;right:76px;top:978px;height:250px">
    <div class="h" style="color:#fff">${escHtml(c.headline)}</div>
  </div>
  <div style="position:absolute;left:78px;right:76px;top:1240px;height:4px;width:120px;background:${b.accent}"></div>
  <div style="position:absolute;left:78px;right:76px;top:1266px;font-size:32px;line-height:1.25;color:#fff;opacity:.86">${escHtml(c.subline)}</div>
  <div style="position:absolute;left:78px;right:76px;bottom:52px;display:flex;align-items:center;justify-content:space-between">
    ${mark(b, '#fff', 26)}
    <span style="color:#fff;opacity:.8;font-weight:600;letter-spacing:.06em;font-size:22px">${escHtml(domain)}</span>
  </div>`;
}

function pinFrame(b, c, hero, domain) {
  return `
  <div style="position:absolute;inset:0;background:${b.deep}"></div>
  <div style="position:absolute;inset:34px;border:2px solid ${mix(b.primary, '#ffffff', 0.35)};border-radius:4px;opacity:.55"></div>
  <div style="position:absolute;left:0;right:0;top:92px;text-align:center">
    <span style="color:${b.accent === b.primary ? '#fff' : mix(b.accent, '#ffffff', 0.25)};font-weight:700;letter-spacing:.24em;text-transform:uppercase;font-size:21px">${escHtml(c.badge || '')}</span>
  </div>
  <div class="fit" data-max="96" data-min="48" style="position:absolute;left:90px;right:90px;top:142px;height:270px;text-align:center">
    <div class="h" style="color:#fff">${escHtml(c.headline)}</div>
  </div>
  <div style="position:absolute;left:90px;right:90px;top:424px;text-align:center;font-size:31px;line-height:1.25;color:#fff;opacity:.82">${escHtml(c.subline)}</div>
  <div style="position:absolute;left:170px;right:170px;top:520px;height:800px">
    <div style="position:absolute;inset:-14px;border:3px solid ${b.accent};border-radius:8px;transform:translate(14px,14px)"></div>
    <div class="paper" style="position:absolute;inset:0;padding:16px"><img src="${heroSrc(hero)}" alt=""></div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:70px;display:flex;flex-direction:column;align-items:center;gap:10px">
    ${mark(b, '#fff', 28)}
    <span style="color:#fff;opacity:.7;font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:19px">${escHtml(domain)}</span>
  </div>`;
}

function pinType(b, c, _hero, domain) {
  const stars = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 197) % 1000, y = (i * 331) % 1500, s = 18 + (i * 7) % 34;
    return `<svg viewBox="0 0 24 24" style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;opacity:.13"><path fill="#fff" d="M12 1l2.6 8.2H23l-6.8 5 2.6 8.3L12 17.4 5.2 22.5l2.6-8.3L1 9.2h8.4z"/></svg>`;
  }).join('');
  return `
  <div style="position:absolute;inset:0;background:${b.primary}"></div>
  ${stars}
  <div style="position:absolute;left:76px;right:76px;top:80px;display:flex;justify-content:space-between;align-items:center">
    ${mark(b, b.onPrimary, 32)}
  </div>
  <div style="position:absolute;left:76px;right:76px;top:0;bottom:110px;display:flex;flex-direction:column;justify-content:center;gap:34px">
    ${c.badge ? `<div><span class="badge">${escHtml(c.badge)}</span></div>` : ''}
    <div class="fit" data-max="140" data-min="64" style="max-height:620px">
      <div class="h" style="color:${b.onPrimary}">${escHtml(c.headline)}</div>
    </div>
    <div style="font-size:38px;line-height:1.25;color:${b.onPrimary};opacity:.9">${escHtml(c.subline)}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:110px;background:${b.deep};display:flex;align-items:center;justify-content:center">
    <span style="color:#fff;font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-size:24px">${escHtml(domain)}</span>
  </div>`;
}

export const PIN_TEMPLATES = { board: pinBoard, split: pinSplit, frame: pinFrame };

/* ---------- Facebook templates, 1200 x 630 ---------- */
function fbSide(b, c, hero, domain) {
  return `
  <div style="position:absolute;inset:0;background:${b.primary}"></div>
  <div style="position:absolute;left:640px;top:0;right:0;bottom:0;background:${b.dark}"></div>
  <div style="position:absolute;left:60px;top:54px">${mark(b, b.onPrimary, 26)}</div>
  <div style="position:absolute;left:60px;width:540px;top:120px;bottom:100px;display:flex;flex-direction:column;justify-content:center;gap:22px">
    <div class="fit" data-max="70" data-min="38" style="max-height:260px">
      <div class="h" style="color:${b.onPrimary}">${escHtml(c.headline)}</div>
    </div>
    <div style="font-size:26px;line-height:1.3;color:${b.onPrimary};opacity:.88">${escHtml(c.subline)}</div>
    ${c.badge ? `<div><span class="badge" style="font-size:15px;padding:10px 16px">${escHtml(c.badge)}</span></div>` : ''}
  </div>
  <div style="position:absolute;left:62px;bottom:52px;color:${b.onPrimary};opacity:.85;font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:17px">${escHtml(domain)}</div>
  <div class="paper" style="position:absolute;left:712px;width:420px;top:36px;height:594px;transform:rotate(2deg);padding:14px"><img src="${heroSrc(hero)}" alt=""></div>
`;
}

function fbType(b, c, _hero, domain) {
  return `
  <div style="position:absolute;inset:0;background:${b.deep}"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:18px;background:${b.accent}"></div>
  <div style="position:absolute;left:80px;top:60px">${mark(b, '#fff', 26)}</div>
  <div style="position:absolute;left:80px;right:80px;top:120px;bottom:100px;display:flex;flex-direction:column;justify-content:center;gap:24px">
    <div class="fit" data-max="84" data-min="44" style="max-height:290px">
      <div class="h" style="color:#fff">${escHtml(c.headline)}</div>
    </div>
    <div style="font-size:28px;color:#fff;opacity:.84">${escHtml(c.subline)}</div>
  </div>
  <div style="position:absolute;left:82px;bottom:48px;color:#fff;opacity:.7;font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:17px">${escHtml(domain)}</div>`;
}

export function buildHtml({ kind, template, brand, copy, hero, domain }) {
  const [w, h] = kind === 'fb' ? [1200, 630] : [1000, 1500];
  let fn;
  if (kind === 'fb') fn = hero ? fbSide : fbType;
  else fn = hero ? (PIN_TEMPLATES[template] || pinBoard) : pinType;
  return `<!doctype html><html><head><meta charset="utf-8">${fontLinks(brand)}<style>${baseCss(brand, w, h)}</style></head>
  <body><div style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${fn(brand, copy, hero, domain)}</div></body></html>`;
}

/** Render to JPEG with a shared browser. */
export async function renderImage(browser, opts) {
  const [w, h] = opts.kind === 'fb' ? [1200, 630] : [1000, 1500];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    await page.setContent(buildHtml(opts), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.evaluate(FIT_SCRIPT);
    return await page.screenshot({ type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: w, height: h } });
  } finally {
    await ctx.close();
  }
}
