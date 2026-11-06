// Short cartoon videos for YouTube Shorts and Facebook Reels.
// Runs in the render repo: Claude writes a scene-by-scene script from each page, every number checked against
// the page. The new scripts go back to the private repo sealed (plans.bin) together with the finished videos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJson, hash, seeded, log, zonedToUtc, localYmd, addDays, hhmmToMin, bannedHits, cleanText, clip } from './util.mjs';
import { readSitemap, allowedPages } from './pages.mjs';
import { openPage } from './capture.mjs';

const API = process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages';
const KINDS = ['hook', 'stat', 'bars', 'rank', 'columns', 'list', 'showcase', 'close'];
const CAR_PARTS = ['headlight', 'taillight', 'tyre', 'spring', 'wiper'];
const CAR_LOOKS = ['new', 'clean', 'dusty', 'rusty', 'old', 'hybrid', 'electric', 'petrol', 'diesel'];
const REPEAT_DAYS = 120;           // a page gets another video only after this long

export const videoOn = site => !!site.video?.enabled;

/* ---------- defaults that suit each site ---------- */
const hexToHsl = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; const a = s * Math.min(l, 1 - l);
  const f = k => { const x = (k + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)))).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
};

/** Background, highlight and mascot colours from the site's own brand, so every site keeps its own look. */
export function videoTheme(site, brand) {
  const v = site.video || {};
  const valid = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '';
  const cands = [valid(v.color), valid(brand?.primary), valid(brand?.accent), valid(site.brand?.accent_fallback)].filter(Boolean);
  // the saturated colour that reads best as a sky
  const main = cands.map(c => ({ c, x: hexToHsl(c) })).filter(o => o.x && o.x[1] > 0.25).sort((a, b) => b.x[1] - a.x[1])[0] || { c: '#2A7BF5', x: hexToHsl('#2A7BF5') };
  let [h, s, l] = main.x;
  let hi = valid(v.highlight);
  if (l > 0.6 || (h > 40 && h < 75)) { hi = hi || main.c; h = (h + 180) % 360; s = Math.max(s, 0.7); }   // light or yellow brand: use it for highlights and put it on a contrasting sky
  s = Math.min(0.85, Math.max(0.55, s));
  const bg1 = hsl(h, s, 0.36), bg2 = hsl(h, s, 0.55);
  if (!hi) {
    // a bright highlight far round the colour wheel from the sky: warm ones on cool or red skies, cool ones on warm skies
    const dist = x => { const d = Math.abs(((x - h) % 360 + 360) % 360); return Math.min(d, 360 - d); };
    const pool = h >= 20 && h <= 100 ? [200, 170, 320] : [50, 75, 42];
    const pick = pool.sort((a, b) => dist(b) - dist(a))[0];
    hi = hsl(pick, 0.95, pick === 75 ? 0.58 : 0.6);
  }
  const hiL = hexToHsl(hi)?.[2] ?? 0.6;
  if (hiL < 0.5) hi = hsl(hexToHsl(hi)[0], 0.95, 0.62);
  const body = valid(v.mascot_color) || hi;
  return { bg1, bg2, hi, body };
}

export function defaultMascot(site) {
  if (site.video?.mascot) return site.video.mascot === 'car' ? 'car' : 'buddy';
  return /\b(car|cars|mot|vehicle|vehicles|tesla|charger|7[- ]seater|motor|driving)\b/i.test(`${site.domain} ${site.name} ${site.about}`) ? 'car' : 'buddy';
}
export function defaultVoice(site) {
  if (site.video?.voice) return site.video.voice;
  return /UK|Australian/i.test(site.spelling || '') ? 'bf_emma' : 'af_heart';
}
export function sayDomain(site) {
  if (site.video?.say_domain) return site.video.say_domain;
  const WORDS = new Set(['com', 'co', 'org', 'net', 'info', 'app', 'dev', 'shop', 'store', 'scot', 'blog', 'news', 'online', 'site']);
  return site.domain.replace(/^www\./, '').split('.').map(p => WORDS.has(p.toLowerCase()) || p.length > 3 ? p : p.toUpperCase().split('').join(' ')).join(' dot ');
}

/* ---------- slots ---------- */
export const MAX_PER_DAY = 10;
/** Audience-time slots for one day: "n a day" spread evenly between two times, or an exact list of times. */
export function slotTimes(v = {}) {
  const n = Math.max(0, Math.min(MAX_PER_DAY, Number(v.per_day) || 0));
  if (!n) return (v.times?.length ? v.times : ['18:30']).slice(0, MAX_PER_DAY);
  const a = hhmmToMin(v.window_start || '08:00'), b = hhmmToMin(v.window_end || '22:00');
  const lo = Math.min(a, b), span = Math.max(30, Math.abs(b - a));
  return Array.from({ length: n }, (_, i) => { const m = Math.round(lo + span * (i + 0.5) / n); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
}
function videoSlots(site, ymd) {
  const times = slotTimes(site.video);
  const n = times.length;
  return times.map((t, i) => {
    const jitter = Math.round((seeded(`vid${site.id}${ymd}${i}`) - 0.5) * (n > 4 ? 10 : 16));
    return { key: `${ymd}#v${i}`, at: zonedToUtc(ymd, hhmmToMin(t) + jitter, site.timezone || 'UTC') };
  });
}

/* ---------- page text for the script ---------- */
async function readPage(browser, url) {
  const { ctx, page } = await openPage(browser, url);
  try {
    return await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const main = q('main') || q('article') || q('[role=main]') || document.body;
      for (const el of main.querySelectorAll('nav,footer,aside,script,style,noscript,[aria-hidden=true]')) el.remove();
      const tables = [...main.querySelectorAll('table')].slice(0, 6).map(t => [...t.rows].slice(0, 25).map(r => [...r.cells].map(c => c.innerText.trim()).join(' | ')).join('\n'));
      const text = (main.innerText || '').replace(/\n{2,}/g, '\n').trim();
      return {
        title: document.title, h1: q('h1')?.innerText.trim() || '',
        description: q('meta[name="description"]')?.content || '',
        text: text.slice(0, 9000), tables: tables.join('\n\n').slice(0, 4000)
      };
    });
  } finally { await ctx.close().catch(() => {}); }
}

/* ---------- Claude ---------- */
const GROUP = { type: 'object', properties: {
  show: { type: 'string', description: 'Caption text shown on screen while this is spoken. 1-4 words, at most 22 characters. Numbers as digits exactly as on the page.' },
  say: { type: 'string', description: 'What the voice says for this caption. Numbers, symbols and abbreviations written out as spoken words (for example "seventy one point eight percent", "M O T", "P D F").' }
}, required: ['show', 'say'] };
const TOOL = {
  name: 'save_video',
  description: 'Save the script for one short vertical cartoon video about this page.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'YouTube title, 35-70 characters, built around the main search phrase for this page in the site spelling. No emojis, no hashtags, no all-caps words.' },
      description: { type: 'string', description: 'YouTube description: 2-3 plain sentences, under 300 characters, no URL, no hashtags.' },
      fb_caption: { type: 'string', description: 'Facebook Reel caption: 1-2 short sentences, under 200 characters, no URL, no hashtags.' },
      hashtags: { type: 'array', items: { type: 'string' }, description: '2-3 relevant hashtags without the # sign.' },
      cover_text: { type: 'string', description: 'The big words on the opening frame, which is also the thumbnail on YouTube and Facebook. 2-5 words, at most 26 characters. It must make people curious enough to tap, and the video must answer it. Examples of the shape: "Most cars fail on this", "Will yours pass?", "The month to avoid".' },
      cover_number: { type: 'string', description: 'Optional: the single most striking figure from the page for the thumbnail badge, at most 7 characters, e.g. "28%" or "97.8M". Empty if no figure is striking.' },
      source: { type: 'string', description: 'Short source line if the page names where its figures come from, e.g. "Source: DVSA MOT results, 2023 to 2025". Empty if it does not.' },
      beats: {
        type: 'array', minItems: 4, maxItems: 7,
        description: 'Scenes in order. The first is "hook", the last is "close".',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: KINDS },
            kicker: { type: 'string', description: 'Small label at the top, at most 26 characters.' },
            title: { type: 'string', description: 'Big heading for the scene, at most 34 characters (hook and close: at most 30).' },
            value: { type: 'string', description: 'stat only: the one figure, at most 8 characters, e.g. "71.8%" or "£1,240".' },
            label: { type: 'string', description: 'stat only: what the figure means, at most 24 characters.' },
            tone: { type: 'string', enum: ['good', 'bad'], description: 'stat and rank: "bad" when the figure or list is about failures, problems or risks.' },
            bubble: { type: 'string', description: 'hook only, optional: one or two words in a speech bubble, at most 8 characters.' },
            plate: { type: 'string', description: 'hook or showcase only, optional: a short badge, at most 14 characters, e.g. "97.8M TESTS".' },
            items: {
              type: 'array', maxItems: 12,
              items: { type: 'object', properties: {
                label: { type: 'string' }, value: { type: 'string' },
                part: { type: 'string', enum: [...CAR_PARTS, ''], description: 'rank with the car mascot only: the car part this item is about, if it is literally that part.' },
                variant: { type: 'string', enum: [...CAR_LOOKS, ''], description: 'bars with the car mascot only: how this lane\'s car looks.' }
              }, required: ['label'] },
              description: 'bars: 2-5 items, label at most 11 characters, value at most 7 characters, same unit. rank: 3-5 items, label at most 24 characters, value optional. columns: 3-12 items, label at most 4 characters (e.g. Jan), value at most 6 characters. list: 2-4 items, label at most 24 characters, no value.'
            },
            lines: {
              type: 'array', minItems: 1, maxItems: 4,
              items: { type: 'array', minItems: 1, maxItems: 5, items: GROUP },
              description: 'What the voice says while this scene is on screen: sentences, each split into caption groups.'
            }
          },
          required: ['kind', 'lines']
        }
      }
    },
    required: ['title', 'description', 'fb_caption', 'hashtags', 'cover_text', 'beats']
  }
};

function systemPrompt(site, mascot) {
  return `You write scripts for short vertical cartoon explainer videos (YouTube Shorts and Facebook Reels) for ${site.name} (${site.domain}).
About the site: ${site.about || ''}
Audience: ${site.audience || 'general'}. Spelling: ${site.spelling || 'US English'}, used everywhere including captions.
The mascot is ${mascot === 'car' ? 'a friendly yellow cartoon car' : 'a friendly round cartoon character'}. A warm, upbeat voice reads the lines.

Scenes you can use (4 to 7 in total, first "hook", last "close"):
- hook: a question or striking fact from the page. Optional bubble and plate.
- stat: one big figure from the page in a gauge (percentages fill a ring and show ten mini mascots).
- bars: 2-5 values in the same unit, shown as a race to the finish line.
- rank: a numbered top list (3-5) with optional values.
- columns: a bar chart of 3-12 values in the same unit (months, years, categories); the highest gets a crown, the lowest falls asleep.
- list: 2-4 short points with ticks (no numbers needed).
- showcase: the page itself scrolling on a phone. Use it for tools, printables, galleries and pages without many figures.
- close: invites people to the site. Its last caption group must show "${site.domain}" and its say must be "${sayDomain(site)}".

How to write:
- 70 to 110 spoken words in total (about 25 to 40 seconds). Short, natural sentences, like a person talking.
- Every scene's lines are spoken while that scene is on screen, so talk about what the scene shows. Mention each bar, rank or list item by its name or number, in the order they appear, so each one pops up as it is said.
- Use only facts and numbers that are on the page. Never invent, estimate or extrapolate. Rounding is fine only as "nearly" or "about" (71.8% can be "nearly 72%").
- Each caption group shows 1-4 words. "show" uses digits like the page; "say" spells numbers and symbols out as spoken words.
- The cover (cover_text and cover_number) is the first thing people see, in the feed and as the thumbnail. Open a curiosity gap that the video closes: a surprising fact, a question the viewer wants answered, or "this" pointing at something the video reveals. It must be true to the page. No fake shock, no "you won't believe", no emojis.
- The hook scene follows straight after the cover, so it should start answering it.
- The YouTube title is unique to this page and leads with what people search for. Do not reuse the openings of the recent titles listed.
- Plain words. Avoid stock phrases such as "look no further", "unlock", "dive into", "game-changer", "must-have", "the ultimate". Never use em dashes.
- Never say or hint that anything is automated, generated, AI-made, pulled from an API or updated on a schedule.

Hard limits (the site owner's rules, no exceptions):
- Nothing about alcohol in any form, gambling, betting or lotteries, or anything adult or suggestive.
- Nothing that presents worship of, prayer to, or offerings to gods, idols or deities.
- Never show a person's name or anything that could identify a private person.
If the page cannot make a good, accurate video within these rules, set the title to "SKIP".${site.copy_rules ? '\n\nExtra rules from the site owner:\n' + site.copy_rules : ''}${site.video?.rules ? '\n\nVideo rules from the site owner:\n' + site.video.rules : ''}`;
}

async function callClaude(site, mascot, page, url, recentTitles, feedback) {
  const key = String(process.env.ANTHROPIC_API_KEY || '').replace(/\s+/g, '');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const user = `Page URL: ${url}
Title: ${page.title}
H1: ${page.h1}
Meta description: ${page.description}
Page text:
${page.text}
${page.tables ? '\nTables on the page:\n' + page.tables : ''}

Recent video titles on this site (do not repeat their openings):
${recentTitles.slice(-12).map(t => '- ' + t).join('\n') || '- none yet'}

Write the video and save it by calling the save_video tool.`;
  const messages = [{ role: 'user', content: user }];
  if (feedback) { messages.push({ role: 'assistant', content: 'Understood.' }, { role: 'user', content: feedback }); }
  const body = { model: site.copy_model || 'claude-sonnet-5-5', max_tokens: 6000, system: [{ type: 'text', text: systemPrompt(site, mascot), cache_control: { type: 'ephemeral' } }], tools: [TOOL], tool_choice: { type: 'auto' }, messages };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 5000 * attempt)); continue; }
    const json = await res.json();
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${json?.error?.message || JSON.stringify(json).slice(0, 300)}`);
    const tool = (json.content || []).find(c => c.type === 'tool_use' && c.name === 'save_video');
    if (tool) return { plan: tool.input, usage: json.usage };
    const text = (json.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { const o = JSON.parse(m[0]); if (Array.isArray(o.beats)) return { plan: o, usage: json.usage }; } catch {} }
    throw new Error('Claude returned no video script');
  }
  throw new Error('Claude API kept failing');
}

/* ---------- checks ---------- */
const NUM = /\d[\d,]*(?:\.\d+)?/g;
const toNum = s => Number(String(s).replace(/,/g, ''));
export function pageNumbers(page) {
  const all = `${page.title}\n${page.h1}\n${page.description}\n${page.text}\n${page.tables}`;
  return new Set((all.match(NUM) || []).map(toNum).filter(Number.isFinite));
}
/** Numbers in the script that cannot be traced to the page (small counts and roundings are allowed). */
export function unsupported(plan, nums, domain = '') {
  const shown = [];
  const dom = String(domain).replace(/^www\./, '').toLowerCase();
  const add = s => { if (s) shown.push(...(String(s).toLowerCase().split(dom).join(' ').match(NUM) || [])); };
  add(plan.title); add(plan.description); add(plan.fb_caption); add(plan.cover_text); add(plan.cover_number);
  for (const b of plan.beats || []) {
    add(b.title); add(b.kicker); add(b.value); add(b.label); add(b.bubble); add(b.plate);
    for (const it of b.items || []) { add(it.label); add(it.value); }
    for (const l of b.lines || []) for (const g of l) add(g.show);
  }
  const page = [...nums];
  const ok = n => n <= 12 && Number.isInteger(n) || nums.has(n) || page.some(m =>
    Math.round(m) === n || Math.round(m * 10) / 10 === n || Math.round(m / 1e6 * 10) / 10 === n || Math.round(m / 1e6) === n ||
    Math.round(m / 1e3 * 10) / 10 === n || Math.round(m / 1e3) === n || Math.round(m / 1e9 * 10) / 10 === n);
  return [...new Set(shown.map(toNum).filter(n => Number.isFinite(n) && !ok(n)))];
}

function tidy(plan, site, mascot) {
  const g = x => ({ show: clip(x?.show, 26), say: cleanText(x?.say || x?.show || '') });
  const beats = (plan.beats || []).filter(b => KINDS.includes(b?.kind)).slice(0, 7).map(b => {
    const items = (Array.isArray(b.items) ? b.items : []).map(it => ({
      label: clip(it?.label, b.kind === 'columns' ? 5 : b.kind === 'bars' ? 13 : 28), value: clip(it?.value || '', 9),
      ...(mascot === 'car' && b.kind === 'rank' && CAR_PARTS.includes(it?.part) ? { part: it.part } : {}),
      ...(mascot === 'car' && b.kind === 'bars' && CAR_LOOKS.includes(it?.variant) ? { variant: it.variant } : {})
    })).filter(it => it.label).slice(0, b.kind === 'columns' ? 12 : b.kind === 'list' ? 4 : 5);
    return {
      kind: b.kind, kicker: clip(b.kicker, 28), title: clip(b.title, 40), value: clip(b.value, 9), label: clip(b.label, 26),
      tone: b.tone === 'bad' ? 'bad' : 'good', bubble: clip(b.bubble, 9), plate: clip(b.plate, 16), items,
      lines: (Array.isArray(b.lines) ? b.lines : []).map(l => (Array.isArray(l) ? l : [l]).map(g).filter(x => x.show && x.say)).filter(l => l.length)
    };
  }).filter(b => b.lines.length);
  return {
    title: clip(plan.title, 95).replace(/[<>]/g, ''), description: clip(plan.description, 400).replace(/[<>]/g, ''), fb_caption: clip(plan.fb_caption, 260),
    hashtags: (Array.isArray(plan.hashtags) ? plan.hashtags : String(plan.hashtags || '').split(/[\s,]+/)).map(t => String(t).replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).slice(0, 3),
    cover_text: clip(String(plan.cover_text || '').replace(/[!]+$/, ''), 30), cover_number: clip(plan.cover_number || '', 8),
    source: clip(plan.source || '', 70), beats
  };
}

export function problems(plan, site, nums) {
  const out = [];
  const b = plan.beats;
  if (b.length < 4) out.push('use 4 to 7 scenes');
  if (b[0]?.kind !== 'hook') out.push('the first scene must be "hook"');
  if (b[b.length - 1]?.kind !== 'close') out.push('the last scene must be "close"');
  const close = b[b.length - 1];
  const lastGroup = close?.lines?.at(-1)?.at(-1);
  if (close && !(lastGroup && lastGroup.show.toLowerCase().includes(site.domain.replace(/^www\./, '').toLowerCase()))) out.push(`the last caption group of "close" must show ${site.domain}`);
  for (const x of b) {
    const n = x.items.length;
    if (x.kind === 'bars' && (n < 2 || n > 5)) out.push('bars needs 2 to 5 items');
    if ((x.kind === 'rank' || x.kind === 'columns') && n < 3) out.push(`${x.kind} needs at least 3 items`);
    if (x.kind === 'list' && (n < 2 || n > 4)) out.push('list needs 2 to 4 items');
    if ((x.kind === 'bars' || x.kind === 'columns') && x.items.some(it => !/\d/.test(it.value))) out.push(`every ${x.kind} item needs a number`);
    if (x.kind === 'stat' && !/\d/.test(x.value)) out.push('stat needs a figure');
  }
  const cw = String(plan.cover_text || '').split(/\s+/).filter(Boolean).length;
  if (!plan.cover_text || cw > 6 || plan.cover_text.length > 28) out.push('cover_text must be 2 to 5 words and at most 26 characters');
  const words = b.flatMap(x => x.lines.flat().map(g => g.say)).join(' ').split(/\s+/).filter(Boolean).length;
  if (words < 45 || words > 140) out.push(`the voice has ${words} words; aim for 70 to 110`);
  const bad = unsupported(plan, nums, site.domain);
  if (bad.length) out.push(`these numbers are not on the page: ${bad.slice(0, 8).join(', ')}. Use only figures the page shows`);
  const hits = bannedHits([plan.title, plan.description, plan.fb_caption, plan.cover_text, ...plan.hashtags, ...b.flatMap(x => [x.title, x.kicker, x.label, ...x.items.map(i => i.label), ...x.lines.flat().map(g => g.show + ' ' + g.say)])].join('\n'));
  if (hits.length) out.push(`remove these words the site owner does not allow: ${[...new Set(hits)].join(', ')}`);
  return out;
}

/* ---------- planning (runs inside the daily job) ---------- */
export function openVideos(S) {
  S.videos = readJson(path.join(S.dataDir, 'videos.json'), []);
  S.videoHistory = readJson(path.join(S.dataDir, 'video-history.json'), {});
  return S;
}

export async function planVideos(browser, S, usageTotals, apiState, timeLeft, brand, { now: makeNow = false } = {}) {
  const { site, report } = S;
  if (!videoOn(site) || apiState.down) return;
  const now = Date.now();
  const tz = site.timezone || 'UTC';
  const today = localYmd(new Date(), tz);
  // at least 15 days of videos are kept ready, so posting carries on for two weeks even if Claude stops answering
  const days = Math.max(15, Math.min(30, Number(site.video.plan_days) || 16));
  const used = new Set(S.videos.map(v => v.slot));
  // "Make a video now": one extra video for today, 90 minutes out, outside the normal schedule (you can post it sooner from the dashboard)
  const open = makeNow ? [{ key: `${today}#now${Date.now().toString(36)}`, at: new Date(Math.ceil((now + 90 * 60000) / 300000) * 300000) }]
    : Array.from({ length: days + 1 }, (_, i) => addDays(today, i)).flatMap(d => videoSlots(site, d))
      .filter(s => s.at.getTime() > now + 6 * 3600000 && s.at.getTime() < now + (days + 0.5) * 86400000 && !used.has(s.key));
  if (!open.length) { report.note = report.note || `videos are already planned for the next ${days} days`; return; }
  // which pages may get videos: the website's own list if it has one, otherwise any page the posts may use
  const host = site.domain.replace(/^www\./, '').toLowerCase();
  const toRe = r => { try { return new RegExp(r, 'i'); } catch { return null; } };
  const lines = (site.video.pages || []).map(x => String(x).trim()).filter(Boolean);
  const exact = [], patterns = [];
  for (const l of lines) {
    if (/^https?:\/\//i.test(l)) {
      try { const u = new URL(l); if (u.hostname.replace(/^www\./, '').toLowerCase() === host) exact.push(u.href); else report.errors.push(`video page ${l} is not on ${site.domain}`); } catch {}
    } else { const r = toRe(l); if (r) patterns.push(r); }
  }
  const never = (site.video.never || []).map(toRe).filter(Boolean);
  const pathOf = u => { try { return new URL(u).pathname; } catch { return u; } };
  let urls = [];
  if (!exact.length || patterns.length) {
    try { urls = allowedPages(site, await readSitemap(site.sitemap || `https://${site.domain}/sitemap.xml`)); }
    catch (e) { report.errors.push('video sitemap: ' + e.message); if (!exact.length) return; }
  }
  const listed = lines.length > 0;
  if (listed) urls = urls.filter(u => patterns.some(r => r.test(pathOf(u)) || r.test(u)));
  const pri = (site.video.priority?.length ? site.video.priority : site.priority || []).map(toRe).filter(Boolean);
  urls.sort((a, b) => {
    const pa = pri.findIndex(r => r.test(a)), pb = pri.findIndex(r => r.test(b));
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || seeded(a + today) - seeded(b + today);
  });
  const repeatDays = Math.max(30, Math.min(365, Number(site.video.repeat_days) || REPEAT_DAYS));
  const recent = new Set(S.videos.filter(v => Date.parse(v.publish_at) > now - repeatDays * 86400000).map(v => v.url));
  // pages typed in by hand come first, in the order they were listed
  const allowed = [...new Set([...exact, ...urls])].filter(u => !never.some(r => r.test(pathOf(u)) || r.test(u)));
  const pool = allowed.filter(u => !recent.has(u) && !(S.videoHistory[u]?.skip_until > now) && !(Date.parse(S.videoHistory[u]?.last || 0) > now - repeatDays * 86400000));
  if (!pool.length) {
    report.errors.push(!allowed.length
      ? (listed ? 'videos: no page matches the video page list (check the links and patterns in the website settings)' : 'videos: no pages can get a video (check "Never make videos from")')
      : `videos: every allowed page has had a video in the last ${repeatDays} days; add more pages to the video list`);
    return;
  }
  const mascot = defaultMascot(site);
  const theme = videoTheme(site, brand);
  const recentTitles = S.videos.slice(-20).map(v => v.title);
  report.videos_planned = 0;
  // up to 4 scripts are written at the same time, so 10 a day costs little run time (GitHub minutes)
  const queue = [...open];
  const worker = async () => {
  while (queue.length) {
    if (timeLeft() < 4 * 60000 || apiState.down) return;
    const slot = queue.shift();
    let made = false;
    for (let tries = 0; tries < 3 && !made && pool.length; tries++) {
      const url = pool.shift();
      let page;
      try { page = await readPage(browser, url); } catch (e) { report.errors.push('video page: ' + e.message); continue; }
      const nums = pageNumbers(page);
      let plan, usage = { input_tokens: 0, output_tokens: 0 };
      try {
        let r = await callClaude(site, mascot, page, url, recentTitles);
        usage = r.usage || usage;
        if (/^skip$/i.test(String(r.plan?.title || '').trim())) { S.videoHistory[url] = { ...(S.videoHistory[url] || {}), skip_until: now + 90 * 86400000 }; continue; }
        plan = tidy(r.plan, site, mascot);
        let issues = problems(plan, site, nums);
        if (issues.length) {
          log('rewriting a video script (it broke a rule or used a figure not on the page)');
          r = await callClaude(site, mascot, page, url, recentTitles, `Please fix these and call save_video again: ${issues.join('; ')}.`);
          usage = { input_tokens: usage.input_tokens + (r.usage?.input_tokens || 0), output_tokens: usage.output_tokens + (r.usage?.output_tokens || 0) };
          plan = tidy(r.plan, site, mascot);
          issues = problems(plan, site, nums);
          if (issues.length) { report.errors.push(`video skipped for ${new URL(url).pathname}: ${issues[0]}`); S.videoHistory[url] = { ...(S.videoHistory[url] || {}), skip_until: now + 30 * 86400000 }; continue; }
        }
      } catch (e) {
        apiState.fails++;
        if (/credit|billing|balance|quota|api key|authentication|401|403|not set/i.test(e.message) || apiState.fails >= 2) { apiState.down = true; apiState.reason = report.api_problem = e.message.slice(0, 200); }
        else report.errors.push('video script: ' + e.message);
        return;
      }
      const pr = { 'claude-haiku-5-5': [0.1, 0.5] }[site.copy_model] || [2, 10];
      usageTotals.input += usage.input_tokens || 0; usageTotals.output += usage.output_tokens || 0;
      usageTotals.usd += ((usage.input_tokens || 0) * pr[0] + (usage.output_tokens || 0) * pr[1]) / 1e6;
      const cost = { input: usage.input_tokens || 0, output: usage.output_tokens || 0, usd: Math.round(((usage.input_tokens || 0) * pr[0] + (usage.output_tokens || 0) * pr[1]) / 1e3) / 1e3 };
      const item = {
        id: `${slot.at.toISOString().slice(0, 10).replace(/-/g, '')}-v${hash(url + Date.now() + Math.random(), 7)}`,
        slot: slot.key, url, publish_at: slot.at.toISOString(), created: new Date().toISOString(),
        title: plan.title, description: plan.description, fb_caption: plan.fb_caption, hashtags: plan.hashtags,
        source: plan.source, cover: { text: plan.cover_text, number: plan.cover_number }, mascot, theme, voice: defaultVoice(site), beats: plan.beats, cost
      };
      item.hash = hash(JSON.stringify([item.beats, item.theme, item.mascot, item.voice, site.domain, item.source, item.cover]), 12);
      S.videos.push(item);
      recentTitles.push(item.title);
      S.videoHistory[url] = { last: item.publish_at };
      report.videos_planned++;
      made = true;
    }
  }
  };
  await Promise.all(Array.from({ length: Math.min(4, open.length) }, worker));
}

export function finishVideos(S) {
  if (!S.videos) return;
  const cut = Date.now() - 30 * 86400000;
  S.videos = S.videos.filter(v => Date.parse(v.publish_at) > cut).sort((a, b) => a.publish_at.localeCompare(b.publish_at));
  if (S.videos.length || fs.existsSync(path.join(S.dataDir, 'videos.json'))) writeJson(path.join(S.dataDir, 'videos.json'), S.videos);
  if (Object.keys(S.videoHistory || {}).length) writeJson(path.join(S.dataDir, 'video-history.json'), S.videoHistory);
}
