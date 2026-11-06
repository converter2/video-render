// Keeps the finished (sealed) videos as release files in this repository, one release per publishing day.
// Release files do not count towards the repository size, so two weeks or more of videos fit easily,
// and a whole day is removed in one go once its videos have gone out.
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const UP = process.env.STORE_UPLOAD_URL || 'https://uploads.github.com';
const DL = process.env.STORE_DOWNLOAD_URL || 'https://github.com';
const REPO = process.env.GITHUB_REPOSITORY || '';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

export const storeReady = () => !!(REPO && TOKEN);
export const dayTag = iso => 'v-' + String(iso).slice(0, 10).replace(/-/g, '');
export const storeUrl = (repo, tag, name) => `${DL}/${repo}/releases/download/${tag}/${name}`;

async function gh(path, opts = {}, base = API) {
  for (let i = 1; ; i++) {
    let r;
    try {
      r = await fetch(base + path, { ...opts, headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(opts.headers || {}) }, signal: AbortSignal.timeout(300000) });
    } catch (e) { if (i >= 4) throw e; await new Promise(res => setTimeout(res, 4000 * i)); continue; }
    if ((r.status >= 500 || r.status === 429) && i < 4) { await new Promise(res => setTimeout(res, 5000 * i)); continue; }
    return r;
  }
}

const releases = new Map();
async function release(tag) {
  if (releases.has(tag)) return releases.get(tag);
  let r = await gh(`/repos/${REPO}/releases/tags/${tag}`);
  if (r.status === 404) {
    r = await gh(`/repos/${REPO}/releases`, { method: 'POST', body: JSON.stringify({ tag_name: tag, name: tag, body: 'Working files.', prerelease: true, make_latest: 'false' }) });
    // two steps racing for the same day: read the one that won
    if (r.status === 422) r = await gh(`/repos/${REPO}/releases/tags/${tag}`);
  }
  if (!r.ok) throw new Error(`release storage answered ${r.status}`);
  const j = await r.json();
  releases.set(tag, j);
  return j;
}

async function assets(rel) {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const r = await gh(`/repos/${REPO}/releases/${rel.id}/assets?per_page=100&page=${page}`);
    if (!r.ok) break;
    const j = await r.json();
    out.push(...j);
    if (j.length < 100) break;
  }
  return out;
}

/** Stores one file and returns its id (an older file of the same name is replaced). */
export async function put(tag, name, buf) {
  const rel = await release(tag);
  for (let i = 1; i <= 2; i++) {
    const r = await gh(`/repos/${REPO}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', body: buf, headers: { 'content-type': 'application/octet-stream' } }, UP);
    if (r.ok) return (await r.json()).id;
    if (r.status === 422 && i === 1) {
      const old = (await assets(rel)).find(a => a.name === name);
      if (old) { await drop(old.id); continue; }
    }
    throw new Error(`storing a video failed (${r.status})`);
  }
}

export async function drop(id) {
  if (!id) return;
  const r = await gh(`/repos/${REPO}/releases/assets/${id}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`removing an old video failed (${r.status})`);
}

/** Removes the days nothing points at any more (their videos have gone out or were dropped). */
export async function tidy(keepTags) {
  let n = 0;
  for (let page = 1; page < 10; page++) {
    const r = await gh(`/repos/${REPO}/releases?per_page=100&page=${page}`);
    if (!r.ok) break;
    const list = await r.json();
    for (const rel of list) {
      if (!/^v-\d{8}$/.test(rel.tag_name) || keepTags.has(rel.tag_name)) continue;
      await gh(`/repos/${REPO}/releases/${rel.id}`, { method: 'DELETE' });
      await gh(`/repos/${REPO}/git/refs/tags/${rel.tag_name}`, { method: 'DELETE' });
      releases.delete(rel.tag_name);
      n++;
    }
    if (list.length < 100) break;
  }
  return n;
}
