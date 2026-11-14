// Reads one page of a font generator site for its video: the heading, and either the page's own styles
// (its text box filled with the video's sample text, then the first section of style rows) or its symbol table.
import { openPage } from './capture.mjs';
import { drawable } from './glyphs.mjs';

const PLATFORM_WORDS = /^(instagram|discord|android|ios|iphone|tiktok|roblox|facebook|twitter|x|fortnite|free fire|whatsapp|snapchat|works|everywhere|\s)+$/i;

/** { kind: 'styles' | 'symbols' | null, h1, section, rows: [{ label, value }] } */
export async function readSitePage(browser, url, text) {
  const { ctx, page } = await openPage(browser, url);
  try {
    // the generator's own box (not the site search)
    const boxes = await page.$$('textarea, input[type="text"], input:not([type])');
    let box = null;
    for (const b of boxes) {
      const meta = await b.evaluate(el => [el.placeholder, el.getAttribute('aria-label'), el.id, el.name, el.type].join(' '));
      if (/search/i.test(meta)) continue;
      if (await b.isVisible()) { box = b; break; }
    }
    if (box) {
      await box.fill('');
      await box.type(text, { delay: 15 });
      await page.waitForTimeout(700);
    }
    const got = await page.evaluate(({ typed, usedBox }) => {
      const main = document.querySelector('main') || document.body;
      const h1 = (document.querySelector('h1')?.innerText || '').trim();
      const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
      const want = norm(typed);
      // a symbol table: Symbol | Name columns
      const table = [...main.querySelectorAll('table')].find(t => /symbol/i.test(t.rows[0]?.innerText || '') && /name/i.test(t.rows[0]?.innerText || ''));
      if (!usedBox && table) {
        const head = [...table.rows[0].cells].map(c => c.innerText.trim().toLowerCase());
        const si = head.findIndex(h => h.startsWith('symbol')), ni = head.findIndex(h => h.startsWith('name'));
        const rows = [...table.rows].slice(1).map(r => ({ value: (r.cells[si]?.innerText || '').trim(), label: (r.cells[ni]?.innerText || '').trim() })).filter(r => r.value && r.label);
        return { kind: 'symbols', h1, section: h1, rows };
      }
      if (!usedBox) return { kind: null, h1, section: '', rows: [] };
      const copyBtns = [...main.querySelectorAll('button, [role="button"]')].filter(b => /copy/i.test(b.innerText || b.getAttribute('aria-label') || '') && !/all/i.test(b.innerText || ''));
      const isBtn = new Set(copyBtns);
      const rowOf = b => { let r = b; while (r.parentElement && r.parentElement !== main && [...r.parentElement.querySelectorAll('button, [role="button"]')].filter(x => isBtn.has(x)).length === 1) r = r.parentElement; return r; };
      const hs = [...main.querySelectorAll('h2')];
      const sectionOf = el => { let k = -1; hs.forEach((h, i) => { if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) k = i; }); return k; };
      const rows = [];
      for (const b of copyBtns) {
        const r = rowOf(b);
        const lines = (r.innerText || '').split('\n').map(s => s.trim()).filter(s => s && !/copy/i.test(s));
        const data = [b, r].map(el => el.dataset?.copy || el.dataset?.text || el.dataset?.value || '').find(Boolean) || '';
        let value = data && norm(data).includes(want) ? data : lines.find(l => want && norm(l).includes(want)) || lines.find(l => /[^\x00-\x7F]/.test(l)) || '';
        const label = lines.find(l => l !== value && /[a-z]/i.test(l) && !/[^\x00-\x7F]/.test(l)) || '';
        if (value && label) rows.push({ value, label, s: sectionOf(r) });
      }
      const heading = i => (hs[i]?.innerText || '').replace(/\(\d+\)\s*$/, '').trim();
      return { kind: rows.length ? 'styles' : null, h1, sections: [...new Set(rows.map(r => r.s))].map(s => ({ s, title: heading(s) })), rows };
    }, { typed: text, usedBox: !!box });
    if (got.kind === 'styles') {
      // the page's own section first; if it is short, the next sections fill it up to twelve
      const ok = r => drawable(r.value) && !/[|=~]/.test(r.value) && [...r.value].length <= 42 && !PLATFORM_WORDS.test(r.label);
      const first = got.sections[0];
      const seen = new Set(), rows = [];
      for (const sec of got.sections) {
        for (const r of got.rows.filter(x => x.s === sec.s && ok(x))) {
          if (rows.length >= 12 || seen.has(r.value)) continue;
          seen.add(r.value); rows.push({ label: r.label, value: r.value, own: sec === first });
        }
        if (rows.length >= 8) break;
      }
      return { kind: 'styles', h1: got.h1, section: first?.title || got.h1, rows };
    }
    if (got.kind === 'symbols') {
      const rows = got.rows.filter(r => drawable(r.value) && !/[|=~]/.test(r.value + r.label)).slice(0, 12);
      return { kind: rows.length >= 3 ? 'symbols' : null, h1: got.h1, section: got.h1, rows };
    }
    return { kind: null, h1: got.h1, section: '', rows: [] };
  } finally { await ctx.close().catch(() => {}); }
}
