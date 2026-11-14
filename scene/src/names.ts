// "Your name in fonts" Shorts (1080 x 1920): the name is typed into the generator's box, appears in a dozen
// Unicode styles one by one, gets pasted into a profile, and the video ends on the site. Plain type, the site's colours.
import { sealVisualTrack } from "@hypit/composition";
import type { VisualElement } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalWindow } from "@hypit/temporal";
import type { Beat, SceneOptions } from "./render.js";

const parseItems = (raw: string) => raw.split("|").map(s => s.trim()).filter(Boolean).map(part => {
  const at = part.indexOf("=");
  return { label: (at < 0 ? part : part.slice(0, at)).trim(), value: at < 0 ? "" : part.slice(at + 1).trim() };
});
const frames = (raw: string) => raw.split(",").map(s => s.trim()).filter(Boolean).map(Number);

export function renderNames(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  fancy: FontStackRef, ui: FontStackRef, beats: readonly Beat[], options: SceneOptions) {
  assertTemporalWindowFor(window, { subjectId: options.id, timeline });
  const start = window.span.startFrame, end = window.span.endFrameExclusive;
  const [bg1 = "#0B0C24", bg2 = "#1A2A8C", hi = "#2B59FF", gold = "#FFC83D"] = options.theme.split(",").map(s => s.trim()).filter(Boolean);
  const INK = "#14142B", WHITE = "#FFFFFF", MUTED = "#6B6F86";
  let order = 0;
  const texts: VisualElement[] = [];
  const t = (id: string, value: string, size: number, color: string, face: FontStackRef, extra: { name: string; value: string | number }[] = []) => {
    const style = new Map<string, { name: string; value: string | number }>();
    for (const d of [{ name: "font-size", value: `${size}px` }, { name: "line-height", value: 1.15 }, { name: "color", value: color }, { name: "white-space", value: "nowrap" }, ...extra]) style.set(d.name, d);
    texts.push({ id, kind: "text", parent: "scene", order: ++order, text: value, fonts: face.faces, style: [...style.values()] });
    return `{{${id}}}`;
  };
  const fit = (text: string, base: number, room: number) => Math.round(Math.max(base * 0.5, Math.min(base, base * room / Math.max(1, [...text].length))));
  // the site's logo: a letter in a rounded square, then the name ("e|fontgenerator"), or the first letter and the domain
  const [mk, wm] = options.brand.includes("|") ? options.brand.split("|") : [options.brand.charAt(0), options.brand.replace(/\.[a-z.]+$/i, "")];
  const brand = wm || options.brand;
  const mark = (k: string, s: number) => `<span class="mark" style="width:${s}px;height:${s}px;border-radius:${s * 0.28}px">${t(`${k}-e`, mk || "e", s * 0.72, WHITE, ui, [{ name: "line-height", value: 1 }])}</span>`;
  const coverLead = options.coverFrames > 0 && options.coverText ? options.coverFrames : 0;
  const shadow = [{ name: "text-shadow", value: "0 6px 30px rgba(0,0,0,.45)" }];

  const sections = beats.map((beat, i) => {
    const base = i === 0 ? Math.max(beat.at.frame, start + coverLead) : beat.at.frame;
    const k = `b${i}`, cues = frames(beat.cues).map(f => Math.max(0, f - base));
    const name = beat.title;
    switch (beat.kind) {
      case "hook": return `<section data-kind="hook">
        <div class="kicker a" data-d="0">${t(`${k}-kick`, beat.kicker, 30, WHITE, ui, [{ name: "letter-spacing", value: "0.08em" }, { name: "text-transform", value: "uppercase" }])}</div>
        <div class="box big a" data-d="4"><span class="lab">${t(`${k}-lab`, "Your text", 26, MUTED, ui)}</span>
          <div class="typed"><span class="clip">${t(`${k}-name`, name, fit(name, 150, 7), INK, ui, [])}</span><i class="caret"></i></div>
          <div class="row"><span class="count">${t(`${k}-cnt`, `${[...name].length} of 200 characters`, 24, MUTED, ui)}</span><span class="btn">${t(`${k}-btn`, "Copy all styles", 26, WHITE, ui)}</span></div></div>
        <div class="hint a" data-d="${(cues[0] ?? 20) + 26}">${t(`${k}-hint`, "12 styles", 64, gold, ui, [...shadow])}</div>
      </section>`;
      case "fonts": {
        const items = parseItems(beat.items).slice(0, 12);
        return `<section data-kind="fonts">
          <div class="box small">${t(`${k}-name`, name, 64, INK, ui, [])}<i class="caret on"></i></div>
          <div class="list"><div class="track">${items.map((it, j) => `<div class="card" data-d="${cues[j] ?? j * 22}">
            <div class="fx">${t(`${k}-v${j}`, it.value, fit(it.value, 76, 14), INK, fancy)}</div>
            <div class="meta"><span>${t(`${k}-l${j}`, it.label, 26, MUTED, ui)}</span><span class="copy">${t(`${k}-c${j}`, "Copy", 24, hi, ui)}</span></div></div>`).join("")}</div></div>
        </section>`;
      }
      case "paste": return `<section data-kind="paste">
        <div class="kicker a" data-d="0">${t(`${k}-kick`, beat.kicker, 30, WHITE, ui, [{ name: "letter-spacing", value: "0.08em" }, { name: "text-transform", value: "uppercase" }])}</div>
        <div class="phone a" data-d="2">
          <div class="ph-top"><span class="av"></span><div class="stats">${["Posts", "Followers", "Following"].map((s, j) => `<div><b>${t(`${k}-sn${j}`, ["48", "1,204", "312"][j]!, 40, INK, ui, [])}</b>${t(`${k}-sl${j}`, s, 24, MUTED, ui)}</div>`).join("")}</div></div>
          <div class="pname">${t(`${k}-pn`, name, 40, INK, ui, [])}</div>
          <div class="bio"><span class="paste">${t(`${k}-bio`, beat.value, fit(beat.value, 60, 15), INK, fancy)}</span></div>
          <div class="bio2">${t(`${k}-bio2`, "Coffee, books and long walks", 28, MUTED, ui)}</div>
          <div class="pbtns"><span class="pb blue">${t(`${k}-f`, "Follow", 30, WHITE, ui)}</span><span class="pb">${t(`${k}-m`, "Message", 30, INK, ui)}</span></div>
          <div class="tiles">${Array.from({ length: 6 }, (_, j) => `<i style="background:${["#DCE4FF", "#FFE9B8", "#E4E0FF", "#FFD9E6", "#D8F2FF", "#E9F7DF"][j]}"></i>`).join("")}</div>
        </div>
        <div class="toast">${t(`${k}-toast`, `Copied: ${beat.label}`, 30, WHITE, ui)}</div>
      </section>`;
      default: return `<section data-kind="close">
        <div class="logo a pp" data-d="0">${mark(`${k}m`, 150)}${t(`${k}-wm`, brand, 92, WHITE, ui, [{ name: "letter-spacing", value: "-0.02em" }])}</div>
        <div class="ctitle a" data-d="8">${t(`${k}-title`, beat.title, 104, WHITE, ui, [...shadow])}</div>
        <div class="plate a pp" data-d="${cues[0] ?? 22}">${t(`${k}-plate`, beat.plate || options.brand, fit(beat.plate || options.brand, 76, 17), WHITE, ui, [])}</div>
        <div class="cmt a" data-d="40">${t(`${k}-cmt`, "Comment your name below", 40, INK, ui, [])}</div>
      </section>`;
    }
  });

  const captions = options.captions.split("|").filter(Boolean).map((raw, j) => {
    const [a, b, text] = raw.split("~");
    if (a === undefined || b === undefined || text === undefined) throw new Error(`Caption "${raw}" needs start~end~text.`);
    return { s: Number(a) - start, e: Number(b) - start, html: `<div class="cap">${t(`cap-${j}`, text, Math.max(46, fit(text, 60, 40)), WHITE, ui, [{ name: "white-space", value: "normal" }, ...shadow])}</div>` };
  });
  const coverOn = options.coverFrames > 0 && !!options.coverText;
  const cv = options.coverText;
  const cursive = (s: string) => [...s].map(ch => { const u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(ch), l = "abcdefghijklmnopqrstuvwxyz".indexOf(ch); return u >= 0 ? String.fromCodePoint(0x1D4D0 + u) : l >= 0 ? String.fromCodePoint(0x1D4EA + l) : ch; }).join("");
  const gothic = (s: string) => [...s].map(ch => { const u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(ch), l = "abcdefghijklmnopqrstuvwxyz".indexOf(ch); return u >= 0 ? String.fromCodePoint(0x1D56C + u) : l >= 0 ? String.fromCodePoint(0x1D586 + l) : ch; }).join("");
  const bubble = (s: string) => [...s].map(ch => { const u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(ch), l = "abcdefghijklmnopqrstuvwxyz".indexOf(ch); return u >= 0 ? String.fromCodePoint(0x24B6 + u) : l >= 0 ? String.fromCodePoint(0x24D0 + l) : ch; }).join("");
  const cover = coverOn ? `<div class="cover">
      <div class="cv-brand">${mark("cvm", 72)}${t("cv-wm", brand, 52, WHITE, ui, [])}</div>
      <div class="cv-k">${t("cv-k", "YOUR NAME IN FONTS", 40, gold, ui, [{ name: "letter-spacing", value: "0.1em" }])}</div>
      <div class="cv-main">${t("cv-main", cursive(cv), fit(cv, 230, 6), WHITE, fancy, [{ name: "text-shadow", value: `0 0 60px ${hi}, 0 10px 40px rgba(0,0,0,.5)` }])}</div>
      <div class="cv-alt">${[gothic(cv), bubble(cv)].map((s, j) => `<div class="cv-chip">${t(`cv-a${j}`, s, fit(cv, 96, 7), INK, fancy)}</div>`).join("")}</div>
      ${options.coverNumber ? `<div class="cv-badge">${t("cv-n", options.coverNumber, 54, WHITE, ui, [])}</div>` : ""}
    </div>` : "";
  const program = htmlVisual({
    html: `<div class="bg"></div><div class="dots"></div><div class="glow"></div>
      <header>${mark("hd", 64)}${t("hd-wm", brand, 46, WHITE, ui, [{ name: "letter-spacing", value: "-0.02em" }])}</header>
      ${sections.join("")}<div class="caps">${captions.map(c => c.html).join("")}</div>${cover}`,
    css: `:scope{background:${bg1};overflow:hidden}
      .bg{position:absolute;inset:0;background:linear-gradient(170deg,${bg1} 0%,${bg1} 35%,${bg2} 100%)}
      .dots{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.08) 2px,transparent 2.6px) 0 0/48px 48px}
      .glow{position:absolute;left:140px;top:520px;width:800px;height:800px;border-radius:50%;background:${hi};opacity:.28;filter:blur(140px)}
      header{position:absolute;left:0;right:0;top:110px;display:flex;align-items:center;justify-content:center;gap:16px}
      .mark{display:inline-flex;align-items:center;justify-content:center;background:${hi};box-shadow:0 8px 30px rgba(43,89,255,.5);flex:none}
      section{position:absolute;inset:0;visibility:hidden}
      .kicker{position:absolute;left:0;right:0;top:300px;text-align:center}
      .box{position:absolute;left:70px;right:70px;background:#fff;border-radius:34px;box-shadow:0 30px 80px rgba(0,0,0,.4);border:4px solid ${INK}}
      .box.big{top:620px;height:470px;padding:70px 50px 40px;box-sizing:border-box}
      .lab{position:absolute;left:46px;top:-22px;background:#fff;padding:0 12px}
      .typed{display:flex;align-items:center;height:230px}
      .clip{display:inline-block;overflow:hidden;white-space:nowrap}
      .caret{display:inline-block;width:8px;height:150px;background:${hi};margin-left:8px;border-radius:4px}
      .row{position:absolute;left:50px;right:40px;bottom:36px;display:flex;align-items:center;justify-content:space-between}
      .btn{background:${hi};border-radius:18px;padding:18px 30px 16px}
      .hint{position:absolute;left:0;right:0;top:1170px;text-align:center}
      .box.small{top:250px;height:150px;display:flex;align-items:center;padding:0 46px;box-sizing:border-box}
      .box.small .caret{height:76px}
      .list{position:absolute;left:70px;right:70px;top:440px;height:1180px;overflow:hidden}
      .track{position:absolute;left:0;right:0;top:0}
      .card{background:#fff;border-radius:26px;margin-bottom:18px;padding:22px 34px 18px;box-shadow:0 14px 40px rgba(0,0,0,.3);border:4px solid transparent;opacity:0}
      .card.on{border-color:${hi};box-shadow:0 0 0 8px rgba(43,89,255,.25),0 14px 40px rgba(0,0,0,.3)}
      .fx{height:96px;display:flex;align-items:center;overflow:hidden}
      .meta{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
      .copy{border:3px solid ${hi};border-radius:14px;padding:6px 18px 4px}
      .phone{position:absolute;left:110px;right:110px;top:420px;height:1060px;background:#fff;border-radius:60px;border:12px solid ${INK};box-shadow:0 40px 100px rgba(0,0,0,.5);padding:70px 50px;box-sizing:border-box}
      .ph-top{display:flex;align-items:center;gap:40px}
      .av{width:170px;height:170px;border-radius:50%;background:conic-gradient(from 0deg,${hi},${gold},#FF4D8D,${hi});box-shadow:inset 0 0 0 10px #fff;flex:none}
      .stats{display:flex;gap:30px;flex:1;justify-content:space-around}.stats div{display:flex;flex-direction:column;align-items:center}
      .pname{margin-top:46px}
      .bio{margin-top:26px;min-height:110px;display:flex;align-items:center}
      .paste{display:inline-block;border-radius:14px;padding:6px 12px;margin-left:-12px}
      .bio2{margin-top:10px}
      .pbtns{display:flex;gap:20px;margin-top:50px}
      .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:40px -50px 0}.tiles i{display:block;height:170px}.pb{flex:1;text-align:center;border-radius:18px;padding:24px 0 20px;background:#EEF0F6}.pb.blue{background:${hi}}
      .toast{position:absolute;left:50%;top:1560px;transform:translateX(-50%);background:${INK};border:3px solid ${hi};border-radius:40px;padding:22px 42px 18px;opacity:0;white-space:nowrap}
      .logo{position:absolute;left:0;right:0;top:420px;display:flex;flex-direction:column;align-items:center;gap:30px}
      .ctitle{position:absolute;left:0;right:0;top:880px;text-align:center}
      .plate{position:absolute;left:50%;top:1060px;background:${hi};border-radius:30px;padding:34px 56px 28px;box-shadow:0 20px 60px rgba(43,89,255,.55);white-space:nowrap}
      .cmt{position:absolute;left:50%;top:1300px;transform:translateX(-50%);background:${gold};border-radius:40px;padding:22px 44px 18px;white-space:nowrap}
      .caps{position:absolute;left:80px;right:80px;top:1650px;height:190px}
      .cap{position:absolute;left:0;right:0;top:50%;text-align:center;visibility:hidden}
      .cover{position:absolute;inset:0;background:radial-gradient(900px 1100px at 50% 45%,${bg2},${bg1})}
      .cv-brand{position:absolute;left:0;right:0;top:130px;display:flex;justify-content:center;align-items:center;gap:16px}
      .cv-k{position:absolute;left:0;right:0;top:420px;text-align:center}
      .cv-main{position:absolute;left:0;right:0;top:540px;height:360px;display:flex;align-items:center;justify-content:center}
      .cv-alt{position:absolute;left:90px;right:90px;top:990px;display:flex;flex-direction:column;gap:30px;align-items:center}
      .cv-chip{background:#fff;border-radius:28px;padding:20px 44px;box-shadow:0 20px 50px rgba(0,0,0,.4)}
      .cv-badge{position:absolute;left:50%;top:1480px;transform:translateX(-50%) rotate(-3deg);background:${hi};border-radius:22px;padding:22px 44px 16px;box-shadow:0 16px 40px rgba(43,89,255,.6);white-space:nowrap}`,
    data: { times: beats.map((b, i) => i === 0 ? Math.max(b.at.frame - start, coverOn ? options.coverFrames : 0) : b.at.frame - start),
      end: end - start, cover: coverOn ? options.coverFrames : 0, caps: captions.map(c => [c.s, c.e]),
      cues: beats.map((b, i) => frames(b.cues).map(f => f - (i === 0 ? Math.max(b.at.frame, start + coverLead) : b.at.frame))) },
    setup: `const secs=[...root.querySelectorAll('section')], caps=[...root.querySelectorAll('.cap')];
      const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-Math.pow(1-clamp(x),3);
      const back=x=>{x=clamp(x);const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
      const cov=root.querySelector('.cover'), glow=root.querySelector('.glow'), dots=root.querySelector('.dots');
      const head=root.querySelector('header');
      const widths=new Map();
      return frame=>{
        const T=data.times, n=T.length;
        if(cov){const q=frame-data.cover;cov.style.visibility=q<10?'visible':'hidden';cov.style.opacity=String(q<0?1:1-clamp(q/10));}
        if(glow) glow.style.transform='translate('+(Math.sin(frame/45)*90)+'px,'+(Math.cos(frame/60)*120)+'px)';
        if(dots) dots.style.transform='translateY('+(-(frame*0.5)%48)+'px)';
        // the small logo at the top steps aside while the closing scene shows the big one
        if(head){const ci=secs.findIndex(x=>x.dataset.kind==='close'), ca=ci>=0?T[ci]:1e9; head.style.opacity=String(1-clamp((frame-ca)/8));}
        secs.forEach((s,i)=>{
          const a=T[i], b=i+1<n?T[i+1]:data.end, on=frame>=a&&frame<b;
          s.style.visibility=on?'visible':'hidden';
          if(!on) return;
          const age=frame-a, left=b-frame, inn=ease(age/10), out=i+1<n?ease(1-left/8):0;
          s.style.opacity=String(Math.min(inn,1-out));
          s.querySelectorAll('.a').forEach(el=>{const d=Number(el.dataset.d||0), x=(age-d)/12;
            el.style.opacity=String(clamp(x*2.5));
            const pre=el.classList.contains('plate')||el.classList.contains('cmt')?'translateX(-50%) ':'';
            el.style.transform=pre+(el.classList.contains('pp')?'scale('+(age<d?0.5:0.5+0.5*back(x))+')':'translateY('+(30*(1-ease(x)))+'px)');});
          const kind=s.dataset.kind;
          if(kind==='hook'){
            const clip=s.querySelector('.clip'); if(!widths.has(clip)) widths.set(clip, clip.scrollWidth);
            const full=widths.get(clip), cs=data.cues[i]||[], typeStart=8, typeEnd=Math.max(typeStart+12,(cs[0]||24)+6);
            clip.style.width=Math.round(full*clamp((age-typeStart)/(typeEnd-typeStart)))+'px';
            const caret=s.querySelector('.caret'); caret.style.opacity=(age>typeEnd&&Math.floor(age/14)%2)?'0':'1';
          }
          if(kind==='fonts'){
            const cards=[...s.querySelectorAll('.card')]; let last=-1;
            cards.forEach((c,j)=>{const d=Number(c.dataset.d), x=(age-d)/8; c.style.opacity=String(clamp(x*2)); c.style.transform='translateY('+(40*(1-ease(x)))+'px) scale('+(0.92+0.08*ease(x))+')'; if(age>=d) last=j;});
            cards.forEach((c,j)=>c.classList.toggle('on', j===last));
            const tr=s.querySelector('.track'), list=s.querySelector('.list');
            // the list moves up so the newest card is always in view (worked out from the frame alone, so every frame renders the same)
            const tgt=j=>j<0?0:Math.max(0,cards[j].offsetTop+cards[j].offsetHeight+30-list.clientHeight);
            if(last>=0){ const d=Number(cards[last].dataset.d), y=tgt(last-1)+(tgt(last)-tgt(last-1))*ease((age-d)/10); tr.style.transform='translateY('+(-y)+'px)'; }
            const caret=s.querySelector('.caret'); caret.style.opacity=Math.floor(age/14)%2?'0':'1';
          }
          if(kind==='paste'){
            const toast=s.querySelector('.toast'), tx=(age-6)/8, tOut=(age-40)/8;
            toast.style.opacity=String(clamp(tx*2)*(1-clamp(tOut)));
            toast.style.transform='translateX(-50%) translateY('+(30*(1-ease(tx)))+'px)';
            const p=s.querySelector('.paste'), px=(age-22)/10;
            p.style.opacity=String(clamp(px*2)); p.style.transform='scale('+(age<22?0.7:0.7+0.3*back(px))+')';
            p.style.background='rgba(43,89,255,'+(0.22*(1-clamp((age-40)/20)))+')';
          }
          if(kind==='close'){ const cm=s.querySelector('.cmt'); if(cm){const bob=Math.sin(age/6)*6; cm.style.transform='translateX(-50%) translateY('+bob+'px)';} }
        });
        caps.forEach((c,j)=>{const [a,b]=data.caps[j], on=frame>=a&&frame<b; c.style.visibility=on?'visible':'hidden';
          if(on){const x=(frame-a)/5;c.style.transform='translateY(-50%) translateY('+(10*(1-ease(x)))+'px)';c.style.opacity=String(clamp(x*2));}});
      };`,
  });
  return sealVisualTrack({ id: options.id, timelineId: timeline.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: options.id, order: 0, z: 0, span: window.span,
      elements: [{ id: "scene", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "left", value: `${within.xPx}px` },
          { name: "top", value: `${within.yPx}px` }, { name: "width", value: `${within.widthPx}px` },
          { name: "height", value: `${within.heightPx}px` }] }, ...texts] }] });
}
