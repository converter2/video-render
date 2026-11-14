// Writes the Hypit source for one video from the job, its audio timing and any page screenshots.
const FPS = 30;
export const COVER_FRAMES = 17;   // about 0.57 s: the opening cover the platforms use as the first frame and thumbnail
const f = s => Math.round(s * FPS);
// attribute text: no quotes, braces or angle brackets (they mean something in SVML), and none of the list separators
const clean = s => String(s ?? '').replace(/[“”"]/g, '’').replace(/[{}<>]/g, '').replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
const part = s => clean(s).replace(/[|=~]/g, '-');

export function buildSvml(job, timing, images = {}) {
  const beats = timing.beats;
  const wide = job.format === 'tutorial';
  const plain = wide && job.mascot === 'none';
  const names = job.format === 'names';   // "your name in fonts" Shorts   // tutorials in the site's own clean style: no character, plain type
  const cl = timing.captions, caps = [];
  for (let i = 0; i < cl.length; i++) {
    let e = cl[i].end;
    if (i + 1 < cl.length && cl[i + 1].start - e < 0.45) e = cl[i + 1].start;
    if (i === cl.length - 1) e += 0.6;
    caps.push(`${f(cl[i].start)}~${f(e)}~${part(cl[i].text)}`);
  }
  const end = f(timing.duration);
  const th = job.theme || {};
  const theme = [th.bg1, th.bg2, th.hi, th.body].map(c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '').join(',');
  const inst = beats.map((b, i) => `    <time:Instant id="${b.id}" at="${i === 0 ? 0 : f(b.start)}f"/>`).join('\n');
  const beatEls = job.beats.map((b, i) => {
    const tb = beats[i];
    const cues = tb.cues.map(c => f(c.t)).map(x => Math.max(x, i === 0 ? 0 : f(tb.start))).join(',');
    const items = (b.items || []).map(it => `${part(it.label)}=${part(it.value)}`).join('|');
    const attrs = {
      kind: b.kind, kicker: b.kicker, title: b.title, value: b.value, label: b.label, items, cues,
      variants: (b.items || []).map(it => part(it.variant || '')).join(','), parts: (b.items || []).map(it => part(it.part || '')).join(','),
      bubble: b.bubble, plate: b.kind === 'close' ? job.domain : b.plate, note: b.note, tone: b.tone === 'bad' ? 'bad' : '', image: images[i] || ''
    };
    const a = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
      .map(([k, v]) => `${k}="${k === 'image' ? v : k === 'items' || k === 'cues' || k === 'variants' || k === 'parts' ? v : clean(v)}"`).join(' ');
    return `    <ap:Beat id="beat-${i}" at={story.${tb.id}} ${a}/>`;
  }).join('\n');
  return `<?svml using="@hypit/markup@1"?>
<svml>
  <import as="time" from="@hypit/timeline-author@1"/>
  <import as="spatial" from="@hypit/spatial@1"/>
  <import as="media" from="@hypit/media@1"/>
  <import as="mediaop" from="@hypit/media-operations@1"/>
  <import as="audio" from="@hypit/audio-track@1"/>
  <import as="fonts" from="@hypit/fontsource@1"/>
  <import as="ap" from="@autoposter/scene@1"/>
  <import as="film" from="@hypit/film@1"/>
  <import as="html" from="@hypit/html-video@1"/>
  <import as="style" source="./video.svs"/>

  <time:Clock id="clock" frame-rate="${FPS}"/>
  <time:Timeline id="story" clock={clock} end="${end}f">
${inst}
  </time:Timeline>
  <spatial:Canvas id="canvas" width="${wide ? 1920 : 1080}" height="${wide ? 1080 : 1920}"/>
${names ? `  <fonts:Face id="body-face" package="@fontsource-variable/noto-sans" weight="500" style="normal"/>
  <fonts:Face id="math-face" package="@fontsource/noto-sans-math" weight="400" style="normal"/>
  <fonts:Face id="sym-face" package="@fontsource-variable/noto-sans-symbols" weight="400" style="normal"/>
  <fonts:Face id="sym2-face" package="@fontsource/noto-sans-symbols-2" weight="400" style="normal"/>
  <fonts:Face id="display-face" package="@fontsource-variable/space-grotesk" weight="600" style="normal"/>
  <media:FontStack id="body" primary={body-face}><media:Fallback font={math-face}/><media:Fallback font={sym-face}/><media:Fallback font={sym2-face}/></media:FontStack>
  <media:FontStack id="display" primary={display-face}><media:Fallback font={body-face}/></media:FontStack>` : `  <fonts:Face id="body-face" package="${plain ? '@fontsource/barlow' : '@fontsource-variable/fredoka'}" weight="600" style="normal"/>
  <fonts:Face id="display-face" package="${plain ? '@fontsource/barlow' : '@fontsource/luckiest-guy'}" weight="${plain ? 800 : 400}" style="normal"/>
  <media:FontStack id="body" primary={body-face}/>
  <media:FontStack id="display" primary={display-face}/>`}

  <media:Audio id="voice-file" src="./assets/voice.wav"/>
  <media:Audio id="music-file" src="./assets/music.wav"/>
  <media:Audio id="sfx-file" src="./assets/sfx.wav"/>
  <mediaop:Normalize id="voice-media" source={voice-file} video="none" audio="default" span-authority="audio" clock={clock}/>
  <mediaop:Normalize id="music-media" source={music-file} video="none" audio="default" span-authority="audio" clock={clock}/>
  <mediaop:Normalize id="sfx-media" source={sfx-file} video="none" audio="default" span-authority="audio" clock={clock}/>
  <time:Window id="voice-window" timeline={story.timeline} from={story.${beats[0].id}} for="${end}f"/>
  <time:Window id="music-window" timeline={story.timeline} from={story.${beats[0].id}} for="${end}f"/>
  <time:Window id="sfx-window" timeline={story.timeline} from={story.${beats[0].id}} for="${end}f"/>
  <audio:Track id="mix" timeline={story.timeline}>
    <audio:Clip id="voiceover" source={voice-media.media} during={voice-window}/>
    <audio:Clip id="music-bed" source={music-media.media} during={music-window}/>
    <audio:Clip id="effects" source={sfx-media.media} during={sfx-window}/>
  </audio:Track>

  <ap:Scene id="scene" timeline={story.timeline} within={canvas.bounds} font={body} display={display}
    during={story.window} brand="${clean(job.logo || job.domain)}"${clean(job.source) ? ` source="${clean(job.source)}"` : ''} mascot="${job.mascot === 'car' ? 'car' : 'buddy'}" theme="${theme}"${wide ? ` format="${plain ? 'tutorial-clean' : 'tutorial'}"` : names ? ' format="names"' : ''}
    captions="${caps.join('|')}"${job.cover?.text ? ` cover-text="${part(job.cover.text)}" cover-frames="${COVER_FRAMES}"${job.cover.number ? ` cover-number="${part(job.cover.number)}"` : ''}` : ''}>
${beatEls}
  </ap:Scene>
  <film:Film id="main" canvas={canvas.canvas} timeline={story.timeline} appearance={style.film.main}>
    <film:Track source={scene.visual}/>
    <film:Track source={mix.audio}/>
  </film:Film>
  <html:Video id="final" composition={main.composition} timeline={story.timeline}/>
</svml>
`;
}
