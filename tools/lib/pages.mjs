import { fetchText, seeded } from './util.mjs';

/** Read a sitemap (or sitemap index) and return page URLs. */
export async function readSitemap(url, depth = 0) {
  const xml = await fetchText(url);
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex/i.test(xml) && depth < 2) {
    const out = [];
    for (const sm of locs) {
      try { out.push(...await readSitemap(sm, depth + 1)); } catch (e) { console.warn('a sitemap part could not be read'); }
    }
    return out;
  }
  return locs.filter(u => !/\.(xml|jpg|jpeg|png|webp|pdf)(\?|$)/i.test(u));
}

function pathOf(u) { try { return new URL(u).pathname; } catch { return u; } }

export function allowedPages(site, urls) {
  const inc = (site.include || []).map(r => new RegExp(r, 'i'));
  const exc = (site.exclude || []).map(r => new RegExp(r, 'i'));
  const host = site.domain.replace(/^www\./, '');
  return [...new Set(urls)].filter(u => {
    let h;
    try { h = new URL(u).hostname.replace(/^www\./, ''); } catch { return false; }
    if (h !== host) return false;
    const p = pathOf(u);
    if (exc.some(r => r.test(p))) return false;
    if (inc.length && !inc.some(r => r.test(p))) return false;
    return true;
  });
}

export function boardFor(site, url) {
  const p = pathOf(url);
  const boards = site.pinterest?.boards || [];
  for (const b of boards) {
    if ((b.match || []).some(r => r && new RegExp(r, 'i').test(p))) return b.key;
  }
  return site.pinterest?.default_board || boards[boards.length - 1]?.key || 'main';
}

/**
 * Choose the next pages to post.
 * Least-posted first; pages matching earlier `priority` patterns go first within the same count;
 * the same page is never used twice within `gapDays`, and never more than `max` times.
 */
export function pickPages(site, urls, history, n, { max = 4, gapDays = 10, exclude = new Set(), salt = '' } = {}) {
  const pri = (site.priority || []).map(r => new RegExp(r, 'i'));
  const now = Date.now();
  const cands = urls
    .filter(u => !exclude.has(u))
    .map(u => {
      const h = history[u] || { count: 0, last: null };
      const p = pathOf(u);
      const pi = pri.findIndex(r => r.test(p));
      return { u, count: h.count || 0, last: h.last ? Date.parse(h.last) : 0, pri: pi < 0 ? pri.length : pi, rnd: seeded(u + salt) };
    })
    .filter(c => c.count < max && (!c.last || now - c.last > gapDays * 86400000));
  cands.sort((a, b) => a.count - b.count || a.pri - b.pri || a.rnd - b.rnd);
  // spread across boards so a day is not all one topic
  const picked = [];
  const perBoard = {};
  for (const pass of [1, 2]) {
    for (const c of cands) {
      if (picked.length >= n) break;
      if (picked.includes(c.u)) continue;
      const b = boardFor(site, c.u);
      if (pass === 1 && (perBoard[b] || 0) >= Math.max(1, Math.ceil(n / 3))) continue;
      perBoard[b] = (perBoard[b] || 0) + 1;
      picked.push(c.u);
    }
  }
  return picked;
}
