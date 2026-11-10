// Widescreen (1920 x 1080) tutorial: the problem, why it happens, checking it on the site's own tool, the fixes
// one by one, and a close. Same beats, captions and timing machinery as the Shorts scene.
import { sealVisualTrack } from "@hypit/composition";
import type { VisualElement } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalWindow } from "@hypit/temporal";
import { buddy } from "./render.js";
import type { Beat, SceneOptions } from "./render.js";

const INK = "#14161C", WHITE = "#FFFFFF", CORAL = "#FF5A4E", GREEN = "#2FCB72";
/** Where the page recording is laid over the video (canvas pixels); build.mjs uses the same box. */
export const SCREEN = { x: 80, y: 256, w: 1180, h: 646 };

type Item = { label: string; value: string };
const parseItems = (raw: string): Item[] => raw.split("|").map(s => s.trim()).filter(Boolean).map(part => {
  const at = part.lastIndexOf("=");
  return { label: (at < 0 ? part : part.slice(0, at)).trim(), value: at < 0 ? "" : part.slice(at + 1).trim() };
});
const frames = (raw: string) => raw.split(",").map(s => s.trim()).filter(Boolean).map(Number);

export function renderTutorial(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  body: FontStackRef, display: FontStackRef, beats: readonly Beat[], options: SceneOptions) {
  assertTemporalWindowFor(window, { subjectId: options.id, timeline });
  const start = window.span.startFrame, end = window.span.endFrameExclusive;
  const [bg1 = "#16324F", bg2 = "#2A6F97", hi = "#FFC93C", mbody = "#FFC93C"] = options.theme.split(",").map(s => s.trim()).filter(Boolean);
  let order = 0;
  const texts: VisualElement[] = [];
  const OL = `0 5px 0 ${INK}, 3px 3px 0 ${INK}, -3px 3px 0 ${INK}, 3px -3px 0 ${INK}, -3px -3px 0 ${INK}`;
  const t = (id: string, value: string, size: number, color: string, face: FontStackRef, extra: { name: string; value: string | number }[] = []) => {
    const style = new Map<string, { name: string; value: string | number }>();
    for (const d of [{ name: "font-size", value: `${size}px` }, { name: "line-height", value: 1.12 }, { name: "color", value: color }, ...extra]) style.set(d.name, d);
    texts.push({ id, kind: "text", parent: "scene", order: ++order, text: value, fonts: face.faces, style: [...style.values()] });
    return `{{${id}}}`;
  };
  const fit = (text: string, base: number, room: number) => Math.round(Math.max(base * 0.6, Math.min(base, base * room / Math.max(1, text.length))));
  const outlined = [{ name: "text-shadow", value: OL }];
  const up = [{ name: "text-transform", value: "uppercase" }, { name: "letter-spacing", value: "0.07em" }];
  const pill = (k: string, text: string, d = 0) => text ? `<div class="kicker a" data-d="${d}">${t(`${k}-kicker`, text, 28, INK, body, up)}</div>` : "";
  const mascot = (mood: "happy" | "worried" | "shocked", cls = "") => `<div class="mascot ${cls}">${buddy({ body: mbody, mood })}</div>`;
  const coverLead = options.coverFrames > 0 && options.coverText ? options.coverFrames : 0;
  const tick = `<svg viewBox="0 0 40 40"><path d="M10 21L17 28L30 13" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const wrench = `<svg viewBox="0 0 120 120" class="tool"><path d="M78 14a26 26 0 0 0-30 34L14 82a10 10 0 0 0 14 14l34-34a26 26 0 0 0 34-30l-16 16-14-4-4-14z" fill="#E8ECF2" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/></svg>`;

  const sections = beats.map((beat, i) => {
    const base = i === 0 ? Math.max(beat.at.frame, start + coverLead) : beat.at.frame;
    const k = `b${i}`, cues = frames(beat.cues).map(f => Math.max(0, f - base));
    const cue = (n: number, fallback: number) => cues[n] ?? fallback;
    const items = parseItems(beat.items).slice(0, 6);
    switch (beat.kind) {
      case "hook": return `<section>${pill(k, beat.kicker)}
        <div class="htitle a" data-d="4">${t(`${k}-title`, beat.title, fit(beat.title, 118, 26), WHITE, display, outlined)}</div>
        ${beat.label ? `<div class="hsub a" data-d="14">${t(`${k}-label`, beat.label, 40, "#E6ECF5", body)}</div>` : ""}
        ${mascot("worried", "big a pp")}
        ${beat.bubble ? `<div class="bubble a pp" data-d="${cue(0, 30)}">${t(`${k}-q`, beat.bubble, fit(beat.bubble, 60, 9), INK, display)}</div>` : ""}
      </section>`;
      case "causes": return `<section>${pill(k, beat.kicker || "Why it happens")}
        <div class="stitle a" data-d="3">${t(`${k}-title`, beat.title, fit(beat.title, 76, 32), WHITE, display, outlined)}</div>
        <div class="grid g${Math.min(items.length, 4) > 2 ? 4 : 2}">${items.slice(0, 4).map((it, j) => `<div class="card a pp" data-d="${cue(j, 12 + j * 20)}">
          <span class="num">${t(`${k}-n${j}`, String(j + 1), 40, INK, display)}</span>
          <div class="ct">${t(`${k}-l${j}`, it.label, fit(it.label, 40, 26), INK, display)}${it.value ? `<div class="cv">${t(`${k}-v${j}`, it.value, fit(it.value, 28, 60), "#3B4250", body)}</div>` : ""}</div></div>`).join("")}</div>
        ${mascot("worried", "side a")}
      </section>`;
      case "screen": return `<section>${pill(k, beat.kicker || "Check it")}
        <div class="browser a" data-d="0"><div class="bar"><i></i><i></i><i></i><span class="url">${t(`${k}-url`, beat.note || options.brand, 24, "#5B6474", body)}</span></div><div class="page"></div></div>
        <div class="side-col">
          <div class="sctitle a" data-d="6">${t(`${k}-title`, beat.title, fit(beat.title, 54, 22), WHITE, display, outlined)}</div>
          ${items.slice(0, 4).map((it, j) => `<div class="check a" data-d="${cue(j, 30 + j * 30)}"><span class="ok">${tick}</span>${t(`${k}-c${j}`, it.label, fit(it.label, 32, 30), WHITE, body)}</div>`).join("")}
        </div>
      </section>`;
      case "step": return `<section>${pill(k, beat.kicker || "Fix")}
        <div class="badge a pp" data-d="2">${t(`${k}-fixw`, "FIX", 34, INK, display)}${t(`${k}-fixn`, beat.value || String(i), 110, INK, display)}</div>
        <div class="steptitle a" data-d="8">${t(`${k}-title`, beat.title, fit(beat.title, 80, 24), WHITE, display, outlined)}</div>
        <div class="lines">${items.slice(0, 3).map((it, j) => `<div class="line a" data-d="${cue(j, 24 + j * 30)}"><span class="arrow">&#10148;</span><div>${t(`${k}-s${j}`, it.label, fit(it.label, 38, 44), WHITE, body)}${it.value ? `<div class="lv">${t(`${k}-sv${j}`, it.value, 28, "#C9D3E2", body)}</div>` : ""}</div></div>`).join("")}</div>
        <div class="fixer a pp" data-d="10">${mascot("happy", "side")}${wrench}</div>
      </section>`;
      default: return `<section>${pill(k, beat.kicker || "Test yours free")}
        <div class="ctitle a" data-d="4">${t(`${k}-title`, beat.title, fit(beat.title, 96, 26), WHITE, display, outlined)}</div>
        <div class="plate a pp" data-d="${cue(0, 24)}">${t(`${k}-plate`, beat.plate || options.brand, fit(beat.plate || options.brand, 84, 16), INK, display)}</div>
        ${items.length ? `<div class="recap">${items.slice(0, 4).map((it, j) => `<div class="rc a" data-d="${40 + j * 8}"><span class="ok">${tick}</span>${t(`${k}-r${j}`, it.label, 28, WHITE, body)}</div>`).join("")}</div>` : ""}
        ${mascot("happy", "big a pp wave")}
      </section>`;
    }
  });

  const captions = options.captions.split("|").filter(Boolean).map((raw, j) => {
    const [a, b, text] = raw.split("~");
    if (a === undefined || b === undefined || text === undefined) throw new Error(`Caption "${raw}" needs start~end~text.`);
    return { s: Number(a) - start, e: Number(b) - start, html: `<div class="cap">${t(`cap-${j}`, text, fit(text, 50, 52), /\d/.test(text) ? hi : WHITE, body, [{ name: "text-shadow", value: `0 3px 0 ${INK}, 2px 2px 0 ${INK}, -2px 2px 0 ${INK}, 2px -2px 0 ${INK}, -2px -2px 0 ${INK}` }])}</div>` };
  });
  const chapters = beats.map((b, i) => b.kind === "step" ? `Fix ${b.value || i}` : b.kind === "hook" ? "Problem" : b.kind === "causes" ? "Causes" : b.kind === "screen" ? "Test" : "Done");
  const coverOn = options.coverFrames > 0 && !!options.coverText;
  const cText = options.coverText.toUpperCase();
  const rays = Array.from({ length: 20 }, (_, j) => { const a0 = (j / 20) * Math.PI * 2, a1 = a0 + Math.PI / 20;
    return `M1400 560 L${(1400 + Math.cos(a0) * 2400).toFixed(0)} ${(560 + Math.sin(a0) * 2400).toFixed(0)} L${(1400 + Math.cos(a1) * 2400).toFixed(0)} ${(560 + Math.sin(a1) * 2400).toFixed(0)}Z`; }).join(" ");
  const cover = coverOn ? `<div class="cover"><svg class="rays" viewBox="0 0 1920 1080"><path d="${rays}" fill="rgba(255,255,255,.08)"/></svg>
      <div class="cbrand"><span class="mark">${t("cv-mark", options.brand.charAt(0).toUpperCase(), 34, INK, display)}</span>${t("cv-name", options.brand.replace(/\.[a-z.]+$/i, ""), 38, WHITE, display, outlined)}</div>
      <div class="ctext">${t("cv-text", cText, cText.length <= 14 ? 170 : cText.length <= 22 ? 140 : 118, hi, display, [{ name: "line-height", value: 1.0 }, { name: "text-shadow", value: `0 9px 0 ${INK}, 5px 5px 0 ${INK}, -5px 5px 0 ${INK}, 5px -5px 0 ${INK}, -5px -5px 0 ${INK}` }])}</div>
      ${options.coverNumber ? `<div class="cnum">${t("cv-num", options.coverNumber, fit(options.coverNumber, 64, 10), INK, display)}</div>` : ""}
      <div class="cmascot">${buddy({ body: mbody, mood: "shocked" })}</div>
      <div class="cq">${t("cv-q", "?", 230, WHITE, display, outlined)}</div></div>` : "";
  const coverFrames = coverOn ? options.coverFrames : 0;
  const program = htmlVisual({
    html: `<div class="bg"></div><div class="dots"></div>
      <header><span class="mark">${t("brand-mark", options.brand.charAt(0).toUpperCase(), 32, INK, display)}</span>${t("brand-name", options.brand, 34, WHITE, display, outlined)}</header>
      <nav>${beats.map((_, i) => `<b><u></u><s>${t(`ch-${i}`, chapters[i]!, 18, "#DDE5F0", body, up)}</s></b>`).join("")}</nav>
      ${sections.join("")}
      <div class="caps">${captions.map(c => c.html).join("")}</div>${cover}`,
    css: `:scope{background:${bg1};overflow:hidden}
      .bg{position:absolute;inset:0;background:radial-gradient(1400px 900px at 75% 30%,${bg2},${bg1})}
      .dots{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.07) 2px,transparent 2.5px) 0 0/44px 44px}
      header{position:absolute;left:80px;top:40px;display:flex;align-items:center;gap:14px}
      .mark{width:54px;height:54px;border-radius:13px;background:${hi};border:5px solid ${INK};display:flex;align-items:center;justify-content:center;box-shadow:0 5px 0 ${INK};box-sizing:border-box}
      nav{position:absolute;left:640px;right:80px;top:46px;display:flex;gap:10px}
      nav b{flex:1;position:relative;height:12px;border-radius:7px;background:rgba(255,255,255,.22);overflow:visible}
      nav u{display:block;height:100%;width:100%;border-radius:7px;background:${hi};transform-origin:left;transform:scaleX(0)}
      nav s{position:absolute;left:0;right:0;top:20px;text-align:center;white-space:nowrap;text-decoration:none;opacity:.8}
      section{position:absolute;left:0;top:0;width:1920px;height:1080px;visibility:hidden}
      .kicker{position:absolute;left:80px;top:148px;background:${hi};border:5px solid ${INK};border-radius:40px;padding:10px 26px 8px;box-shadow:0 5px 0 ${INK};white-space:nowrap}
      .htitle{position:absolute;left:80px;top:250px;width:1080px}
      .hsub{position:absolute;left:84px;top:640px;width:1000px}
      .mascot .car{width:100%;display:block;overflow:visible}
      .mascot.big{position:absolute;left:1210px;top:300px;width:620px;transform-origin:center bottom}
      .mascot.side{position:absolute;left:1440px;top:560px;width:400px}
      .bubble{position:absolute;left:1240px;top:190px;background:#fff;border:6px solid ${INK};border-radius:50px;padding:22px 36px 16px;box-shadow:0 7px 0 ${INK};white-space:nowrap;transform-origin:left bottom}
      .stitle,.ctitle{position:absolute;left:80px;top:230px;width:1700px}
      .grid{position:absolute;left:80px;top:360px;width:1300px;display:grid;grid-template-columns:1fr 1fr;gap:28px}
      .grid.g2{grid-template-columns:1fr}
      .card{background:#fff;border:6px solid ${INK};border-radius:22px;box-shadow:0 8px 0 ${INK};padding:22px 24px 18px;display:grid;grid-template-columns:64px 1fr;gap:18px;align-items:start;transform-origin:center;min-height:150px;box-sizing:border-box}
      .num{width:64px;height:64px;border-radius:50%;background:${hi};border:5px solid ${INK};display:flex;align-items:center;justify-content:center;box-sizing:border-box}
      .cv{margin-top:8px}
      .browser{position:absolute;left:${SCREEN.x}px;top:${SCREEN.y - 52}px;width:${SCREEN.w}px;height:${SCREEN.h + 52}px;background:#fff;border:6px solid ${INK};border-radius:20px;box-shadow:0 12px 0 rgba(0,0,0,.35);overflow:hidden;box-sizing:content-box;margin:-6px}
      .bar{height:52px;background:#E9EDF3;border-bottom:3px solid #CDD4DE;display:flex;align-items:center;gap:10px;padding:0 18px}
      .bar i{width:16px;height:16px;border-radius:50%;background:#C8CFDA}.bar i:first-child{background:${CORAL}}.bar i:nth-child(2){background:${hi}}.bar i:nth-child(3){background:${GREEN}}
      .url{margin-left:18px;flex:1;background:#fff;border-radius:20px;padding:6px 18px 4px;white-space:nowrap;overflow:hidden}
      .page{height:${SCREEN.h}px;background:#F3F5F8}
      .side-col{position:absolute;left:1310px;top:240px;width:540px}
      .sctitle{margin-bottom:34px}
      .check{display:flex;gap:16px;align-items:flex-start;margin-bottom:26px}
      .ok{flex:none;width:46px;height:46px;border-radius:50%;background:${GREEN};border:4px solid ${INK};display:flex;align-items:center;justify-content:center;box-sizing:border-box}.ok svg{width:30px;height:30px}
      .badge{position:absolute;left:80px;top:240px;width:220px;height:220px;border-radius:50%;background:${hi};border:8px solid ${INK};box-shadow:0 10px 0 ${INK};display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;transform-origin:center}
      .steptitle{position:absolute;left:350px;top:262px;width:1000px}
      .lines{position:absolute;left:350px;top:500px;width:1000px}
      .line{display:flex;gap:20px;align-items:flex-start;margin-bottom:30px}
      .arrow{flex:none;width:50px;height:50px;border-radius:14px;background:rgba(255,255,255,.14);border:3px solid rgba(255,255,255,.4);color:${hi};font-size:28px;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
      .lv{margin-top:6px}
      .fixer{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:1640px 800px}
      .tool{position:absolute;left:1420px;top:520px;width:150px;transform:rotate(-20deg)}
      .ctitle{top:260px;text-align:center;left:110px;width:1700px}
      .plate{position:absolute;left:50%;top:430px;transform-origin:center;background:${hi};border:8px solid ${INK};border-radius:20px;padding:26px 52px 18px;box-shadow:0 10px 0 ${INK};white-space:nowrap}
      .recap{position:absolute;left:180px;top:640px;width:900px}
      .rc{display:flex;gap:14px;align-items:center;margin-bottom:16px}
      .wave{left:1280px;top:470px;width:520px}
      .caps{position:absolute;left:120px;right:120px;top:952px;height:100px}
      .cap{position:absolute;left:0;right:0;top:50%;text-align:center;visibility:hidden}
      .wh,.eye,.wiper,.arm-l{transform-origin:0 0}
      .cover{position:absolute;inset:0;background:radial-gradient(1200px 900px at 70% 50%,${bg2},${bg1});overflow:hidden}
      .rays{position:absolute;inset:0;width:1920px;height:1080px}
      .cbrand{position:absolute;left:90px;top:70px;display:flex;align-items:center;gap:14px}
      .ctext{position:absolute;left:90px;top:190px;width:1080px;height:640px;display:flex;align-items:center}
      .cnum{position:absolute;left:96px;top:860px;background:#fff;border:7px solid ${INK};border-radius:18px;padding:16px 32px 10px;box-shadow:0 8px 0 ${INK};transform:rotate(-2deg)}
      .cmascot{position:absolute;left:1190px;top:260px;width:680px}
      .cmascot .car{width:100%;display:block;overflow:visible}
      .cq{position:absolute;left:1700px;top:120px;transform:rotate(14deg)}`,
    data: { times: beats.map((b, i) => i === 0 ? Math.max(b.at.frame - start, coverFrames) : b.at.frame - start), end: end - start, tr: options.transitionFrames, cover: coverFrames,
      caps: captions.map(c => [c.s, c.e]) },
    setup: `const secs=[...root.querySelectorAll('section')], bars=[...root.querySelectorAll('nav u')], caps=[...root.querySelectorAll('.cap')];
      const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-Math.pow(1-clamp(x),3);
      const back=x=>{x=clamp(x);const c=1.8;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
      const cov=root.querySelector('.cover'), dots=root.querySelector('.dots');
      return frame=>{
        const T=data.times, n=T.length;
        if(cov){const q=frame-data.cover;cov.style.visibility=q<10?'visible':'hidden';cov.style.opacity=String(q<0?1:1-clamp(q/10));}
        if(dots) dots.style.transform='translate('+(-(frame*0.4)%44)+'px,'+(-(frame*0.25)%44)+'px)';
        secs.forEach((s,i)=>{
          const a=T[i], b=i+1<n?T[i+1]:data.end, on=frame>=a&&frame<b;
          s.style.visibility=on?'visible':'hidden';
          if(!on) return;
          const age=frame-a, left=b-frame, out=i+1<n?ease(1-left/data.tr):0, inn=ease(age/12);
          s.style.opacity=String(Math.min(inn,1-out));
          s.style.transform='translateY('+((1-inn)*30-out*20)+'px)';
          s.querySelectorAll('.a').forEach(el=>{const d=Number(el.dataset.d||0), x=(age-d)/12;
            el.style.opacity=String(clamp(x*2.5));
            const pre=el.classList.contains('plate')?'translateX(-50%) ':'';
            el.style.transform=pre+(el.classList.contains('pp')?'scale('+(age<d?0.4:0.4+0.6*back(x))+')':'translateY('+(28*(1-ease(x)))+'px)');});
          s.querySelectorAll('.bd').forEach(bd=>{bd.style.transform='translateY('+(Math.sin(age*0.12)*5)+'px)';});
          s.querySelectorAll('.arm-l').forEach(w=>{w.style.transform='rotate('+(Math.sin(age*(s.querySelector('.wave')?0.35:0.1)+1)*(s.querySelector('.wave')?18:6))+'deg)';});
          s.querySelectorAll('.eye').forEach(e=>{const ph=age%110;e.style.transform='scaleY('+(ph<4?0.15:1)+')';});
          s.querySelectorAll('.tool').forEach(w=>{w.style.transform='rotate('+(-20+Math.sin(age*0.3)*14)+'deg)';});
        });
        caps.forEach((c,j)=>{const [a,b]=data.caps[j], on=frame>=a&&frame<b;
          c.style.visibility=on?'visible':'hidden';
          if(on){const x=(frame-a)/5;c.style.transform='translateY(-50%) translateY('+(10*(1-ease(x)))+'px)';c.style.opacity=String(clamp(x*2));}});
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
