// Turns a video job (written by Claude in the private repo) into the spoken script, with the moment each
// item on screen should appear tied to the words that mention it.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function intWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + intWords(n % 100) : '');
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= v) return intWords(Math.floor(n / v)) + ' ' + w + (n % v ? (n % v < 100 ? ' and ' : ' ') + intWords(n % v) : '');
  }
  return String(n);
}
/** Safety net: Claude writes numbers in words for the voice, but any digits left over are spelled out here. */
export function spokenNumbers(s) {
  return String(s)
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/[£$€](\d+(?:\.\d+)?)/g, (_, n) => `${n} ${_.startsWith('£') ? 'pounds' : _.startsWith('€') ? 'euros' : 'dollars'}`)
    .replace(/(\d+)\.(\d+)/g, (_, a, b) => `${intWords(Number(a))} point ${b.split('').map(d => ONES[Number(d)]).join(' ')}`)
    .replace(/\d+/g, d => d.length > 12 ? d : intWords(Number(d)))
    .replace(/%/g, ' percent')
    .replace(/\s+/g, ' ').trim();
}

const norm = s => String(s || '').toLowerCase().replace(/(\d),(\d{3})/g, '$1$2');
const numsIn = s => (norm(s).match(/\d+(?:\.\d+)?/g) || []).map(Number);
const words = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length >= 4 || /^\d+$/.test(w));
const STOP = new Set(['with', 'that', 'this', 'from', 'your', 'have', 'more', 'than', 'were', 'they', 'what', 'when', 'into', 'over', 'most', 'just', 'only']);

/** Does this caption group mention the item (its number, or a distinctive word of its label)? */
function mentions(show, item) {
  const got = numsIn(show);
  const want = numsIn(item.value);
  if (want.length && want.some(v => got.some(g => g === v || Math.round(v) === g || Math.round(v * 10) / 10 === g))) return true;
  const w = norm(show);
  return words(item.label).filter(x => !STOP.has(x)).some(x => new RegExp(`\\b${x.replace(/[^a-z0-9]/g, '')}`).test(w));
}

const PART_SFX = { headlight: 'fizz', taillight: 'fizz', spring: 'boing', wiper: 'squeak', tyre: 'pop' };

/** Tutorials: the voice text of a beat cut into caption groups of a few words, kept to sentence and comma breaks. */
export function linesFrom(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean).map(sentence => {
    const out = []; let cur = [];
    for (const w of sentence.split(' ')) {
      cur.push(w);
      if (cur.length >= 5 || (cur.length >= 3 && /[,;:]$/.test(w))) { out.push(cur.join(' ')); cur = []; }
    }
    if (cur.length) { if (cur.length < 2 && out.length) out[out.length - 1] += ' ' + cur.join(' '); else out.push(cur.join(' ')); }
    return out.map(g => ({ show: g, say: g }));
  });
}

/** Script for audio.py: each beat's sentences as [shown, spoken] caption groups plus timed cues. */
export function buildScript(job) {
  const beats = job.beats.map((b, bi) => {
    const sentences = (b.lines?.length ? b.lines : linesFrom(b.voice)).map(line => line.map(g => [String(g.show || '').trim(), spokenNumbers(g.say || g.show || '')]).filter(g => g[0] && g[1]))
      .filter(l => l.length);
    if (!sentences.length) sentences.push([[b.title || b.kicker || ' ', spokenNumbers(b.title || b.kicker || 'Here it is.')]]);
    const flat = sentences.flatMap((s, si) => s.map((g, gi) => ({ si, gi, show: g[0] })));
    const last = flat.length - 1;
    const find = (pred, from) => { for (let i = Math.max(0, from); i <= last; i++) if (pred(flat[i].show)) return i; return -1; };
    const cues = [];   // flat indices, one per revealed element, in reveal order
    const items = b.items || [];
    const sfxFor = [];
    if (b.kind === 'hook') { const i = b.bubble ? find(s => mentions(s, { label: b.bubble, value: '' }), 0) : -1; cues.push(i >= 0 ? i : Math.min(1, last)); sfxFor.push('pop'); }
    else if (b.kind === 'stat') {
      let i = find(s => mentions(s, { label: '', value: b.value }), 0); if (i < 0) i = 0;
      const next = flat.findIndex((g, j) => j > i && g.si > flat[i].si);
      cues.push(i, next >= 0 ? next : Math.min(last, i + 1)); sfxFor.push('impact', 'pop');
    } else if (b.kind === 'columns') {
      const nums = items.map(x => numsIn(x.value)[0] ?? 0), mx = items[nums.indexOf(Math.max(...nums))], mn = items[nums.indexOf(Math.min(...nums))];
      let i = mx ? find(s => mentions(s, mx), 0) : -1; if (i < 0) i = 0;
      let j = mn ? find(s => mentions(s, mn), i) : -1; if (j < 0) j = Math.min(last, i + 2);
      cues.push(i, j); sfxFor.push('pop', 'pop');
    } else if (b.kind === 'close') { let i = find(s => /\.[a-z]{2,}/i.test(s), 0); if (i < 0) i = last; cues.push(i); sfxFor.push('close'); }
    else if (b.kind === 'showcase') { cues.push(Math.min(last, Math.max(0, Math.floor(last / 2)))); sfxFor.push('pop'); }
    else {
      let prev = b.kind === 'rank' || b.kind === 'list' ? 1 : 0;
      prev = Math.min(prev, last);
      items.forEach((it, j) => {
        let i = find(s => mentions(s, it), prev);
        if (i < 0) i = Math.min(last, prev + (j ? 1 : 0));
        cues.push(i); prev = i;
        sfxFor.push(b.kind === 'bars' ? (job.mascot === 'car' ? 'skid' : 'boop') : b.kind === 'rank' && it.part ? (PART_SFX[it.part] || 'pop') : 'pop');
      });
    }
    const perSentence = sentences.map(() => []);
    cues.forEach((ci, n) => perSentence[flat[ci].si].push({ g: flat[ci].gi, sfx: sfxFor[n] || 'pop', n }));
    perSentence.forEach(list => list.sort((a, c) => a.g - c.g || a.n - c.n));
    return { id: `b${bi}`, kind: b.kind, sentences: sentences.map((groups, si) => ({ groups, cues: perSentence[si].map(({ g, sfx }) => ({ g, sfx })) })) };
  });
  return { cover: !!job.cover?.text, voice: job.voice || 'af_heart', speed: Number(job.speed) || 1.06, seed: job.site || job.id, mascot: job.mascot || 'buddy', beats };
}
