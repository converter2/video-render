"""Voice timing, caption groups, an original music bed and cartoon sound effects for one video.

python3 audio.py <script.json> <voice-dir> <out-dir>
Writes voice.wav, music.wav, sfx.wav and timing.json into out-dir. Everything is synthesised here,
so there is nothing to license and no copyright claims on the platforms.
"""
import json, sys, zlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly, butter, sosfilt

SR = 48000
script = json.load(open(sys.argv[1]))
voice_dir, out_dir = sys.argv[2], sys.argv[3]
seed = zlib.crc32(str(script.get("seed", "x")).encode())
rng = np.random.default_rng(seed)


def load(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float32) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim > 1:
        x = x.mean(axis=1)
    return resample_poly(x, SR // 24000, 1) if sr == 24000 else x


def trim(x, thr=0.012):
    env = np.convolve(np.abs(x), np.ones(480) / 480, mode="same")
    idx = np.where(env > thr)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - 960), min(len(x), idx[-1] + 1920)
    return x[a:b]


def low_energy_snap(x, t_guess, window=0.22):
    """Move a caption boundary to the quietest point near its estimate."""
    hop = 240
    a, b = int(max(0, (t_guess - window) * SR)), int(min(len(x), (t_guess + window) * SR))
    if b - a < hop * 4:
        return t_guess
    seg = np.abs(x[a:b])
    frames = seg[: len(seg) // hop * hop].reshape(-1, hop).mean(axis=1)
    smooth = np.convolve(frames, np.ones(5) / 5, mode="same")
    return (a + int(np.argmin(smooth)) * hop + hop // 2) / SR


def weight(text):
    return sum(3.2 if (len(w) == 1 and w.isupper()) else len(w.strip(",.?!")) for w in text.split()) + 1.5


LEAD, SENT_GAP, BEAT_GAP, TAIL = (0.62 if script.get("cover") else 0.3), 0.16, 0.38, 1.8
voice, t = [np.zeros(int(LEAD * SR), np.float32)], LEAD
beats, captions = [], []
for bi, beat in enumerate(script["beats"]):
    if bi:
        voice.append(np.zeros(int(BEAT_GAP * SR), np.float32)); t += BEAT_GAP
    start = max(0.0, t - 0.12) if bi else 0.0
    cues = []
    for si, s in enumerate(beat["sentences"]):
        if si:
            voice.append(np.zeros(int(SENT_GAP * SR), np.float32)); t += SENT_GAP
        x = trim(load(f"{voice_dir}/{beat['id']}-{si}.wav"))
        dur = len(x) / SR
        w = np.array([weight(g[1]) for g in s["groups"]], float)
        bounds = np.concatenate([[0], np.cumsum(w) / w.sum() * dur])
        for k in range(1, len(bounds) - 1):
            bounds[k] = low_energy_snap(x, bounds[k])
        for gi, g in enumerate(s["groups"]):
            captions.append({"text": g[0], "start": round(t + bounds[gi], 3), "end": round(t + bounds[gi + 1], 3)})
        for c in s["cues"]:
            cues.append({"t": round(t + bounds[min(c["g"], len(s["groups"]) - 1)], 3), "sfx": c.get("sfx", "pop")})
        voice.append(x); t += dur
    beats.append({"id": beat["id"], "kind": beat.get("kind", ""), "start": round(start, 3), "cues": cues})
total = t + TAIL
voice = np.concatenate(voice)
voice = np.pad(voice, (0, int(total * SR) - len(voice)))
voice = voice / max(1e-6, np.abs(voice).max()) * 0.71
n = len(voice)
tt = np.arange(n) / SR

# ---------- music: a short loop whose key, tempo and pattern come from the site, so each site keeps its own sound ----------
BPM = [100, 104, 108, 110, 112, 116][seed % 6]
beat_s = 60 / BPM; bar_s = beat_s * 4
shift = [0, 2, -3, 5, -2, 3][(seed >> 3) % 6]
def note(m): return 440.0 * 2 ** ((m + shift - 69) / 12)
PROGS = [([57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]),
         ([48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]),
         ([53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64])]
chords = PROGS[(seed >> 6) % 3]
roots = [c[0] - 12 for c in chords]
arp_shape = [[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1]][(seed >> 8) % 3]
music = np.zeros(n, np.float32)
def add(sig, at):
    i = int(at * SR)
    if i >= n: return
    j = min(n, i + len(sig)); music[i:j] += sig[: j - i]
def kick():
    x = np.arange(int(0.32 * SR)) / SR
    f = 48 + 90 * np.exp(-x * 28)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9)).astype(np.float32)
def clap():
    x = np.arange(int(0.18 * SR)) / SR
    s = rng.standard_normal(len(x)) * np.exp(-x * 26)
    return sosfilt(butter(2, [900, 4200], "bandpass", fs=SR, output="sos"), s).astype(np.float32) * 0.6
def hat(open_=False):
    x = np.arange(int((0.22 if open_ else 0.09) * SR)) / SR
    s = rng.standard_normal(len(x)) * np.exp(-x * (18 if open_ else 60))
    return sosfilt(butter(2, 7000, "highpass", fs=SR, output="sos"), s).astype(np.float32) * 0.22
def pluck(freq, d=0.28):
    x = np.arange(int(d * SR)) / SR
    saw = sum(np.sin(2 * np.pi * freq * k * x) / k for k in range(1, 7))
    return (saw * np.exp(-x * 11)).astype(np.float32) * 0.16
def pad(ch, d):
    x = np.arange(int(d * SR)) / SR
    s = sum(np.sin(2 * np.pi * note(m) * x + 0.3 * np.sin(2 * np.pi * 0.25 * x)) for m in ch)
    env = np.minimum(1, x / 0.4) * np.minimum(1, (d - x) / 0.5)
    return (s * env).astype(np.float32) * 0.05
def bass(m, d):
    x = np.arange(int(d * SR)) / SR
    s = np.tanh(1.6 * np.sin(2 * np.pi * note(m) * x)) * np.minimum(1, x / 0.005) * np.exp(-x * 3)
    return s.astype(np.float32) * 0.32
K, C = kick(), clap()
bar, tb = 0, 0.0
while tb < total:
    ci = bar % 4; ch = chords[ci]
    add(pad(ch, bar_s + 0.3), tb)
    for b in range(4):
        add(K * 0.9, tb + b * beat_s)
        if b in (1, 3): add(C, tb + b * beat_s)
        for e in range(2): add(bass(roots[ci], beat_s / 2), tb + b * beat_s + e * beat_s / 2)
    for s16 in range(16):
        add(hat(open_=(s16 % 8 == 6)), tb + s16 * beat_s / 4)
        arp = [ch[arp_shape[s16 % 4]] + 12, ch[1] + 24][1 if s16 % 8 == 7 else 0]
        if s16 % 2 == 0 or s16 in (7, 15): add(pluck(note(arp)), tb + s16 * beat_s / 4)
    bar += 1; tb += bar_s
lp = sosfilt(butter(2, 700, "lowpass", fs=SR, output="sos"), music)
mix_in = np.clip(tt / 1.6, 0, 1)
music = lp * (1 - mix_in) + music * mix_in
music = music / max(1e-6, np.abs(music).max())
venv = np.convolve(np.abs(voice), np.ones(int(0.05 * SR)) / int(0.05 * SR), mode="same")
speaking = np.convolve((venv > 0.02).astype(np.float32), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
duck = 1 - 0.55 * np.clip(speaking * 1.5, 0, 1)
fade = np.clip((total - tt) / 1.4, 0, 1)
music = (music * duck * fade * 0.2).astype(np.float32)

# ---------- sound effects ----------
sfx = np.zeros(n, np.float32)
def put(sig, at, gain):
    i = int(max(0, at) * SR); j = min(n, i + len(sig))
    if j > i: sfx[i:j] += sig[: j - i] * gain
def whoosh(d=0.42):
    x = np.arange(int(d * SR)) / SR; s = rng.standard_normal(len(x)); out = np.zeros_like(s)
    for k, f in enumerate(np.linspace(400, 5200, 8)):
        seg = slice(k * len(x) // 8, (k + 1) * len(x) // 8)
        out[seg] = sosfilt(butter(2, [f * 0.6, f * 1.4], "bandpass", fs=SR, output="sos"), s)[seg]
    return (out * np.sin(np.pi * x / d) ** 2).astype(np.float32)
def pop():
    x = np.arange(int(0.11 * SR)) / SR
    f = 1400 * np.exp(-x * 30) + 500
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 38)).astype(np.float32)
def impact():
    x = np.arange(int(0.9 * SR)) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-x * 14)) / SR) * np.exp(-x * 4.5)
    crack = sosfilt(butter(2, 2500, "highpass", fs=SR, output="sos"), rng.standard_normal(len(x))) * np.exp(-x * 30) * 0.5
    return np.tanh((boom + crack) * 1.4).astype(np.float32)
def riser(d=1.0):
    x = np.arange(int(d * SR)) / SR
    s = np.sin(2 * np.pi * np.cumsum(220 + 900 * (x / d) ** 2) / SR) * 0.4
    s += sosfilt(butter(2, 3000, "highpass", fs=SR, output="sos"), rng.standard_normal(len(x))) * 0.3
    return (s * (x / d) ** 2).astype(np.float32)
def ding():
    x = np.arange(int(1.1 * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * x) * a for f, a in [(1318.5, 1), (1975.5, .5), (2637, .25)])
    return (s * np.exp(-x * 4)).astype(np.float32) * 0.5
def horn():
    x = np.arange(int(0.16 * SR)) / SR
    s = np.sign(np.sin(2 * np.pi * 420 * x)) * 0.5 + np.sign(np.sin(2 * np.pi * 528 * x)) * 0.5
    s = sosfilt(butter(2, 2400, "lowpass", fs=SR, output="sos"), s)
    return (s * np.minimum(1, x / 0.01) * np.minimum(1, (0.16 - x) / 0.02)).astype(np.float32)
def boing():
    x = np.arange(int(0.7 * SR)) / SR
    f = 180 + 120 * np.sin(2 * np.pi * 9 * x) * np.exp(-x * 3) + 80 * np.exp(-x * 4)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 4.5)).astype(np.float32)
def squeak():
    out = []
    for _ in range(3):
        x = np.arange(int(0.12 * SR)) / SR
        f = 2200 + 700 * np.sin(np.pi * x / 0.12)
        out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / 0.12) * 0.6); out.append(np.zeros(int(0.06 * SR)))
    return np.concatenate(out).astype(np.float32)
def fizz():
    x = np.arange(int(0.45 * SR)) / SR
    gate = (np.floor(x / 0.066) % 2 == 0).astype(float) * (x < 0.4)
    s = sosfilt(butter(2, [600, 3000], "bandpass", fs=SR, output="sos"), rng.standard_normal(len(x))) * 0.5 + np.sin(2 * np.pi * 120 * x) * 0.4
    return (s * gate).astype(np.float32)
def skid():
    x = np.arange(int(0.5 * SR)) / SR
    s = sosfilt(butter(2, [1500, 3500], "bandpass", fs=SR, output="sos"), rng.standard_normal(len(x)))
    return (s * np.sin(np.pi * x / 0.5) ** 0.5 * np.exp(-x * 2)).astype(np.float32)
def boop():
    x = np.arange(int(0.22 * SR)) / SR
    f = 520 + 380 * np.minimum(1, x / 0.08)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9)).astype(np.float32)

SFX = {"pop": (pop, 0.3), "impact": (impact, 0.55), "fizz": (fizz, 0.3), "boing": (boing, 0.45), "squeak": (squeak, 0.18),
       "ding": (ding, 0.25), "skid": (skid, 0.16), "boop": (boop, 0.22), "horn": (horn, 0.32)}
mascot = script.get("mascot", "car")
for b in beats[1:]:
    put(whoosh(), b["start"] - 0.28, 0.35)
if script.get("cover"):
    put(whoosh(), 0.42, 0.4)
if beats:
    if mascot == "car":
        put(skid(), 0.72, 0.25); put(horn(), 1.12, 0.32); put(horn(), 1.32, 0.32)
    else:
        put(boop(), 0.9, 0.3); put(boop(), 1.15, 0.26)
for b in beats:
    for c in b["cues"]:
        name = c.get("sfx", "pop")
        if name == "impact":
            put(riser(1.0), c["t"] - 0.95, 0.22)
        if name == "close":
            put(impact(), c["t"], 0.45); put(ding(), c["t"] + 0.05, 0.25); continue
        fn, g = SFX.get(name, SFX["pop"])
        put(fn(), c["t"] + (0.55 if name == "skid" else 0.05 if name == "impact" else 0), g)
        if name in ("fizz", "boing", "squeak"):
            put(pop(), c["t"], 0.22)

def save(name, x):
    st = np.stack([x, x], axis=1)
    wavfile.write(f"{out_dir}/{name}.wav", SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))
save("voice", voice); save("music", music); save("sfx", sfx)
json.dump({"duration": round(total, 3), "beats": beats, "captions": captions}, open(f"{out_dir}/timing.json", "w"), indent=1)
print("duration", round(total, 2))
