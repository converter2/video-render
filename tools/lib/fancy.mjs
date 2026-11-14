// Fancy text styles (real Unicode, the same kind a font generator site produces) and the "name in fonts" Shorts.
// These videos need no Claude: the name, the styles and the words are all made here.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', a = 'abcdefghijklmnopqrstuvwxyz';
const cp = n => String.fromCodePoint(n);
const block = (upper, lower, except = {}) => ch => {
  if (except[ch]) return except[ch];
  const u = A.indexOf(ch); if (u >= 0) return cp(upper + u);
  const l = a.indexOf(ch); if (l >= 0) return cp(lower + l);
  return ch;
};
const table = (from, to) => { const f = [...from], t = [...to]; return ch => { const i = f.indexOf(ch); return i < 0 ? ch : t[i]; }; };
const each = fn => s => [...s].map(fn).join('');

export const STYLES = [
  { key: 'cursive', name: 'Cursive', fn: each(block(0x1D4D0, 0x1D4EA)) },
  { key: 'gothic', name: 'Gothic', fn: each(block(0x1D504, 0x1D51E, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' })) },
  { key: 'bubble', name: 'Bubble', fn: each(block(0x24B6, 0x24D0)) },
  { key: 'bold', name: 'Bold', fn: each(block(0x1D5D4, 0x1D5EE)) },
  { key: 'smallcaps', name: 'Small caps', fn: each(table(a + A, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ' + 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ')) },
  { key: 'double', name: 'Double struck', fn: each(block(0x1D538, 0x1D552, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' })) },
  { key: 'squares', name: 'Squares', fn: s => each(block(0x1F130, 0x1F130))(s.toUpperCase()) },
  { key: 'script', name: 'Script', fn: each(block(0x1D49C, 0x1D4B6, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' })) },
  { key: 'mono', name: 'Typewriter', fn: each(block(0x1D670, 0x1D68A)) },
  { key: 'darkbubble', name: 'Dark bubble', fn: s => each(block(0x1F150, 0x1F150))(s.toUpperCase()) },
  { key: 'boldgothic', name: 'Bold gothic', fn: each(block(0x1D56C, 0x1D586)) },
  { key: 'hearts', name: 'Hearts', fn: s => `♡ ${s} ♡` },
  { key: 'sparkle', name: 'Sparkles', fn: s => `✧ ${each(block(0x1D4D0, 0x1D4EA))(s)} ✧` },
  { key: 'italic', name: 'Italic', fn: each(block(0x1D608, 0x1D622)) },
  { key: 'upside', name: 'Upside down', fn: s => [...s].reverse().map(table(a + A, 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz' + '∀qƆpƎℲפHIſʞ˥WNOԀQɹS┴∩ΛMX⅄Z')).join('') }
];

/** Twelve styles for one name: a fixed opening four (they read best), then a different mix each time. */
export function stylesFor(name, seed = 0) {
  const fixed = ['cursive', 'gothic', 'bubble', 'bold'];
  const rest = STYLES.filter(s => !fixed.includes(s.key));
  let r = seed || 1;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const mixed = rest.map(s => ({ s, k: rnd() })).sort((x, y) => x.k - y.k).map(x => x.s).slice(0, 8);
  return [...fixed.map(k => STYLES.find(s => s.key === k)), ...mixed].map(s => ({ label: s.name, value: s.fn(name) }));
}

// a few ways to say the same thing, so the titles of a long run of these do not all read alike
const TITLES = [
  n => `${n} in 12 fancy fonts`, n => `Your name in fonts: ${n}`, n => `${n} written 12 ways`,
  n => `${n} in cursive, gothic and bubble letters`, n => `Fancy text for the name ${n}`, n => `${n} name styles to copy and paste`
];
const HOOKS = [
  n => `${n}, in 12 fancy fonts.`, n => `Here is ${n}, written 12 different ways.`, n => `${n}. Which style is yours?`, n => `If your name is ${n}, this one is for you.`
];

/** The script for one name video. Only the words the voice says and the screen shows; the scene does the rest. */
// single letters (the /letters/a pages) get their own words
const LTITLES = [l => `Letter ${l} in different fonts`, l => `${l} in 12 fancy fonts`, l => `Fancy letter ${l} to copy and paste`, l => `The letter ${l} written 12 ways`];
const LHOOKS = [l => `The letter ${l}, in 12 fancy fonts.`, l => `Here is ${l}, written 12 different ways.`, l => `Letter ${l}. Which style is yours?`];

export function nameScript(site, name, { seed = 0, sayDomain, letter = false } = {}) {
  const pick = (list, k) => list[(seed + k) % list.length];
  if (letter) {
    const sc = nameScript(site, name, { seed, sayDomain });
    const spoken = sayDomain || site.domain;
    const say = t => [[{ show: t, say: t.split(site.domain).join(spoken) }]];
    sc.title = pick(LTITLES, 0)(name);
    sc.description = `The letter ${name} in cursive, gothic, bubble, small caps and more. Copy the style you like, or type any word, at ${site.domain}.`;
    sc.fb_caption = `Letter ${name} in 12 fonts. Which one would you pick?`;
    sc.hashtags = ['fonts', 'fancyletters', 'fancytext'];
    sc.beats[0].kicker = 'Letters in fonts'; sc.beats[0].lines = say(pick(LHOOKS, 1)(name));
    sc.beats[2].lines = say('Copy the one you like, and use it as an initial in your bio, your username or your game name.');
    sc.beats[3].lines = say(`Every letter, and any word you type, free at ${site.domain}.`);
    return sc;
  }
  const styles = stylesFor(name, seed);
  const spoken = sayDomain || site.domain;
  // the style pasted into the profile: one that reads well in a bio
  const nice = ['Sparkles', 'Double struck', 'Script', 'Hearts', 'Bold gothic', 'Cursive'];
  const fav = styles.filter(x => nice.includes(x.label))[seed % 2] || styles[0];
  const say = t => [[{ show: t, say: t.split(site.domain).join(spoken) }]];
  return {
    title: pick(TITLES, 0)(name),
    description: `${name} in cursive, gothic, bubble, small caps and more. Type any name and copy the style you like at ${site.domain}.`,
    fb_caption: `${name} in 12 fonts. Which one would you pick? Comment your name for the next one.`,
    hashtags: ['fonts', 'namestyle', 'fancytext'],
    cover: { text: name, number: '12 FONTS' },
    beats: [
      { kind: 'hook', kicker: 'Your name in fonts', title: name, lines: say(pick(HOOKS, 1)(name)) },
      { kind: 'fonts', kicker: 'Tap to copy', title: name, items: styles, lines: [[...styles.map(s => ({ show: s.label + '.', say: s.label + '.' }))]] },
      { kind: 'paste', kicker: 'Paste it anywhere', title: name, value: fav.value, label: fav.label,
        lines: say('Copy the one you like, and paste it into your bio, your username or your game name.') },
      { kind: 'close', kicker: 'Free', title: 'Type your name', plate: site.domain,
        lines: say(`Type your own name free at ${site.domain}. And comment yours for the next video.`) }
    ]
  };
}

// common first names, used once each (newest first in the queue); a few that read as religious titles are left out
export const NAMES = `Olivia Liam Emma Noah Amelia Oliver Sophia Elijah Charlotte James Ava William Isabella Benjamin Mia Lucas Evelyn Henry Harper Theodore
Luna Jack Camila Levi Gianna Alexander Elizabeth Jackson Eleanor Mateo Ella Daniel Abigail Michael Sofia Mason Avery Sebastian Scarlett Ethan Emily Logan Aria
Owen Penelope Samuel Chloe Jacob Layla Asher Mila Aiden Nora John Hazel Joseph Madison Wyatt Ellie David Lily Leo Nova Luke Isla Julian Grace Hudson Violet
Grayson Aurora Matthew Riley Ezra Zoey Gabriel Willow Carter Emilia Isaac Stella Jayden Zoe Luca Victoria Anthony Hannah Dylan Addison Lincoln Leah Thomas
Lucy Maverick Eliana Josiah Ivy Charles Everly Caleb Lillian Christopher Paisley Ezekiel Elena Miles Naomi Jaxon Maya Isaiah Natalie Andrew Kinsley Joshua
Delilah Nathan Claire Nolan Audrey Adrian Aaliyah Cameron Ruby Santiago Brooklyn Eli Alice Aaron Aubrey Ryan Autumn Angel Leilani Cooper Savannah Waylon
Valentina Easton Kennedy Kai Madelyn Christian Josephine Landon Bella Colton Skylar Roman Genesis Axel Sophie Brooks Hailey Jonathan Sadie Robert Natalia
Jameson Quinn Ian Caroline Everett Allison Greyson Gabriella Wesley Anna Jeremiah Serenity Hunter Nevaeh Leonardo Cora Jordan Ariana Jose Emery Bennett
Lydia Silas Jade Nicholas Sarah Parker Eva Beau Adeline Weston Madeline Austin Piper Connor Rylee Carson Athena Dominic Peyton Xavier Everleigh Jaxson
Vivian Jace Clara Emmett Raelynn Adam Liliana Declan Samantha Rowan Maria Micah Iris Kayden Ayla Gael Eloise River Lyla Ryder Eliza Kingston Hadley Damian
Melody Sawyer Julia Luka Parker Evan Rose Vincent Isabelle Legend Brielle Myles Adalynn Harrison Arya August Eden Bryson Remi Amir Mackenzie Giovanni Maeve
Chase Margaret Diego Reagan Milo Charlie Jasper Alaina Walker Adalyn Jason Josie Brayden Raegan Cole Juniper Nathaniel Alexandra Zion Kylie George Faith
Ali Fatima Omar Zara Ayaan Hana Yusuf Aisha Hamza Inaya Zayn Mariam Ibrahim Sara Rayan Noor Adam Laila Musa Amina Idris Safa Bilal Huda Arham Anaya
Freya Archie Isla Alfie Poppy Freddie Florence Arthur Evie Harry Phoebe Oscar Sienna Jacob Daisy Teddy Rosie Albert Matilda Reuben Esme Ronnie Elsie`
  .split(/\s+/).filter(Boolean).filter((n, i, all) => all.indexOf(n) === i);

/* ---------- page videos: a style page, a platform page or a symbol page ---------- */
// where the copied text goes, by page: "" a social bio, "short" a short-video profile, "name" the profile name,
// "chat" a chat app's profile, "game" a game's display-name screen
export const PLATFORMS = {
  instagram: { app: 'Instagram', where: '', kick: 'Paste it in your Instagram bio', say: 'paste it into your Instagram bio' },
  tiktok: { app: 'TikTok', where: 'short', kick: 'Paste it in your TikTok bio', say: 'paste it into your TikTok bio' },
  facebook: { app: 'Facebook', where: 'name', kick: 'Use it on Facebook', say: 'use it in your Facebook posts and bio' },
  twitter: { app: 'X and Twitter', where: 'name', kick: 'Use it as your display name', say: 'use it as your X display name' },
  discord: { app: 'Discord', where: 'chat', kick: 'Paste it as your Discord name', say: 'paste it as your Discord display name' },
  roblox: { app: 'Roblox', where: 'game', kick: 'Use it as your Roblox name', say: 'use it as your Roblox display name' },
  fortnite: { app: 'Fortnite', where: 'game', kick: 'Use it as your Fortnite name', say: 'use it as your Fortnite display name' },
  'free-fire-names': { app: 'Free Fire', where: 'game', kick: 'Use it as your Free Fire name', say: 'use it as your Free Fire name' }
};
// the words typed in, by kind of page (a different one each time)
const SAMPLES = {
  social: ['golden hour', 'good vibes', 'stay wild', 'dream big', 'little things', 'be kind', 'sunny days', 'slow mornings'],
  game: ['Shadow', 'NightWolf', 'Blaze', 'Phantom', 'Viper', 'Nova', 'Frost', 'Ace'],
  numbers: ['2026', '24/7', '1234567890', '99'],
  birthday: ['Happy birthday', 'Best day ever'],
  halloween: ['Spooky season', 'Boo'],
  christmas: ['Happy holidays', 'Snow day'],
  creepy: ['Hello', 'Wake up'], glitch: ['Error', 'Hello world'], 'weird-text': ['Hello', 'Weird'],
  tattoo: ['Family', 'Forever', 'Strength', 'Hope'],
  'nickname-generator': ['Shadow', 'Luna', 'Ace', 'Nova']
};
export function sampleFor(slug, seed) {
  const list = SAMPLES[slug] || (PLATFORMS[slug]?.where === 'game' || slug === 'discord' ? SAMPLES.game : PLATFORMS[slug] ? SAMPLES.social : null);
  if (list) return list[seed % list.length];
  return NAMES[(seed * 7) % NAMES.length];
}
const quiet = s => String(s).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
// "Cursive font generator" -> "cursive"; "Instagram fonts" -> "Instagram"
const styleWord = h1 => quiet(h1).replace(/\b(font|fonts|text|generator|copy and paste|maker|changer|symbol|symbols)\b/gi, '').replace(/\s+/g, ' ').trim();

export function pageScript(site, page, { seed = 0, sayDomain, slug = '' } = {}) {
  const pick = (list, k) => list[(seed + k) % list.length];
  const spoken = sayDomain || site.domain;
  const say = t => [[{ show: t, say: t.split(site.domain).join(spoken) }]];
  const rows = page.rows, n = rows.length, h1 = quiet(page.h1) || 'Fancy text', word = styleWord(h1) || 'fancy';
  const plat = PLATFORMS[slug];
  const lw = plat ? plat.app : word.toLowerCase();
  if (page.kind === 'symbols') {
    const deco = /heart|star|music|arrow|check|x-mark|bullet|peace|card|shape|asterisk|wingding|special/.test(slug);
    const fav = rows[seed % Math.min(3, n)];
    const name = NAMES[(seed * 11) % NAMES.length];
    const beats = [
      { kind: 'hook', kicker: 'Copy and paste', title: h1, label: 'Search', note: `${n} to copy`,
        lines: say(pick([`${h1}: ${n} you can copy and paste.`, `Need the ${h1.toLowerCase()}? Here are ${n}.`, `${h1}, ready to copy.`], 0)) },
      { kind: 'fonts', kicker: 'Tap to copy', title: h1, items: rows, lines: [[...rows.map(r => ({ show: quiet(r.label) + '.', say: quiet(r.label) + '.' }))]] }
    ];
    if (deco) beats.push({ kind: 'paste', kicker: 'Paste it anywhere', title: name, value: `${fav.value} ${name} ${fav.value}`, label: quiet(fav.label),
      lines: say(pick(['Tap one to copy it, then paste it into your bio, a message or your notes.', 'Copy one and paste it next to your name, in a message or in a document.'], 1)) });
    beats.push({ kind: 'close', kicker: 'Free', title: h1, note: 'More symbols on the site',
      lines: say(`Every ${h1.toLowerCase()}, with the codes to type it, free at ${site.domain}.`) });
    return {
      title: pick([`${h1} to copy and paste`, `${h1}: ${n} to copy`, `How to get the ${h1.toLowerCase()}`], 0),
      description: `${n} ${h1.toLowerCase()} characters to copy and paste, with names, codes and keyboard shortcuts at ${site.domain}.`,
      fb_caption: `${h1}: ${n} ready to copy. Which one do you use most?`,
      hashtags: ['symbols', 'copyandpaste', 'textsymbols'],
      cover: { text: [rows[0].value, rows[1]?.value || '', rows[2]?.value || '', h1].join('¦'), number: `${n} SYMBOLS` },
      beats
    };
  }
  // a style or platform page: the sample typed in, the page's own styles, pasted where it belongs
  const text = page.text;
  // the favourite (pasted, and big on the cover): a style that looks clearly different from plain text
  const plain = rows.filter(r => !/glitch|upside|mirror|strike|underline|zalgo|small caps|spaced|tiny|superscript|bold sans|^bold$|serif/i.test(r.label));
  const flair = r => /cursive|script|gothic|old english|fraktur|flower|wing|heart|sparkle|bubble|double|calligraph/i.test(r.label) ? 0 : 1;
  const pool = (plain.length ? plain : rows).map((r, i) => [r, i]).sort((x, y) => flair(x[0]) - flair(y[0]) || x[1] - y[1]).map(x => x[0]);
  const fav = pool[seed % Math.min(3, pool.length)];
  const titleWord = plat ? `${plat.app} fonts` : `${word} text`;
  return {
    title: pick(plat
      ? [`${plat.app} fonts to copy and paste`, `${n} ${plat.app} fonts for your profile`, `Fancy ${plat.app} fonts: ${text}`]
      : [`${word} font generator: ${text} in ${n} styles`, `${text} in ${lw} fonts`, `${word} text to copy and paste`, `${n} ${lw} fonts to copy and paste`], 0),
    description: `${text} in ${n} ${plat ? plat.app : lw} styles. Type your own words and copy any style at ${site.domain}.`,
    fb_caption: pick([`${text} in ${n} ${plat ? plat.app : lw} styles. Which one would you use?`, `${n} ${titleWord.toLowerCase()} styles. Pick a favourite.`], 2),
    hashtags: ['fonts', plat ? `${plat.app.replace(/\W/g, '').toLowerCase()}fonts` : `${word.replace(/\W/g, '').toLowerCase()}font`, 'fancytext'].slice(0, 3),
    cover: { text: [fav.value, rows.find(r => r !== fav)?.value || '', rows.filter(r => r !== fav)[1]?.value || '', plat ? `${plat.app} fonts` : `${word} fonts`].join('¦'), number: `${n} STYLES` },
    beats: [
      { kind: 'hook', kicker: h1, title: text, note: `${n} ${plat ? plat.app : lw} styles`,
        lines: say(pick([`${text}, in ${n} ${plat ? plat.app : lw} styles.`, `Type ${text} once, get ${n} ${plat ? plat.app : lw} styles.`, `Here is ${text} in ${lw} fonts.`], 1)) },
      { kind: 'fonts', kicker: 'Tap to copy', title: text, items: rows.map(({ label, value }) => ({ label, value })),
        lines: [[...rows.map(r => ({ show: quiet(r.label) + '.', say: quiet(r.label) + '.' }))]] },
      { kind: 'paste', kicker: plat ? plat.kick : 'Paste it anywhere', title: text, value: fav.value, label: quiet(fav.label), plate: plat ? plat.where : '',
        lines: say(plat ? `Copy the one you like and ${plat.say}.` : pick(['Copy the one you like, and paste it into your bio, your username or a caption.', 'Tap copy, then paste it wherever you want it to stand out.'], 2)) },
      { kind: 'close', kicker: 'Free', title: plat ? `${plat.app} fonts` : `${word} fonts`, note: 'Which style would you pick?',
        lines: say(`Type your own words free at ${site.domain}.`) }
    ]
  };
}
