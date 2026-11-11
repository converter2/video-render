// Writes new video scripts in the render repo (unlimited free minutes), then lists every video that needs rendering.
//   node tools/plan.mjs --plan <plan.json> --out <out dir> --jobs <jobs.json to write>
// plan.json comes from the dashboard over a private link: each website's video settings, its videos and any
// "Make a video now" requests. New scripts are kept sealed in <out>/plans.bin until the private repo collects them.
import fs from 'node:fs';
import path from 'node:path';
import { keyFrom, openJson, sealJson } from './seal.mjs';
import { planVideos, videoOn } from './lib/video.mjs';
import { resolveBrand } from './lib/render.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const OUT = path.resolve(opt('out', 'out'));
const STARTED = Date.now();
const BUDGET_MS = Number(process.env.PLAN_BUDGET_MIN || 50) * 60000;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const redact = s => String(s || '').replace(/https?:\/\/\S+/g, '<url>').replace(/"[^"]*"/g, '"…"').slice(0, 300);

async function main() {
  const key = keyFrom(process.env.JOB_KEY);
  const req = JSON.parse(fs.readFileSync(opt('plan'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const plansFile = path.join(OUT, 'plans.bin');
  let plans = { items: [], notes: {} };
  if (fs.existsSync(plansFile)) { try { plans = openJson(fs.readFileSync(plansFile, 'utf8'), key); } catch { log('earlier scripts unreadable, starting fresh'); } }
  const canon = p => JSON.stringify({ items: (p.items || []).map(x => x.item.id), notes: Object.fromEntries(Object.entries(p.notes || {}).map(([k, n]) => [k, { ...n, at: undefined }])) });
  const before = canon(plans);
  const now = Date.now();
  const sites = (req.sites || []).filter(x => x.site && videoOn(x.site) && x.site.enabled !== false);
  // every script stays here (sealed) until its video has gone out: the private repo only keeps a short copy,
  // so the dashboard stays quick, and the videos are made from these
  const known = new Set(sites.flatMap(x => (x.videos || []).map(v => v.id)));
  plans.items = (plans.items || []).filter(p => Date.parse(p.item.publish_at) > now - 6 * 3600000);
  plans.notes = plans.notes || {};

  let browser = null;
  const apiState = { fails: 0, down: false };
  const usageTotals = { input: 0, output: 0, usd: 0 };
  const timeLeft = () => BUDGET_MS - (Date.now() - STARTED);
  const want = sites.filter(x => x.fill !== false || x.now > 0);
  if (want.length) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  }
  try {
    for (const x of want) {
      const pending = plans.items.filter(p => p.site === x.site.id && !known.has(p.item.id)).map(p => p.item);
      const S = {
        site: x.site, report: { errors: [] },
        videos: [...(x.videos || []), ...pending],
        videoHistory: { ...(x.history || {}) }
      };
      for (const v of pending) S.videoHistory[v.url] = { last: v.publish_at };
      const before = new Set(S.videos.map(v => v.id));
      const brand = resolveBrand(x.site, x.brand || {});
      try {
        for (let n = 0; n < Math.min(3, x.now || 0); n++) await planVideos(browser, S, usageTotals, apiState, timeLeft, brand, { now: true, tutorial: x.site.video?.shorts === false });
        if (x.fill !== false) await planVideos(browser, S, usageTotals, apiState, timeLeft, brand);
        if (x.fill !== false) await planVideos(browser, S, usageTotals, apiState, timeLeft, brand, { tutorial: true });
      } catch (e) { S.report.errors.push('video: ' + e.message); }
      const fresh = S.videos.filter(v => !before.has(v.id));
      for (const item of fresh) plans.items.push({ site: x.site.id, item });
      plans.notes[x.site.id] = { at: new Date().toISOString(), made: fresh.length, errors: S.report.errors.slice(0, 8), note: S.report.note || '', api: S.report.api_problem || '' };
      log(`website ${sites.indexOf(x) + 1}: ${fresh.length} new script${fresh.length === 1 ? '' : 's'}${S.report.errors.length ? `, ${S.report.errors.length} notes` : ''}`);
      if (apiState.down) { log('Claude is not answering:', redact(apiState.reason)); break; }
    }
  } finally { if (browser) await browser.close().catch(() => {}); }
  // sealed files differ on every save, so only save when something changed (that is what wakes the private repo)
  if (canon(plans) !== before || !fs.existsSync(plansFile)) { plans.updated = new Date().toISOString(); fs.writeFileSync(plansFile, sealJson(plans, key)); log('new scripts saved'); }

  // everything that needs a video: the private repo's videos (not skipped) plus the new scripts
  const jobs = [];
  for (const x of sites) {
    const skips = new Set(x.skips || []);
    // the private repo's list says what is still wanted (and catches older videos that kept their script there);
    // the full scripts come from here
    const full = new Map(plans.items.filter(p => p.site === x.site.id).map(p => [p.item.id, p.item]));
    const all = new Map();
    for (const v of x.videos || []) all.set(v.id, v.beats?.length ? v : full.get(v.id) && full.get(v.id).hash === v.hash ? full.get(v.id) : v);
    for (const [id, v] of full) if (!all.has(id)) all.set(id, v);
    for (const v of all.values()) {
      if (skips.has(v.id) || Date.parse(v.publish_at) < now - 3600000 || !v.beats?.length) continue;
      if (x.site.video?.shorts === false && v.format !== 'tutorial') continue;   // Shorts turned off for this website
      jobs.push({ id: v.id, site: x.site.id, hash: v.hash, publish_at: v.publish_at, url: v.url, domain: x.site.domain.replace(/^www\./, ''),
        source: v.source, cover: v.cover, mascot: v.mascot, theme: v.theme, voice: v.voice,
        speed: Number(x.site.video?.speed) || (String(v.voice).startsWith('b') ? 1.08 : 1.06), beats: v.beats, ...(v.format ? { format: v.format } : {}) });
    }
  }
  fs.writeFileSync(opt('jobs'), JSON.stringify({ made: new Date().toISOString(), jobs }));
  log(`scripts kept: ${plans.items.length}; videos needed: ${jobs.length}`);
}

main().catch(e => { console.log('script writing stopped:', redact(e.message)); process.exit(1); });
