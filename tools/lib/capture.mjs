import { log } from './util.mjs';

const HIDE_CSS = `
  [id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],
  [class*="newsletter-popup" i],[class*="modal" i][style*="display: block"],
  #onetrust-banner-sdk,.cc-window,.fc-consent-root { display:none !important; }
`;

const BLOCK = /google-analytics|googletagmanager|gtag\/js|doubleclick|googlesyndication|adservice|pagead|facebook\.net|connect\.facebook|hotjar|clarity\.ms|plausible|matomo|segment\.(io|com)|mixpanel|cloudflareinsights|static\.cloudflareinsights|beacon|intercom|crisp\.chat|tawk\.to|youtube\.com\/embed|player\.vimeo/i;

export async function openPage(browser, url) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1700 },
    deviceScaleFactor: 2,
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
  });
  // load only what the page needs to look right: no analytics (keeps your visitor stats clean), ads, video or chat widgets
  await ctx.route('**/*', route => {
    const r = route.request();
    if (['media', 'websocket', 'eventsource', 'manifest'].includes(r.resourceType()) || BLOCK.test(r.url())) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
  await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page };
}

/** Pull colours, fonts, @font-face rules and a logo shot from the home page. */
export async function detectBrand(browser, site) {
  const { ctx, page } = await openPage(browser, (site.origin || `https://${site.domain}`) + "/");
  try {
    const info = await page.evaluate(() => {
      const cs = el => el ? getComputedStyle(el) : null;
      const pick = sel => document.querySelector(sel);
      const h1 = pick('h1'), body = document.body;
      const header = pick('header') || pick('[role=banner]') || pick('nav');
      const btns = [...document.querySelectorAll('a[class*=btn],a[class*=button],button,.button,.btn')].slice(0, 12);
      const links = [...document.querySelectorAll('main a, article a, a')].slice(0, 40);
      const theme = document.querySelector('meta[name=theme-color]')?.content || '';
      const colors = {};
      const add = (c, w) => { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; colors[c] = (colors[c] || 0) + w; };
      btns.forEach(b => { add(cs(b).backgroundColor, 3); });
      links.forEach(a => add(cs(a).color, 1));
      if (header) add(cs(header).backgroundColor, 2);
      if (h1) add(cs(h1).color, 2);
      // @font-face rules we are allowed to read (same-origin sheets)
      const faces = [];
      for (const sheet of [...document.styleSheets]) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        for (const r of [...rules]) {
          if (r.type === 5 || r.constructor?.name === 'CSSFontFaceRule') {
            let t = r.cssText;
            const base = sheet.href || location.href;
            t = t.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => { try { return `url("${new URL(u, base).href}")`; } catch { return m; } });
            faces.push(t);
          }
        }
      }
      const logo = header && (header.querySelector('a[href="/"], a[href$="://' + location.host + '/"], .logo, [class*=logo], [class*=brand]'));
      return {
        theme,
        colors: Object.entries(colors).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 8),
        headingFont: h1 ? cs(h1).fontFamily : '',
        headingWeight: h1 ? cs(h1).fontWeight : '',
        bodyFont: cs(body).fontFamily,
        bodyBg: cs(body).backgroundColor,
        fontFaces: faces.join('\n').slice(0, 20000),
        logoText: logo ? logo.innerText.trim().slice(0, 40) : '',
        hasLogo: !!logo,
        title: document.title,
        siteName: document.querySelector('meta[property="og:site_name"]')?.content || ''
      };
    });
    let logoPng = null;
    if (info.hasLogo) {
      const el = await page.$('header a[href="/"], header .logo, header [class*=logo], header [class*=brand], nav a[href="/"]');
      if (el) {
        const box = await el.boundingBox();
        if (box && box.width > 20 && box.height > 10 && box.width < 700) {
          logoPng = (await el.screenshot({ omitBackground: true })).toString('base64');
        }
      }
    }
    return { ...info, logoPng, detectedAt: new Date().toISOString() };
  } finally {
    await ctx.close();
  }
}

/** Read one page: text for the copywriter and the best visual on it for the pin. */
export async function capturePage(browser, site, url) {
  const { ctx, page } = await openPage(browser, url);
  try {
    const meta = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const m = n => q(`meta[name="${n}"]`)?.content || q(`meta[property="${n}"]`)?.content || '';
      const main = q('main') || q('article') || q('[role=main]') || document.body;
      const crumbs = [...document.querySelectorAll('nav[aria-label*=read i] a, .breadcrumb a, .breadcrumbs a, [class*=crumb] a')].map(a => a.innerText.trim()).filter(Boolean);
      const heads = [...main.querySelectorAll('h2,h3')].map(h => h.innerText.trim()).filter(Boolean).slice(0, 12);
      let text = (main.innerText || '').replace(/\n{2,}/g, '\n').trim();
      return {
        title: document.title,
        h1: q('h1')?.innerText.trim() || '',
        description: m('description') || m('og:description'),
        ogImage: m('og:image'),
        crumbs, heads,
        text: text.slice(0, 2600)
      };
    });

    let heroPng = null, heroKind = 'none', heroAspect = 0, heroMime = 'image/png';
    let handle = null;
    if (site.hero_selector) handle = await page.$(site.hero_selector);
    if (!handle) {
      const idx = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('article') || document.body;
        const banned = el => el.closest('header,footer,nav,aside,[role=banner],[role=contentinfo]');
        const scoreOf = (el, media) => {
          if (banned(el)) return 0;
          const r = el.getBoundingClientRect();
          if (r.width < 200 || r.height < 200) return 0;
          const ar = r.height / r.width;
          if (ar < 0.45 || ar > 2.4) return 0;
          if (r.top + window.scrollY > window.innerHeight * 2.4) return 0;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return 0;
          if (media && el.tagName === 'IMG' && /logo|icon|avatar|sprite/i.test((el.src || '') + (el.alt || '') + (el.className || ''))) return 0;
          let score = r.width * r.height;
          if (el.tagName.toLowerCase() === 'svg' || el.tagName === 'CANVAS') score *= 1.25;
          if (r.top + window.scrollY < window.innerHeight) score *= 1.15;
          return score;
        };
        // real visuals first (svg, canvas, images); a styled wrapper only if there are none
        let els = [...main.querySelectorAll('svg, canvas, img')].filter(el => !el.parentElement.closest('svg'));
        let scores = els.map(el => scoreOf(el, true));
        if (!scores.some(Boolean)) {
          els = [...main.querySelectorAll('[class*=sheet], [class*=preview], [class*=paper], picture, figure')];
          scores = els.map(el => scoreOf(el, false));
        }
        let best = -1, bestScore = 0;
        scores.forEach((sc, i) => { if (sc > bestScore) { bestScore = sc; best = i; } });
        if (best >= 0) {
          const el = els[best];
          el.setAttribute('data-pin-hero', '1');
          return { kind: el.tagName.toLowerCase() };
        }
        return null;
      });
      if (idx) { handle = await page.$('[data-pin-hero="1"]'); heroKind = idx.kind; }
    } else {
      heroKind = 'selector';
    }
    if (handle) {
      await handle.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const box = await handle.boundingBox();
      if (box) {
        const shot = await handle.screenshot({ type: 'png' });
        const trimmed = await trimWhite(page, shot.toString('base64'));
        heroPng = trimmed.b64;
        heroAspect = trimmed.h / trimmed.w;
      }
    }
    if (!heroPng && meta.ogImage && !/\/og\/home\.|default|placeholder/i.test(meta.ogImage)) {
      try {
        const r = await fetch(meta.ogImage, { signal: AbortSignal.timeout(20000) });
        if (r.ok && /image\//.test(r.headers.get('content-type') || '')) {
          heroPng = Buffer.from(await r.arrayBuffer()).toString('base64');
          heroKind = 'og';
          heroMime = (r.headers.get('content-type') || 'image/png').split(';')[0];
          heroAspect = 630 / 1200;
        }
      } catch {}
    }
    return { url, ...meta, heroPng, heroKind, heroAspect, heroMime };
  } catch (e) {
    log('a page capture failed');
    return null;
  } finally {
    await ctx.close();
  }
}

/** Crop plain white (or near-white) margins around a screenshot, keeping a small border. */
async function trimWhite(page, b64) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + src;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    const ink = (i) => d[i + 3] > 20 && (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235);
    let top = h, left = w, right = -1, bottom = -1;
    for (let y = 0; y < h; y += 2) for (let xx = 0; xx < w; xx += 2) {
      if (ink((y * w + xx) * 4)) { if (y < top) top = y; if (y > bottom) bottom = y; if (xx < left) left = xx; if (xx > right) right = xx; }
    }
    if (right < 0) return { b64: src, w, h };
    // a sheet with a visible page edge is kept whole; only cut when margins are large
    const pad = Math.round(Math.max(w, h) * 0.035);
    left = Math.max(0, left - pad); top = Math.max(0, top - pad);
    right = Math.min(w - 1, right + pad); bottom = Math.min(h - 1, bottom + pad);
    const cw = right - left + 1, ch = bottom - top + 1;
    if (cw > w * 0.92 && ch > h * 0.92) return { b64: src, w, h };
    const o = document.createElement('canvas'); o.width = cw; o.height = ch;
    const ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, cw, ch);
    ox.drawImage(c, left, top, cw, ch, 0, 0, cw, ch);
    return { b64: o.toDataURL('image/png').split(',')[1], w: cw, h: ch };
  }, b64);
}
