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
export function nameScript(site, name, { seed = 0, sayDomain } = {}) {
  const pick = (list, k) => list[(seed + k) % list.length];
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
