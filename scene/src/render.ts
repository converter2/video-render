import { sealVisualTrack } from "@hypit/composition";
import type { VisualElement } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalInstant, TemporalWindow } from "@hypit/temporal";

export type BeatKind = "hook" | "stat" | "bars" | "rank" | "columns" | "list" | "showcase" | "close";
/** `cues` holds absolute frames, one per revealed element, in reveal order. */
export type Beat = { id: string; kind: BeatKind; kicker: string; title: string; value: string; label: string; items: string;
  note: string; cues: string; variants: string; bubble: string; plate: string; tone: string; parts: string; image: string; at: TemporalInstant };
/** `captions` is "startFrame~endFrame~text|..." on the film clock; `theme` is "bg1,bg2,highlight,mascotBody". */
export type SceneOptions = { id: string; brand: string; source: string; transitionFrames: number; captions: string; theme: string; mascot: string;
  coverText: string; coverNumber: string; coverFrames: number };

const INK = "#14161C", WHITE = "#FFFFFF", CORAL = "#FF5A4E", GREEN = "#2FCB72", ROAD = "#30343F", GRASS = "#3FC26A";
const MINI = ["#3D7BFF", "#FF9F1C", "#19C3B3", "#8B5CF6", "#FF5A4E", "#2FCB72"];
type Theme = { bg1: string; bg2: string; hi: string; body: string };

type Item = { label: string; value: string; num: number };
const parseItems = (raw: string): Item[] => raw.split("|").map(s => s.trim()).filter(Boolean).map(part => {
  const at = part.lastIndexOf("=");
  const label = (at < 0 ? part : part.slice(0, at)).trim(), value = at < 0 ? "" : part.slice(at + 1).trim();
  const num = Number(value.replace(/[^0-9.]/g, "")) || 0;
  return { label, value, num };
});
const frames = (raw: string) => raw.split(",").map(s => s.trim()).filter(Boolean).map(Number);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

type CarLook = { body: string; extras?: string; mood?: "happy" | "worried" | "shocked"; shine?: boolean };
const twinkle = `<g class="twinkle"><path d="M70 40 l6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6z" fill="#fff" stroke="${INK}" stroke-width="4"/>
  <path d="M380 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#fff" stroke="${INK}" stroke-width="3"/></g>`;
const eye = (x: number, y: number, rx: number, ry: number, px: number) => `<g transform="translate(${x} ${y})"><g class="eye">
  <ellipse rx="${rx}" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="5"/><circle cx="${px}" cy="3" r="${rx * 0.45}" fill="${INK}"/>
  <circle cx="${px + 2}" cy="-1" r="${rx * 0.15}" fill="#fff"/></g></g>`;

/** Mascot one: a side-on hatchback facing right with a face in its windscreen. */
function car(look: CarLook): string {
  const k = INK;
  const wheel = (x: number) => `<g transform="translate(${x} 190)"><g class="wh">
    <circle r="38" fill="#2A2D36" stroke="${k}" stroke-width="7"/><circle r="17" fill="#D5DCE6" stroke="${k}" stroke-width="5"/>
    <path d="M0 -17V17M-17 0H17" stroke="${k}" stroke-width="4"/></g></g>`;
  const happy = look.mood === undefined || look.mood === "happy", shocked = look.mood === "shocked";
  return `<svg viewBox="0 0 420 250" class="car" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="220" cy="226" rx="186" ry="13" fill="rgba(0,0,0,.22)"/>
    <g class="bd">
      <circle cx="120" cy="190" r="47" fill="${k}"/><circle cx="318" cy="190" r="47" fill="${k}"/>
      <path d="M40 186 L36 140 Q36 118 58 112 L120 102 L168 52 Q178 42 194 42 L292 42 Q308 42 318 56 L352 102 L380 108 Q402 113 404 136 L406 176 Q406 190 392 190 L48 190 Q40 190 40 186 Z" fill="${look.body}" stroke="${k}" stroke-width="8" stroke-linejoin="round"/>
      <path d="M60 128 Q200 118 398 132" stroke="rgba(255,255,255,.45)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M178 60 Q184 54 196 54 L288 54 Q298 54 304 62 L334 102 L146 102 Z" fill="#BDEBFF" stroke="${k}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M186 66 L206 66 L176 94 L160 94 Z" fill="rgba(255,255,255,.7)"/>
      <path d="M238 54V102" stroke="${k}" stroke-width="7"/>
      <path d="M232 106V176" stroke="${k}" stroke-width="5" opacity=".45"/><rect x="246" y="116" width="28" height="8" rx="4" fill="${k}" opacity=".6"/>
      ${eye(270, 80, 15, 18, 4)}${eye(306, 82, 13, 16, 4)}
      <g class="brow" opacity="${happy ? 0 : 1}"><path d="M252 58 L284 66M294 68 L320 62" stroke="${k}" stroke-width="6" stroke-linecap="round"/></g>
      <path class="ms" d="M356 150 Q374 168 394 150" stroke="${k}" stroke-width="7" fill="none" stroke-linecap="round" opacity="${happy ? 1 : 0}"/>
      <path class="mf" d="M358 162 Q376 146 394 162" stroke="${k}" stroke-width="7" fill="none" stroke-linecap="round" opacity="${happy || shocked ? 0 : 1}"/>
      ${shocked ? `<ellipse cx="378" cy="156" rx="11" ry="15" fill="${k}"/><path d="M252 50 L284 58M294 58 L320 50" stroke="${k}" stroke-width="6" stroke-linecap="round"/>` : ""}
      <ellipse class="hl" cx="394" cy="126" rx="9" ry="12" fill="#FFF3A0" stroke="${k}" stroke-width="5"/>
      <ellipse class="hl-off" cx="394" cy="126" rx="9" ry="12" fill="#4A4F5C" stroke="${k}" stroke-width="5" opacity="0"/>
      <rect class="tl" x="34" y="124" width="14" height="22" rx="4" fill="#FF4B3E" stroke="${k}" stroke-width="5"/>
      <rect class="tl-off" x="34" y="124" width="14" height="22" rx="4" fill="#4A4F5C" stroke="${k}" stroke-width="5" opacity="0"/>
      <g transform="translate(326 100)"><g class="wiper"><path d="M0 0 L-34 -36" stroke="${k}" stroke-width="6" stroke-linecap="round"/></g></g>
      ${look.extras ?? ""}
    </g>
    ${wheel(120)}${wheel(318)}
    ${look.shine ? twinkle : ""}
  </svg>`;
}

/** Mascot two: a round friendly character for sites that are not about cars. Same viewBox and classes as the car. */
function buddy(look: CarLook): string {
  const k = INK, happy = look.mood === undefined || look.mood === "happy", shocked = look.mood === "shocked";
  return `<svg viewBox="0 0 420 250" class="car buddy" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="210" cy="234" rx="92" ry="10" fill="rgba(0,0,0,.22)"/>
    <g class="bd">
      <g class="ft"><ellipse cx="172" cy="226" rx="26" ry="13" fill="${k}"/><ellipse cx="248" cy="226" rx="26" ry="13" fill="${k}"/></g>
      <g transform="translate(130 130)"><g class="arm-l"><path d="M0 0 Q-34 6 -44 -22" stroke="${k}" stroke-width="13" fill="none" stroke-linecap="round"/></g></g>
      <g transform="translate(290 130)"><g class="wiper"><path d="M0 0 Q34 6 44 -22" stroke="${k}" stroke-width="13" fill="none" stroke-linecap="round"/></g></g>
      <rect x="120" y="22" width="180" height="198" rx="76" fill="${look.body}" stroke="${k}" stroke-width="8"/>
      <path d="M150 52 Q170 36 196 34" stroke="rgba(255,255,255,.55)" stroke-width="10" fill="none" stroke-linecap="round"/>
      ${eye(182, 100, 19, 23, 3)}${eye(240, 100, 19, 23, 3)}
      <g class="brow" opacity="${happy ? 0 : 1}"><path d="M158 68 L196 78M226 78 L264 68" stroke="${k}" stroke-width="7" stroke-linecap="round"/></g>
      <ellipse cx="160" cy="146" rx="13" ry="8" fill="#FF8FA3" opacity=".75"/><ellipse cx="262" cy="146" rx="13" ry="8" fill="#FF8FA3" opacity=".75"/>
      <path class="ms" d="M186 146 Q211 172 236 146" stroke="${k}" stroke-width="8" fill="none" stroke-linecap="round" opacity="${happy ? 1 : 0}"/>
      <path class="mf" d="M188 162 Q211 142 234 162" stroke="${k}" stroke-width="8" fill="none" stroke-linecap="round" opacity="${happy || shocked ? 0 : 1}"/>
      ${shocked ? `<ellipse cx="211" cy="160" rx="16" ry="21" fill="${k}"/><path d="M160 58 L198 52M224 52 L262 58" stroke="${k}" stroke-width="7" stroke-linecap="round"/>` : ""}
      <g class="hl"></g><g class="hl-off"></g><g class="tl"></g><g class="tl-off"></g><g class="wh"></g><g class="wh"></g>
      ${look.extras ?? ""}
    </g>
    ${look.shine ? twinkle : ""}
  </svg>`;
}

const rust = `<g fill="#B5651D" stroke="${INK}" stroke-width="3"><circle cx="80" cy="166" r="9"/><circle cx="200" cy="172" r="7"/><circle cx="276" cy="160" r="6"/><circle cx="366" cy="174" r="8"/></g>`;
const dust = `<g fill="rgba(90,70,40,.35)"><circle cx="90" cy="150" r="8"/><circle cx="170" cy="160" r="6"/><circle cx="300" cy="150" r="7"/></g>`;
const plaster = `<g transform="translate(150 140) rotate(-18)"><rect x="-26" y="-9" width="52" height="18" rx="6" fill="#F5C08A" stroke="${INK}" stroke-width="4"/>
  <rect x="-9" y="-26" width="18" height="52" rx="6" fill="#F5C08A" stroke="${INK}" stroke-width="4"/></g>`;
const badge = (inner: string, fill: string) => `<g transform="translate(170 140)"><circle r="24" fill="${fill}" stroke="${INK}" stroke-width="5"/>${inner}</g>`;
const leaf = badge(`<path d="M-11 9 Q-12 -12 12 -12 Q12 10 -11 9Z M-11 9 L4 -4" fill="#fff" stroke="${INK}" stroke-width="3"/>`, GREEN);
const bolt = badge(`<path d="M4 -15 L-9 3 H0 L-4 15 L9 -3 H0Z" fill="#FFD500" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`, INK);
const drop = badge(`<path d="M0 -14 Q11 2 8 7 A8 8 0 0 1 -8 7 Q-11 2 0 -14Z" fill="${CORAL}" stroke="${INK}" stroke-width="3"/>`, "#fff");
const smoke = (dark: boolean) => `<g class="smoke">${[0, 1, 2].map(i => `<circle class="puff" data-o="${i * 12}" cx="22" cy="176" r="14" fill="${dark ? "#4A4F5C" : "#D9DEE6"}" stroke="${INK}" stroke-width="4"/>`).join("")}</g>`;
const variantLook = (v: string, i: number, th: Theme): CarLook => {
  switch (v) {
    case "new": return { body: th.hi, shine: true };
    case "clean": return { body: "#FF9F1C" };
    case "dusty": return { body: "#3D7BFF", extras: dust };
    case "rusty": return { body: "#8B5CF6", extras: rust + smoke(false), mood: "worried" };
    case "old": return { body: "#9AA4B5", extras: rust + plaster + smoke(true), mood: "worried" };
    case "hybrid": return { body: GREEN, extras: leaf, shine: true };
    case "electric": return { body: "#19C3B3", extras: bolt };
    case "petrol": return { body: "#3D7BFF", extras: drop };
    case "diesel": return { body: "#9AA4B5", extras: smoke(true), mood: "worried" };
    case "best": return { body: th.hi, shine: true };
    case "worst": return { body: "#9AA4B5", mood: "worried" };
    default: return { body: MINI[i % MINI.length]! };
  }
};
// where each car part sits on the big car (canvas pixels), for fault cards that point at it
const PART_AT: Record<string, [number, number]> = { headlight: [394, 126], tyre: [318, 214], spring: [120, 214], wiper: [312, 82], taillight: [41, 135], brakes: [318, 190], exhaust: [30, 180], body: [220, 150] };

/** Every beat is one cartoon set; timing is resolved before rendering. */
export function renderScene(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  body: FontStackRef, display: FontStackRef, beats: readonly Beat[], options: SceneOptions) {
  assertTemporalWindowFor(window, { subjectId: options.id, timeline });
  const start = window.span.startFrame, end = window.span.endFrameExclusive;
  if (beats.some(b => b.at.frame < start || b.at.frame >= end)) throw new Error("Beats must start inside the scene's window.");
  const [bg1 = "#2A7BF5", bg2 = "#59C2FF", hi = "#FFD500", mbody = "#FFD500"] = options.theme.split(",").map(s => s.trim()).filter(Boolean);
  const th: Theme = { bg1, bg2, hi, body: mbody };
  const isCar = options.mascot !== "buddy";
  const mascot = (look: CarLook) => isCar ? car(look) : buddy(look);
  let order = 0;
  const texts: VisualElement[] = [];
  const OL = `0 6px 0 ${INK}, 3px 3px 0 ${INK}, -3px 3px 0 ${INK}, 3px -3px 0 ${INK}, -3px -3px 0 ${INK}, 0 -4px 0 ${INK}, 4px 0 0 ${INK}, -4px 0 0 ${INK}`;
  const t = (id: string, value: string, size: number, color: string, face: FontStackRef, extra: { name: string; value: string | number }[] = []) => {
    const style = new Map<string, { name: string; value: string | number }>();
    for (const d of [{ name: "font-size", value: `${size}px` }, { name: "line-height", value: 1.04 }, { name: "color", value: color }, ...extra]) style.set(d.name, d);
    texts.push({ id, kind: "text", parent: "scene", order: ++order, text: value, fonts: face.faces, style: [...style.values()] });
    return `{{${id}}}`;
  };
  const outlined = [{ name: "text-shadow", value: OL }, { name: "text-transform", value: "uppercase" }];
  const fit = (text: string, base: number, room: number) => Math.round(Math.max(base * 0.62, Math.min(base, base * room / Math.max(1, text.length))));
  const title = (k: string, text: string, size = 92, center = false) => text
    ? `<div class="title a${center ? " ctr" : ""}" data-d="2">${t(`${k}-title`, text, fit(text, size, center ? 19 : 22), WHITE, display, outlined)}</div>` : "";
  const kicker = (k: string, text: string) => text ? `<div class="kicker a pp" data-d="0">${t(`${k}-kicker`, text, 30, INK, body, [{ name: "letter-spacing", value: "0.08em" }, { name: "text-transform", value: "uppercase" }])}</div>` : "";

  const coverLead = options.coverFrames > 0 && options.coverText ? options.coverFrames : 0;
  const sections = beats.map((beat, i) => {
    const base = i === 0 ? Math.max(beat.at.frame, start + coverLead) : beat.at.frame;
    const k = `b${i}`, cues = frames(beat.cues).map(f => Math.max(0, f - base));
    const cue = (n: number, fallback: number) => cues[n] ?? fallback;
    const variants = beat.variants.split(",").map(s => s.trim());
    const bad = beat.tone === "bad";
    switch (beat.kind) {
      case "hook": return `<section>${kicker(k, beat.kicker)}
        <div class="hook-title">${title(k, beat.title, 124, true)}</div>
        <div class="drive" data-d="6" data-x0="-760" data-x1="0" data-dur="26" style="left:210px;top:650px;width:660px">${mascot({ body: th.body, shine: true })}</div>
        ${beat.bubble ? `<div class="bubble a pp" data-d="${cue(0, 30)}">${t(`${k}-q`, beat.bubble, fit(beat.bubble, 64, 6), INK, display)}<i></i><b></b></div>` : ""}
        ${beat.plate ? `<div class="plate a pp" data-d="${cue(0, 30) + 30}">${t(`${k}-value`, beat.plate, fit(beat.plate, 64, 14), INK, display, [{ name: "letter-spacing", value: "0.03em" }])}</div>` : ""}
      </section>`;
      case "stat": {
        const pctMode = /%\s*$/.test(beat.value);
        const pct = clamp01((Number(beat.value.replace(/[^0-9.]/g, "")) || 0) / 100), r = 230, len = 2 * Math.PI * r;
        const lit = Math.round(pct * 10);
        const minis = pctMode ? Array.from({ length: 10 }, (_, j) => {
          const marked = j < lit, fail = bad ? marked : !marked;
          return `<div class="mini a pp" data-d="${cue(1, 40) + j * 3}" style="left:${70 + (j % 5) * 190}px;top:${730 + Math.floor(j / 5) * 175}px">
            ${mascot({ body: fail ? CORAL : GREEN, mood: fail ? "worried" : "happy" })}
            <span class="tick ${fail ? "no" : "yes"}"><svg viewBox="0 0 40 40"><path d="${fail ? "M12 12L28 28M28 12L12 28" : "M10 21L17 28L30 13"}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>`;
        }).join("") : `<div class="drive" data-d="${cue(1, 30)}" data-x0="-900" data-x1="0" data-dur="22" style="left:290px;top:800px;width:500px">${mascot({ body: th.body, shine: !bad, mood: bad ? "worried" : "happy" })}</div>`;
        const ring = pctMode ? `<circle cx="300" cy="300" r="${r}" fill="none" stroke="${bad ? GREEN : CORAL}" stroke-width="56"/>
            <circle class="ring" data-d="${cue(0, 4) + 4}" data-p="${pct}" data-len="${len}" cx="300" cy="300" r="${r}" fill="none" stroke="${bad ? CORAL : GREEN}" stroke-width="56"
              stroke-dasharray="${len}" stroke-dashoffset="${len}" transform="rotate(-90 300 300)" stroke-linecap="round"/>
            <circle cx="300" cy="300" r="${r - 28}" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="300" cy="300" r="${r + 28}" fill="none" stroke="${INK}" stroke-width="6"/>`
          : `<path d="${Array.from({ length: 24 }, (_, j) => { const a = (j / 24) * Math.PI * 2, rr = j % 2 ? 250 : 290; return `${j ? "L" : "M"}${(300 + Math.cos(a) * rr).toFixed(1)} ${(300 + Math.sin(a) * rr).toFixed(1)}`; }).join(" ")}Z" fill="${th.hi}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
        return `<section>${kicker(k, beat.kicker)}
          <div class="gauge a pp" data-d="${cue(0, 4)}"><svg viewBox="0 0 600 600">
            <circle cx="300" cy="300" r="290" fill="${pctMode ? "#fff" : "none"}" stroke="${pctMode ? INK : "none"}" stroke-width="10"/>${ring}</svg>
            <div class="gv">${t(`${k}-value`, beat.value, fit(beat.value, 150, 5.5), INK, display)}</div>
            <div class="gl">${t(`${k}-label`, beat.label, fit(beat.label, 34, 18), INK, body, [{ name: "text-transform", value: "uppercase" }, { name: "letter-spacing", value: "0.05em" }])}</div></div>
          ${minis}
        </section>`;
      }
      case "bars": {
        const items = parseItems(beat.items).slice(0, 6), lanes = items.length, top = 330, h = Math.min(170, 780 / Math.max(1, lanes));
        const allPct = items.every(x => /%$/.test(x.value)), nums = items.map(x => x.num);
        const max = Math.max(...nums, 1), min = Math.min(...nums);
        const lo = allPct && min >= 30 ? Math.max(0, Math.floor(min / 10) * 10 - 10) : 0, hiV = allPct ? 100 : max * 1.04;
        const axisLabel = (v: number) => allPct ? `${Math.round(v)}%` : "";
        return `<section>${kicker(k, beat.kicker)}${title(k, beat.title, 84)}
          ${allPct ? `<div class="axis a" data-d="8" style="top:${top - 44}px">${t(`${k}-a0`, axisLabel(lo), 26, WHITE, display, outlined)}<span>${t(`${k}-a1`, axisLabel(hiV), 26, WHITE, display, outlined)}</span></div>` : ""}
          ${items.map((it, j) => {
            const d = cue(j, 10 + j * 8), y = top + j * h, frac = clamp01((it.num - lo) / Math.max(0.0001, hiV - lo));
            const trackW = 790, carW = 150, x1 = Math.round(frac * (trackW - carW));
            const best = it.num === max, worst = it.num === min && lanes > 1;
            const look = variantLook(variants[j] || (best ? "best" : worst ? "worst" : ""), j, th);
            return `<div class="lane" style="top:${y}px;height:${h - 18}px">
              <div class="ll a pp" data-d="${6 + j * 3}">${t(`${k}-l${j}`, it.label, fit(it.label, 32, 11), INK, body)}</div>
              <div class="track"><i class="finish"></i></div>
              <div class="drive" data-d="${d}" data-x0="-170" data-x1="${x1}" data-dur="22" style="left:250px;bottom:4px;width:${carW}px">${mascot(look)}</div>
              <div class="lv a pp ${best ? "best" : worst ? "worst" : ""}" data-d="${d + 20}" style="left:${Math.min(250 + x1 + carW - 10, 900)}px">${t(`${k}-v${j}`, it.value, fit(it.value, 40, 6), INK, display)}</div>
            </div>`;
          }).join("")}
        </section>`;
      }
      case "rank": {
        const items = parseItems(beat.items).slice(0, 5);
        const parts = beat.parts.split(",").map(s => s.trim());
        const carParts = isCar && items.length > 0 && items.every((_, j) => PART_AT[parts[j] || ""]);
        if (carParts) {
          const S = 760 / 420, ox = 160, oy = 430;
          const cards = [[600, 250], [600, 930], [30, 930], [30, 250], [315, 1060]] as const;
          const lines = items.map((_, j) => {
            const [px, py] = PART_AT[parts[j]!]!, [cx, cy] = cards[j]!, tx = ox + px * S, ty = oy + py * S;
            const sx = cx + 220, sy = cy < 600 ? cy + 118 : cy;
            return j === 4 ? "" : `<path class="lead" data-d="${cue(j, 12 + j * 8)}" d="M${sx} ${sy} L${tx} ${ty}" stroke="${INK}" stroke-width="6" stroke-dasharray="4 14" stroke-linecap="round" fill="none"/>
              <circle class="lead" data-d="${cue(j, 12 + j * 8)}" cx="${tx}" cy="${ty}" r="12" fill="${CORAL}" stroke="${INK}" stroke-width="5"/>`;
          }).join("");
          const partCue = (p: string) => { const j = parts.indexOf(p); return j >= 0 && j < items.length ? cue(j, 12 + j * 8) : -1; };
          return `<section class="faults" data-parts="${["headlight", "tyre", "spring", "wiper", "taillight"].map(partCue).join(",")}">${kicker(k, beat.kicker)}${title(k, beat.title, 92)}
            <svg class="leads" viewBox="0 0 1080 1160">${lines}</svg>
            <div class="bigcar">${car({ body: th.body })}</div>
            ${partCue("spring") >= 0 ? `<div class="spring a pp" data-d="${partCue("spring")}"><svg viewBox="0 0 60 120"><path d="M30 0 L8 12 L52 26 L8 40 L52 54 L8 68 L52 82 L8 96 L30 108" stroke="${INK}" stroke-width="7" fill="none" stroke-linejoin="round"/></svg>${t(`${k}-boing`, "BOING!", 40, th.hi, display, outlined)}</div>` : ""}
            ${items.map((it, j) => `<div class="fcard a pp" data-d="${cue(j, 12 + j * 8)}" style="left:${cards[j]![0]}px;top:${cards[j]![1]}px">
              <span class="fn">${t(`${k}-n${j}`, String(j + 1), 40, WHITE, display)}</span>
              <span class="fl">${t(`${k}-l${j}`, it.label, fit(it.label, 31, 20), INK, body, [{ name: "line-height", value: 1.12 }])}</span>
              <span class="fv">${t(`${k}-v${j}`, it.value, 42, CORAL, display)}</span></div>`).join("")}
          </section>`;
        }
        // any other list with values: numbered cards stack up beside a mascot that reacts
        return `<section class="stack${bad ? " bad" : ""}" data-worry="${bad ? cue(1, 30) : -1}">${kicker(k, beat.kicker)}${title(k, beat.title, 92)}
          <div class="sidekick">${mascot({ body: th.body })}</div>
          ${items.map((it, j) => `<div class="rcard a pp" data-d="${cue(j, 12 + j * 8)}" style="top:${300 + j * 150}px">
            <span class="fn ${j === 0 ? "first" : ""}">${t(`${k}-n${j}`, String(j + 1), 40, j === 0 ? INK : WHITE, display)}</span>
            <span class="fl">${t(`${k}-l${j}`, it.label, fit(it.label, 34, 24), INK, body, [{ name: "line-height", value: 1.12 }])}</span>
            ${it.value ? `<span class="fv">${t(`${k}-v${j}`, it.value, 42, bad ? CORAL : "#1B7F4A", display)}</span>` : ""}</div>`).join("")}
        </section>`;
      }
      case "list": {
        const items = parseItems(beat.items).slice(0, 5);
        return `<section class="stack">${kicker(k, beat.kicker)}${title(k, beat.title, 92)}
          <div class="sidekick">${mascot({ body: th.body, shine: true })}</div>
          ${items.map((it, j) => `<div class="rcard a pp" data-d="${cue(j, 12 + j * 8)}" style="top:${300 + j * 150}px">
            <span class="fn ok"><svg viewBox="0 0 40 40"><path d="M10 21L17 28L30 13" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <span class="fl">${t(`${k}-l${j}`, it.label, fit(it.label, 36, 24), INK, body, [{ name: "line-height", value: 1.12 }])}</span></div>`).join("")}
        </section>`;
      }
      case "columns": {
        const items = parseItems(beat.items).slice(0, 12), nums = items.map(x => x.num);
        const max = Math.max(...nums, 1), min = Math.min(...nums);
        const d0 = cue(0, 8);
        return `<section>${kicker(k, beat.kicker)}${title(k, beat.title, 88)}
          <div class="months">${items.map((it, j) => {
            const cls = it.num === max ? "hi" : it.num === min && items.length > 2 ? "lo" : "";
            const dj = cls === "lo" ? cue(1, d0 + 30) : d0 + j * 2;
            return `<div class="mcol ${cls}">
              ${cls === "hi" ? `<div class="crown a pp" data-d="${dj + 14}"><svg viewBox="0 0 100 70"><path d="M8 62 L4 16 L28 36 L50 6 L72 36 L96 16 L92 62Z" fill="${th.hi}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/></svg></div>` : ""}
              ${cls === "lo" ? `<div class="zzz" data-d="${dj + 10}">${t(`${k}-z`, "Zzz", 40, WHITE, display, outlined)}</div>` : ""}
              <div class="mv a pp" data-d="${dj + 8}">${t(`${k}-v${j}`, it.value, items.length > 8 ? 24 : 30, WHITE, display, outlined)}</div>
              <i class="rise" data-d="${dj}" style="height:${Math.round((it.num / max) * 560)}px"></i>
              <div class="ml">${t(`${k}-l${j}`, it.label, items.length > 8 ? 26 : 30, WHITE, display, outlined)}</div></div>`;
          }).join("")}</div>
        </section>`;
      }
      case "showcase": return `<section class="show">${kicker(k, beat.kicker)}${title(k, beat.title, 88)}
        <div class="phone a pp" data-d="4"><div class="screen"><div class="shot" style="background-image:url('${beat.image.replace(/'/g, "%27")}')"></div></div><i class="notch"></i></div>
        <div class="pointer">${mascot({ body: th.body, shine: true })}</div>
        ${beat.plate ? `<div class="tag a pp" data-d="${cue(0, 30)}">${t(`${k}-value`, beat.plate, fit(beat.plate, 46, 16), INK, display)}</div>` : ""}
      </section>`;
      case "close": {
        const confetti = Array.from({ length: 36 }, (_, j) => {
          const a = (j / 36) * Math.PI * 2 + (j % 3) * 0.2, v = 18 + (j * 7) % 14;
          return `<i class="cf" data-d="${cue(0, 20)}" data-vx="${(Math.cos(a) * v).toFixed(2)}" data-vy="${(Math.sin(a) * v - 14).toFixed(2)}" data-r="${(j * 47) % 360}"
            style="background:${[th.hi, CORAL, GREEN, "#19C3B3", "#3D7BFF", WHITE][j % 6]}"></i>`;
        }).join("");
        return `<section>${kicker(k, beat.kicker)}<div class="close-title">${title(k, beat.title, 104, true)}</div>
          <div class="drive wink" data-d="0" data-x0="900" data-x1="0" data-dur="20" style="left:260px;top:440px;width:560px">${mascot({ body: th.body, shine: true })}</div>
          <div class="burst">${confetti}</div>
          <div class="plate big-plate a pp" data-d="${cue(0, 20)}">${t(`${k}-value`, beat.plate || options.brand, fit(beat.plate || options.brand, 96, 12), INK, display, [{ name: "letter-spacing", value: "0.02em" }])}</div>
        </section>`;
      }
    }
  });

  const captions = options.captions.split("|").filter(Boolean).map((raw, j) => {
    const [a, b, text] = raw.split("~");
    if (a === undefined || b === undefined || text === undefined) throw new Error(`Caption "${raw}" needs start~end~text.`);
    return { s: Number(a) - start, e: Number(b) - start,
      html: `<div class="cap">${t(`cap-${j}`, text, fit(text, 100, 17), /\d/.test(text) ? th.hi : WHITE, display, outlined)}</div>` };
  });

  const brand = t("brand-mark", options.brand.charAt(0).toUpperCase(), 36, INK, display);
  const brandName = t("brand-name", options.brand.replace(/\.[a-z.]+$/i, ""), 40, WHITE, display, [{ name: "text-shadow", value: OL }]);
  const source = options.source ? t("source", options.source, 22, "#D6DBE4", body) : "";
  const clouds = [[60, 40, 1], [700, 120, 0.8], [380, 700, 0.7], [820, 860, 1.1], [-60, 1080, 0.9]].map(([x, y, s], j) =>
    `<div class="cloud" data-s="${0.25 + j * 0.08}" data-sc="${s}" style="left:${x}px;top:${y}px"><svg viewBox="0 0 260 120"><path d="M40 100 Q0 100 10 70 Q14 44 50 48 Q60 10 110 18 Q150 0 172 36 Q220 26 230 64 Q262 70 246 100Z" fill="#fff" opacity=".9"/></svg></div>`).join("");
  const ground = isCar
    ? `<div class="ground road"><div class="dashes"></div></div>`
    : `<div class="ground stage"><div class="dashes dots"></div></div>`;
  // the cover: the first frames of every video, designed as the thumbnail. Words and number sit in the middle band
  // (y 560 to 1340) that survives the 3:2 crop YouTube uses for Shorts thumbnails on the home page.
  const coverOn = options.coverFrames > 0 && !!options.coverText;
  const rays = Array.from({ length: 18 }, (_, j) => { const a0 = (j / 18) * Math.PI * 2, a1 = a0 + Math.PI / 18;
    return `M540 960 L${(540 + Math.cos(a0) * 1500).toFixed(0)} ${(960 + Math.sin(a0) * 1500).toFixed(0)} L${(540 + Math.cos(a1) * 1500).toFixed(0)} ${(960 + Math.sin(a1) * 1500).toFixed(0)}Z`; }).join(" ");
  const cText = options.coverText.toUpperCase();
  const cover = coverOn ? `<div class="cover">
      <svg class="rays" viewBox="0 0 1080 1920"><path d="${rays}" fill="rgba(255,255,255,.09)"/></svg>
      <div class="cbrand"><span class="mark">${t("cv-mark", options.brand.charAt(0).toUpperCase(), 36, INK, display)}</span><span>${t("cv-name", options.brand.replace(/\.[a-z.]+$/i, ""), 40, WHITE, display, [{ name: "text-shadow", value: OL }])}</span></div>
      ${options.coverNumber ? `<div class="cnum"><svg viewBox="0 0 600 600"><path d="${Array.from({ length: 28 }, (_, j) => { const a = (j / 28) * Math.PI * 2, rr = j % 2 ? 250 : 296; return `${j ? "L" : "M"}${(300 + Math.cos(a) * rr).toFixed(1)} ${(300 + Math.sin(a) * rr).toFixed(1)}`; }).join(" ")}Z" fill="${th.hi}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/></svg>
        <div class="cnv">${t("cv-num", options.coverNumber, fit(options.coverNumber, 150, 4.2), INK, display, [{ name: "letter-spacing", value: "-0.02em" }])}</div></div>` : ""}
      <div class="ctext${options.coverNumber ? "" : " big"}">${t("cv-text", cText, (cText.length <= 12 ? 172 : cText.length <= 18 ? 150 : 132) + (options.coverNumber ? 0 : 18), th.hi, display, [{ name: "text-shadow", value: `0 10px 0 ${INK}, 5px 5px 0 ${INK}, -5px 5px 0 ${INK}, 5px -5px 0 ${INK}, -5px -5px 0 ${INK}, 0 -6px 0 ${INK}, 6px 0 0 ${INK}, -6px 0 0 ${INK}` }, { name: "line-height", value: 1.0 }])}</div>
      <div class="cqm">${t("cv-q", "?", 210, WHITE, display, [{ name: "text-shadow", value: OL }])}</div>
      <div class="cmascot">${mascot({ body: th.body, mood: "shocked" })}</div>
      <svg class="cburst" viewBox="0 0 200 200"><path d="M100 10 L118 70 L180 52 L136 100 L190 140 L122 132 L112 192 L88 134 L24 160 L66 106 L12 64 L80 70Z" fill="${CORAL}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/></svg>
    </div>` : "";
  const coverFrames = coverOn ? options.coverFrames : 0;
  const program = htmlVisual({
    html: `<div class="sky"></div>${clouds}${ground}
      <header><span class="mark">${brand}</span><span class="name">${brandName}</span></header>
      <nav>${beats.map(() => "<b><u></u></b>").join("")}</nav>
      ${sections.map((s, i) => s.replace("<section", `<section data-i="${i}"`)).join("")}
      <div class="caps">${captions.map(c => c.html).join("")}</div>
      <footer>${source}</footer>${cover}`,
    css: `:scope{background:${th.bg1};overflow:hidden}
      .sky{position:absolute;inset:0;background:linear-gradient(180deg,${th.bg1} 0%,${th.bg2} 70%)}
      .cloud{position:absolute;width:260px;transform-origin:left top}.cloud svg{width:260px;display:block}
      .ground{position:absolute;left:0;right:0;top:1370px;bottom:0;box-shadow:0 -6px 0 ${INK}}
      .road{background:${ROAD};border-top:26px solid ${GRASS}}
      .stage{background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.62)),${th.bg1};border-top:22px solid ${th.hi}}
      .dashes{position:absolute;left:-200px;right:-200px;top:440px;height:16px;background:repeating-linear-gradient(90deg,#F4F6FA 0 90px,transparent 90px 170px)}
      .dashes.dots{top:30px;height:14px;opacity:.35;background:repeating-radial-gradient(circle at 7px 7px,#fff 0 6px,transparent 7px 46px);background-size:46px 14px}
      header{position:absolute;left:60px;top:64px;display:flex;align-items:center;gap:16px}
      .mark{width:62px;height:62px;border-radius:14px;background:${th.hi};border:5px solid ${INK};display:flex;align-items:center;justify-content:center;box-shadow:0 5px 0 ${INK}}
      nav{position:absolute;left:60px;right:60px;top:162px;display:flex;gap:10px}
      nav b{flex:1;height:16px;border-radius:8px;background:rgba(255,255,255,.35);border:4px solid ${INK};overflow:hidden}
      nav u{display:block;height:100%;width:100%;background:${th.hi};transform-origin:left;transform:scaleX(0)}
      footer{position:absolute;left:60px;right:60px;bottom:46px;text-align:center}
      section{position:absolute;left:0;top:210px;width:1080px;height:1160px;visibility:hidden}
      .kicker{position:absolute;left:60px;top:20px;background:${th.hi};border:5px solid ${INK};border-radius:40px;padding:12px 28px 10px;box-shadow:0 6px 0 ${INK};transform-origin:left center;max-width:900px}
      .title{position:absolute;left:60px;right:60px;top:96px}.title.ctr{text-align:center}
      .hook-title .title{top:110px}.close-title .title{top:100px}
      .car{width:100%;display:block;overflow:visible}
      .drive{position:absolute}
      .bubble{position:absolute;left:670px;top:500px;background:#fff;border:7px solid ${INK};border-radius:60px;padding:30px 40px 22px;box-shadow:0 8px 0 ${INK};transform-origin:left bottom;white-space:nowrap}
      .bubble i,.bubble b{position:absolute;background:#fff;border:6px solid ${INK};border-radius:50%}
      .bubble i{width:34px;height:34px;left:20px;bottom:-46px}.bubble b{width:20px;height:20px;left:-4px;bottom:-74px}
      .plate{position:absolute;left:50%;top:1020px;background:${th.hi};border:7px solid ${INK};border-radius:16px;padding:22px 40px 16px;box-shadow:0 10px 0 ${INK};white-space:nowrap;transform-origin:center}
      .big-plate{top:880px;padding:30px 54px 22px}
      .gauge{position:absolute;left:240px;top:110px;width:600px;height:600px;transform-origin:center}
      .gauge svg{width:600px;height:600px;display:block;filter:drop-shadow(0 10px 0 ${INK})}
      .gv{position:absolute;left:30px;right:30px;top:200px;text-align:center}.gl{position:absolute;left:110px;right:110px;top:370px;text-align:center}
      .mini{position:absolute;width:170px;transform-origin:center bottom}
      .tick{position:absolute;right:-6px;top:-14px;width:52px;height:52px;border-radius:50%;border:5px solid ${INK};display:flex;align-items:center;justify-content:center}
      .tick.yes{background:${GREEN}}.tick.no{background:${CORAL}}.tick svg{width:36px;height:36px}
      .axis{position:absolute;left:250px;right:40px;display:flex;justify-content:space-between}
      .lane{position:absolute;left:0;right:0}
      .ll{position:absolute;left:30px;top:50%;margin-top:-34px;width:200px;height:68px;background:#fff;border:5px solid ${INK};border-radius:16px;box-shadow:0 6px 0 ${INK};display:flex;align-items:center;justify-content:center;text-align:center;transform-origin:left center}
      .track{position:absolute;left:250px;right:40px;bottom:0;height:26px;background:${ROAD};border:5px solid ${INK};border-radius:14px;overflow:hidden}
      .finish{position:absolute;right:0;top:0;bottom:0;width:30px;background:repeating-conic-gradient(#fff 0 25%,${INK} 0 50%) 0 0/15px 15px}
      .lane .drive{bottom:14px}
      .lv{position:absolute;top:-6px;background:#fff;border:5px solid ${INK};border-radius:14px;padding:8px 14px 4px;box-shadow:0 5px 0 ${INK};transform-origin:left bottom;white-space:nowrap}
      .lv.best{background:${th.hi}}.lv.worst{background:#FFB3AC}
      .leads{position:absolute;left:0;top:0;width:1080px;height:1160px;overflow:visible}
      .bigcar{position:absolute;left:160px;top:430px;width:760px}
      .spring{position:absolute;left:300px;top:760px;display:flex;align-items:center;gap:6px;transform-origin:center}.spring svg{width:46px;height:92px}
      .fcard,.rcard{position:absolute;box-sizing:border-box;background:#fff;border:6px solid ${INK};border-radius:20px;box-shadow:0 8px 0 ${INK};padding:16px 20px 12px;display:grid;grid-template-columns:58px 1fr auto;gap:14px;align-items:center;transform-origin:center}
      .fcard{width:440px;min-height:110px}
      .rcard{left:330px;width:690px;min-height:118px}
      .fn{width:58px;height:58px;border-radius:50%;background:${CORAL};border:5px solid ${INK};display:flex;align-items:center;justify-content:center;box-sizing:border-box}
      .fn.first{background:${th.hi}}.fn.ok{background:${GREEN}}.fn svg{width:36px;height:36px}
      .stack:not(.bad) .fn:not(.first):not(.ok){background:#3D7BFF}
      .sidekick{position:absolute;left:-40px;top:760px;width:400px}
      .months{position:absolute;left:44px;right:44px;top:330px;height:720px;display:flex;gap:8px;align-items:flex-end}
      .mcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;height:100%}
      .mcol .rise{display:block;width:100%;border:5px solid ${INK};box-sizing:border-box;border-radius:14px 14px 6px 6px;background:#A9D8FF;transform-origin:bottom;box-shadow:0 6px 0 ${INK}}
      .mcol.hi .rise{background:${th.hi}}.mcol.lo .rise{background:${CORAL}}
      .mv{margin-bottom:10px;transform-origin:center bottom;white-space:nowrap}.ml{position:absolute;bottom:-58px;white-space:nowrap}
      .crown{width:76px;margin-bottom:6px;transform-origin:center bottom}.crown svg{width:76px;display:block}
      .zzz{position:absolute;bottom:420px;left:10px}
      .phone{position:absolute;left:300px;top:250px;width:480px;height:860px;background:${INK};border-radius:56px;padding:18px;box-sizing:border-box;box-shadow:0 12px 0 rgba(0,0,0,.35);transform-origin:center}
      .screen{width:100%;height:100%;border-radius:40px;overflow:hidden;background:#fff}
      .shot{width:100%;height:2400px;background-size:100% auto;background-repeat:no-repeat;background-position:top center}
      .notch{position:absolute;left:50%;top:30px;width:120px;height:26px;margin-left:-60px;border-radius:14px;background:${INK}}
      .pointer{position:absolute;left:-60px;top:820px;width:420px}
      .tag{position:absolute;right:40px;top:1000px;background:${th.hi};border:6px solid ${INK};border-radius:16px;padding:16px 26px 10px;box-shadow:0 8px 0 ${INK};transform-origin:right center;white-space:nowrap}
      .burst{position:absolute;left:540px;top:950px}
      .cf{position:absolute;width:20px;height:28px;border:4px solid ${INK};border-radius:4px;opacity:0}
      .caps{position:absolute;left:40px;right:40px;top:1440px;height:300px}
      .cap{position:absolute;left:0;right:0;top:50%;text-align:center;visibility:hidden}
      .wh,.eye,.wiper,.arm-l{transform-origin:0 0}
      .cover{position:absolute;inset:0;background:radial-gradient(900px 900px at 50% 50%,${th.bg2},${th.bg1});overflow:hidden;transform-origin:50% 50%}
      .rays{position:absolute;inset:0;width:1080px;height:1920px}
      .cbrand{position:absolute;left:0;right:0;top:330px;display:flex;justify-content:center;align-items:center;gap:16px}
      .cnum{position:absolute;left:330px;top:560px;width:420px;height:420px;transform:rotate(-6deg)}
      .cnum svg{width:420px;height:420px;display:block;filter:drop-shadow(0 14px 0 ${INK})}
      .cnv{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center}
      .ctext{position:absolute;left:40px;right:40px;top:975px;height:350px;display:flex;align-items:center;justify-content:center;text-align:center}
      .ctext.big{top:560px;height:760px}
      .cqm{position:absolute;right:50px;top:560px;transform:rotate(14deg)}
      .cmascot{position:absolute;left:90px;top:1330px;width:900px}
      .cburst{position:absolute;left:60px;top:620px;width:190px;transform:rotate(-12deg)}`,
    data: { times: beats.map((b, i) => i === 0 ? Math.max(b.at.frame - start, coverFrames) : b.at.frame - start), end: end - start, tr: options.transitionFrames, cover: coverFrames,
      caps: captions.map(c => [c.s, c.e]) },
    setup: `const secs=[...root.querySelectorAll('section')], bars=[...root.querySelectorAll('nav u')], caps=[...root.querySelectorAll('.cap')];
      const clouds=[...root.querySelectorAll('.cloud')], dashes=root.querySelector('.dashes');
      const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-Math.pow(1-clamp(x),3);
      const back=x=>{x=clamp(x);const c=2.2;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
      const elastic=x=>{x=clamp(x);return x===0||x===1?x:Math.pow(2,-10*x)*Math.sin((x*10-0.75)*2.094)+1;};
      const all=(s,q)=>s.querySelectorAll(q);
      const face=(root,worried)=>{const ms=root.querySelector('.ms'),mf=root.querySelector('.mf'),br=root.querySelector('.brow');if(!ms)return;ms.style.opacity=worried?'0':'1';mf.style.opacity=worried?'1':'0';br.style.opacity=worried?'1':'0';};
      const cov=root.querySelector('.cover');
      return frame=>{
        const T=data.times, n=T.length;
        if(cov){const q=frame-data.cover;cov.style.visibility=q<8?'visible':'hidden';cov.style.opacity=String(q<0?1:1-clamp(q/8));cov.style.transform='scale('+(q<0?1:1+0.5*ease(q/8))+')';}
        clouds.forEach(c=>{c.style.transform='translateX('+(((frame*Number(c.dataset.s)*2)%1500)-200)+'px) scale('+c.dataset.sc+')';});
        if(dashes) dashes.style.transform='translateX('+(-(frame*9)%170)+'px)';
        secs.forEach((s,i)=>{
          const a=T[i], b=i+1<n?T[i+1]:data.end, on=frame>=a&&frame<b;
          s.style.visibility=on?'visible':'hidden';
          if(!on) return;
          const age=frame-a, left=b-frame, out=i+1<n?ease(1-left/data.tr):0;
          const inn=i===0&&!data.cover?1:back(age/14);
          s.style.transform='translateX('+((1-inn)*1080-out*1080)+'px) rotate('+((1-inn)*4-out*3)+'deg)';
          all(s,'.a').forEach(el=>{const d=Number(el.dataset.d||0), x=(age-d)/12;
            el.style.opacity=String(clamp(x*2.5));
            el.style.transform=(el.classList.contains('plate')?'translateX(-50%) ':'')+(el.classList.contains('pp')?'scale('+(age<d?0:back(x))+') rotate('+((1-clamp(x))*-8)+'deg)':'translateY('+(40*(1-ease(x)))+'px)');});
          all(s,'.drive').forEach(el=>{const d=Number(el.dataset.d), x0=Number(el.dataset.x0), x1=Number(el.dataset.x1), dur=Number(el.dataset.dur);
            const p=clamp((age-d)/dur), e=ease(p), x=x0+(x1-x0)*e, moving=p>0&&p<1;
            const settle=p>=1?Math.sin((age-d-dur)*0.9)*Math.exp(-(age-d-dur)*0.18)*8:0;
            el.style.transform='translateX('+x+'px)';el.style.opacity=age<d?'0':'1';
            const bd=el.querySelector('.bd');
            if(bd) bd.style.transform='translateY('+(Math.sin(age*0.9)*(moving?4:1.5)-Math.abs(settle))+'px) rotate('+(moving?-1.5:settle*0.25)+'deg)';
            el.querySelectorAll('.wh').forEach(w=>w.style.transform='rotate('+((x-x0)*1.6)+'deg)');
          });
          all(s,'.buddy .wiper').forEach(w=>{w.style.transform='rotate('+(Math.sin(age*0.35)*-22)+'deg)';});
          all(s,'.buddy .arm-l').forEach(w=>{w.style.transform='rotate('+(Math.sin(age*0.35+1)*10)+'deg)';});
          all(s,'.buddy .ft').forEach(w=>{w.style.transform='translateY('+(Math.abs(Math.sin(age*0.45))*-4)+'px)';});
          all(s,'.eye').forEach((e,j)=>{const ph=age%96, wink=e.closest('.wink'), c=wink&&age>40&&age<52&&j===0?0.1:(ph<4?0.15:1);e.style.transform='scaleY('+c+')';});
          all(s,'.puff').forEach(p=>{const o=Number(p.dataset.o||0), q=((age+o)%36)/36;p.setAttribute('transform','translate('+(-q*60)+' '+(-q*40)+') scale('+(0.6+q)+')');p.style.opacity=String(1-q);p.style.transformOrigin='22px 176px';});
          all(s,'.twinkle').forEach(g=>{g.style.opacity=String(0.5+0.5*Math.sin(age*0.25));});
          all(s,'.ring').forEach(r=>{const p=ease((age-Number(r.dataset.d))/30)*Number(r.dataset.p);r.setAttribute('stroke-dashoffset',String(Number(r.dataset.len)*(1-p)));});
          all(s,'.rise').forEach(el=>{el.style.transform='scaleY('+elastic((age-Number(el.dataset.d||0))/26)+')';});
          all(s,'.lead').forEach(el=>{el.style.opacity=String(clamp((age-Number(el.dataset.d))/6));});
          all(s,'.zzz').forEach(z=>{const d=Number(z.dataset.d), q=age-d;z.style.opacity=String(clamp(q/8));z.style.transform='translate('+(Math.sin(q*0.15)*10)+'px,'+(-((q*1.2)%60))+'px)';});
          all(s,'.shot').forEach(sh=>{const q=clamp((age-20)/Math.max(30,(b-a)-30));sh.style.transform='translateY('+(-ease(q)*900)+'px)';});
          all(s,'.pointer .bd').forEach(bd=>{bd.style.transform='translateY('+(Math.sin(age*0.12)*6)+'px)';});
          all(s,'.cf').forEach(c=>{const d=Number(c.dataset.d), q=age-d;if(q<0){c.style.opacity='0';return;}
            const vx=Number(c.dataset.vx), vy=Number(c.dataset.vy);c.style.opacity=String(clamp(1-(q-30)/20));
            c.style.transform='translate('+(vx*q)+'px,'+(vy*q+0.55*q*q)+'px) rotate('+(Number(c.dataset.r)+q*14)+'deg)';});
          if(s.classList.contains('stack')){const w=Number(s.dataset.worry);const sk=s.querySelector('.sidekick');if(sk){face(sk,w>=0&&age>=w);const bd=sk.querySelector('.bd');if(bd)bd.style.transform='translateY('+(Math.sin(age*0.12)*5)+'px)';}}
          if(s.classList.contains('faults')){
            const [cHead,cTyre,cSpring,cWiper,cTail]=s.dataset.parts.split(',').map(Number), car=s.querySelector('.bigcar');
            const hl=car.querySelector('.hl-off'), tl=car.querySelector('.tl-off'), wi=car.querySelector('.wiper'), bd=car.querySelector('.bd');
            const flick=q=>q<0?0:(q<14?((Math.floor(q/2)%2)?1:0):1);
            hl.style.opacity=String(cHead>=0?flick(age-cHead):0);tl.style.opacity=String(cTail>=0?flick(age-cTail):0);
            const firstBad=Math.min(...[cHead,cTyre,cSpring,cWiper,cTail].filter(x=>x>=0).sort((x,y)=>x-y).slice(1,2).concat([1e9]));
            face(car,age>=firstBad);
            const wq=cWiper>=0?age-cWiper:-1;wi.style.transform='rotate('+(wq>0?Math.sin(wq*0.5)*38:0)+'deg)';
            const sq=cSpring>=0?age-cSpring:-1;bd.style.transformOrigin='120px 190px';
            bd.style.transform='translateY('+(sq>0?Math.abs(Math.sin(sq*0.45))*-26*Math.exp(-sq*0.03):Math.sin(age*0.12)*2)+'px) rotate('+(sq>0?-3:0)+'deg)';
            const front=car.querySelectorAll('.wh')[1];const tq=cTyre>=0?age-cTyre:-1;
            if(front) front.parentNode.setAttribute('transform','translate(318 '+(tq>0?198:190)+') scale(1 '+(tq>0?0.82:1)+')');
          }
        });
        caps.forEach((c,j)=>{const [a,b]=data.caps[j], on=frame>=a&&frame<b;
          c.style.visibility=on?'visible':'hidden';
          if(on){const x=(frame-a)/6;c.style.transform='translateY(-50%) scale('+(0.5+0.5*back(x))+') rotate('+(((j%2)?1:-1)*(2-2*clamp(x)))+'deg)';c.style.opacity=String(clamp(x*3));}});
        bars.forEach((u,i)=>{const a=T[i], b=i+1<n?T[i+1]:data.end;u.style.transform='scaleX('+clamp((frame-a)/(b-a))+')';});
      };`,
  });
  return sealVisualTrack({ id: options.id, timelineId: timeline.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: options.id, order: 0, z: 0, span: window.span,
      elements: [{ id: "scene", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "left", value: `${within.xPx}px` },
          { name: "top", value: `${within.yPx}px` }, { name: "width", value: `${within.widthPx}px` },
          { name: "height", value: `${within.heightPx}px` }] }, ...texts] }] });
}
