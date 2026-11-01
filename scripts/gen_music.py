"""Synthesize a chapter's score and SFX, then mix the two deliverables.

Usage: python scripts/gen_music.py ch1|ch2|ch3
Reads src/<ch>/timeline.json (line timings + cues), writes
  public/music/<ch>_music.wav  (score + SFX, subtitle version)
  public/music/<ch>_narr.wav   (score ducked under narration + VO)
  public/music/<ch>_*_seam.wav (both again without the closing fade, for gen_full.py)
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(7)


def note(name: str) -> float:
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
             "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def env(n, a, r, sustain=1.0):
    """Linear-in-dB-ish attack/release envelope over n samples (a, r in seconds)."""
    e = np.full(n, sustain)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na:
        e[:na] = sustain * (np.linspace(0, 1, na) ** 2)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.6
    return e


class Track:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = np.zeros((self.n, 2))

    def add(self, t0, sig, gain=1.0, pan=0.0):
        i = int(t0 * SR)
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
        j = min(self.n, i + len(sig))
        if j > i:
            self.buf[i:j] += sig[: j - i] * gain


TABLE = 4096
_tables = {}


def saw_table(f):
    """Single cycle of a band-limited saw (harmonics kept below Nyquist for f)."""
    kmax = max(1, min(40, int(SR / 2.2 / f)))
    if kmax not in _tables:
        ph = np.arange(TABLE) / TABLE * 2 * np.pi
        _tables[kmax] = sum(np.sin(k * ph) / k for k in range(1, kmax + 1))
    return _tables[kmax]


def saw_ens(freq, dur, voices=7, detune=0.12, vib=0.0045, bright=2800, seed=0):
    """Bowed-string ensemble: detuned band-limited saws, slow vibrato, body filter. Stereo."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    for v in range(voices):
        cents = (v - (voices - 1) / 2) / ((voices - 1) / 2 or 1) * detune * 100
        f = freq * 2 ** (cents / 1200)
        rate = 4.6 + r.uniform(-0.6, 0.6)
        ph = 2 * np.pi * np.cumsum(f * (1 + vib * np.sin(2 * np.pi * rate * t + r.uniform(0, 6)))) / SR
        ph += r.uniform(0, 2 * np.pi)
        s = saw_table(f)[((ph / (2 * np.pi)) % 1.0 * TABLE).astype(np.int32)]
        pan = (v / (voices - 1 or 1)) * 2 - 1
        out[:, 0] += s * np.cos((pan * 0.7 + 1) * np.pi / 4)
        out[:, 1] += s * np.sin((pan * 0.7 + 1) * np.pi / 4)
    out = np.stack([lp(out[:, 0], bright), lp(out[:, 1], bright)], 1)
    out = np.stack([hp(out[:, 0], 60), hp(out[:, 1], 60)], 1)
    return out / voices * 0.6


def chord(track, t0, dur, notes, gain, a=2.5, r=3.5, bright=2600, seed=0):
    for i, nm in enumerate(notes):
        s = saw_ens(note(nm), dur, bright=bright, seed=seed * 31 + i)
        e = env(len(s), a, r)[:, None]
        track.add(t0, s * e, gain / np.sqrt(len(notes)))


def sine_pad(freq, dur, a, r, beat=0.15):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.6 * np.sin(2 * np.pi * (freq + beat) * t + 1)
    s += 0.25 * np.sin(2 * np.pi * freq * 2.001 * t)
    return s * env(len(t), a, r)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def reverb(x, seconds=5.5, mix=0.35, pre=0.03):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        nz = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        nz = lp(nz, 6000) * (1 - np.exp(-t * 80))
        ir[:, c] = nz
    ir /= np.sqrt((ir ** 2).sum(0))
    p = int(pre * SR)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    wet = np.roll(wet, p, 0)
    return x * (1 - mix) + wet * mix * 2.2


def ping(freq, dur=1.2, decay=3.0):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)
    s += 0.3 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * decay * 2.5)
    return s * (1 - np.exp(-t * 900))


def boom(dur=7.0):
    t = np.arange(int(dur * SR)) / SR
    f = 28 + 55 * np.exp(-t * 2.5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 0.65)
    s += lp(noise(dur), 300) * np.exp(-t * 3.5) * 0.25
    s *= 1 - np.exp(-t * 300)
    return s


def riser(dur):
    t = np.arange(int(dur * SR)) / SR
    x = noise(dur)
    # Crossfade between progressively higher band-passed copies.
    bands = [bp(x, lo, lo * 2.4) for lo in (180, 420, 900, 1900, 4000)]
    k = (t / dur) * (len(bands) - 1)
    out = np.zeros_like(x)
    for i, b in enumerate(bands):
        out += b * np.clip(1 - np.abs(k - i), 0, 1)
    return out * (t / dur) ** 2.5


def thud(dur=1.8):
    t = np.arange(int(dur * SR)) / SR
    f = 38 + 30 * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    s += lp(noise(dur), 180) * np.exp(-t * 10) * 0.5
    return s * (1 - np.exp(-t * 400))


def build_ch1(tl):
    total = tl["total"]
    cues = tl["cues"]
    X = cues["xfade"]
    shots = {s["shot"]: s for s in tl["shots"]}
    mus = Track(total + 1)
    sfx = Track(total + 1)
    sea, forest, beasts = shots["sea"], shots["forest"], shots["beasts"]
    stars, question = shots["stars"], shots["question"]

    # ---- Opening: low electronic ambience, title lands with the sunrise -------
    T = sea["start"]
    drone = sine_pad(note("D1"), T + 3, 1.5, 3, 0.11) * 0.55 + sine_pad(note("A1"), T + 3, 2, 3, 0.17) * 0.3
    mus.add(0, drone, 0.5)
    wind = lp(hp(noise(T + 3), 120), 900) * env(int((T + 3) * SR), 1.5, 3) * 0.05
    sfx.add(0, np.stack([wind, np.roll(wind, 900)], 1), 1.0)
    sfx.add(0, riser(cues["title"]), 0.3)
    sfx.add(cues["title"], boom(), 0.9)
    chord(mus, cues["title"] - 0.2, T - cues["title"] + 2.5, ["D2", "A2", "E3", "F#3", "A3", "D4"], 0.6, a=1.0, r=2.5, bright=1800, seed=1)
    mus.add(cues["title"], sine_pad(note("D5"), 7, 0.3, 5, 0.6) * 0.05, 1)

    # ---- Life: strings enter, one chord per shot ------------------------------
    def shot_chord(sh, notes, gain, bright, seed, lead=0.4, tail=1.6):
        chord(mus, sh["start"] - lead, sh["end"] - sh["start"] + lead + tail, notes, gain, a=0.9, r=tail + 0.6, bright=bright, seed=seed)

    shot_chord(sea, ["D2", "A2", "F3", "E4"], 0.55, 1500, 2)
    d = sea["end"] - sea["start"]
    for k in range(7):
        sfx.add(sea["start"] + rng.uniform(0, d), ping(rng.uniform(500, 1400), 0.25, 18) * 0.5, 0.05, pan=rng.uniform(-0.8, 0.8))
    sfx.add(sea["start"] - 0.4, lp(noise(d + 1.2), 400) * env(int((d + 1.2) * SR), 0.5, 0.8) * 0.12, 1)

    shot_chord(forest, ["F2", "C3", "A3", "G4", "C5"], 0.6, 2400, 4)
    d = forest["end"] - forest["start"]
    sfx.add(forest["start"] - 0.3, lp(hp(noise(d + 0.6), 300), 2500) * env(int((d + 0.6) * SR), 0.6, 0.6) * 0.035, 1)

    shot_chord(beasts, ["G1", "D2", "Bb2", "D3", "A3"], 0.68, 2000, 6)
    # Hind feet of the lead animal land at shader phase 0 and 0.5; the shot's clock
    # starts half a crossfade before its nominal start.
    t0 = beasts["start"] - X / 2
    for k in np.arange(t0, beasts["end"] + X / 2, cues["stepPeriod"] / 2):
        if k > beasts["start"] - 0.1:
            sfx.add(k, thud(), 0.45)
    mus.add(beasts["start"] + 0.2, boom(2.5) * 0.4, 0.5)

    # ---- Stargazing: strings thin out, high harmonics and star pings ----------
    shot_chord(stars, ["Bb2", "F3", "D4", "A4", "C5"], 0.42, 3600, 8, lead=0.5, tail=1.2)
    for i, tt in enumerate(np.arange(stars["start"] + 0.5, stars["end"], 0.9)):
        pent = ["D6", "E6", "A6", "F6", "C7", "A5", "D7"]
        mus.add(tt + rng.uniform(-0.1, 0.1), ping(note(pent[i % len(pent)]), 3.0, 1.3), 0.05, pan=rng.uniform(-0.6, 0.6))

    # ---- The question: suspended, never resolved ------------------------------
    d = total - question["start"]
    chord(mus, question["start"] - 0.5, d + 1, ["D2", "A2", "E3", "G3", "A3", "E4"], 0.5, a=1.2, r=d * 0.7, bright=2200, seed=9)
    mus.add(question["start"], sine_pad(note("E5"), d, 1.2, d * 0.8, 0.5) * 0.05, 1)

    music = reverb(mus.buf, 6.5, 0.42)
    effects = reverb(sfx.buf, 3.5, 0.2)
    return music, effects


def swell(dur, peak=0.85, p=2.2):
    """Crescendo envelope peaking at `peak` of the duration, then a short release."""
    t = np.linspace(0, 1, int(dur * SR))
    up = (np.clip(t / peak, 0, 1)) ** p
    down = np.clip((1 - t) / (1 - peak), 0, 1) ** 0.7
    return np.minimum(up, np.where(t > peak, down, 1))


def build_ch2(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    L = {l["id"]: l for l in tl["lines"]}
    mus = Track(total + 1)
    sfx = Track(total + 1)

    def shot_chord(sh, notes, gain, bright, seed, lead=0.4, tail=1.6, a=0.9):
        chord(mus, sh["start"] - lead, sh["end"] - sh["start"] + lead + tail, notes, gain, a=a, r=tail + 0.6, bright=bright, seed=seed)

    def wind(t0, dur, lo, hi, gain):
        x = bp(noise(dur), lo, hi) * env(int(dur * SR), 0.8, 1.0)
        x *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * np.arange(len(x)) / SR + rng.uniform(0, 6))
        sfx.add(t0, np.stack([x, np.roll(x, 1100)], 1), gain)

    # ---- The future: picks up from chapter 1's unresolved D ---------------------
    fu, su, sn = shots["future"], shots["summer"], shots["sun"]
    mus.add(0, sine_pad(note("D1"), su["start"] + 2, 1.5, 2, 0.11) * 0.5, 0.5)
    shot_chord(fu, ["D2", "A2", "F3", "E4"], 0.5, 1500, 21, lead=0, a=1.5)
    # Summer: one warm, nostalgic chord.
    shot_chord(su, ["F2", "C3", "A3", "E4", "G4"], 0.58, 2600, 22)
    for i, nm in enumerate(["A5", "G5", "E5"]):
        mus.add(su["start"] + 0.5 + i * 0.9, ping(note(nm), 3.0, 1.1), 0.05, pan=0.3 - 0.3 * i)
    sfx.add(su["start"] - 0.3, lp(hp(noise(su["end"] - su["start"] + 0.6), 400), 3000) * env(int((su["end"] - su["start"] + 0.6) * SR), 0.5, 0.5) * 0.03, 1)

    # ---- The Sun brightens: a swelling cluster, a roar, a riser into the burn ---
    d = sn["end"] - sn["start"] + 0.6
    for nm, g in (("Bb1", 0.5), ("F2", 0.4), ("E5", 0.16), ("F5", 0.16), ("B4", 0.12)):
        s_ = saw_ens(note(nm), d, bright=3000, seed=sum(map(ord, nm)))
        mus.add(sn["start"] - 0.3, s_ * swell(d)[:, None], g)
    roar = lp(noise(d), 160) * swell(d, 0.9, 1.6) * 0.5
    roar *= 1 + 0.3 * np.sin(2 * np.pi * 3.1 * np.arange(len(roar)) / SR)
    sfx.add(sn["start"] - 0.3, roar, 1)
    sfx.add(sn["end"] - 2.6, riser(2.6), 0.32)
    sfx.add(sn["end"], boom(4.0) * 0.6, 0.6)

    # ---- Decline: the harmony sinks a step with each shot -----------------------
    cl, wi, ev = shots["climate"], shots["wither"], shots["evaporate"]
    shot_chord(cl, ["G1", "D2", "Bb2", "F3", "A3"], 0.6, 1900, 23)
    wind(cl["start"] - 0.3, cl["end"] - cl["start"] + 0.6, 300, 1400, 0.06)
    shot_chord(wi, ["Eb1", "Bb1", "G2", "D3", "A3"], 0.62, 1600, 24)
    wind(wi["start"] - 0.3, wi["end"] - wi["start"] + 0.6, 500, 2600, 0.07)
    for k in range(14):  # dry crackle
        sfx.add(wi["start"] + rng.uniform(0, wi["end"] - wi["start"]), hp(noise(0.03), 2500) * np.exp(-np.arange(int(0.03 * SR)) / SR * 150), 0.06, pan=rng.uniform(-0.8, 0.8))
    shot_chord(ev, ["C2", "G2", "Eb3", "D4", "G4"], 0.6, 1700, 25, tail=2.4)
    d = ev["end"] - ev["start"] + 0.8
    hiss = hp(noise(d), 2800) * swell(d, 0.7, 1.2) * 0.06
    sfx.add(ev["start"] - 0.4, np.stack([hiss, np.roll(hiss, 700)], 1), 1)
    sfx.add(ev["start"] - 0.4, lp(noise(d), 120) * swell(d, 0.6, 1.2) * 0.35, 1)
    wind(ev["end"] - 0.6, 3.0, 200, 700, 0.07)

    # ---- The timeline: minimal; a glass note for each mark ----------------------
    tm = shots["timeline"]
    mus.add(tm["start"], sine_pad(note("D2"), total - tm["start"], 2, 4, 0.13) * 0.35, 0.6)
    marks = [(tm["start"] + 0.3, "D6"), (tm["start"] + 1.0, "A5"), (L["l10"]["start"] - 0.2, "F#6"),
             (L["l10"]["start"] + 0.6, "E6"), (L["l11"]["start"], "A5"), (L["l12"]["start"] + 0.6, "D5")]
    for i, (tt, nm) in enumerate(marks):
        mus.add(tt, ping(note(nm), 3.5, 1.0), 0.06, pan=-0.5 + i * 0.2)
    # The burst of life: strings bloom inside the window, cut off as it closes.
    l13, l14 = L["l13"], L["l14"]
    d = l14["start"] + 0.2 - (l13["start"] - 0.3)
    for i, nm in enumerate(["D2", "A2", "F#3", "A3", "D4", "E4", "A4"]):
        s_ = saw_ens(note(nm), d, bright=3400, seed=40 + i)
        mus.add(l13["start"] - 0.3, s_ * swell(d, 0.88, 1.4)[:, None], 0.75 / np.sqrt(7))
    # Pull-out to 10^14 years: a falling whoosh, then a single high tone thinning away.
    dz = 3.8
    tz = np.arange(int(dz * SR)) / SR
    wh = bp(noise(dz), 200, 6000)
    wh = np.stack([lp(wh, 4000), lp(wh, 3000)], 1) * (np.sin(np.pi * tz / dz) ** 2)[:, None] * 0.12
    sfx.add(l14["start"], wh, 1)
    mus.add(l14["start"] + 0.2, sine_pad(note("A5"), total - l14["start"], 0.8, total - l14["start"] - 1, 0.3) * 0.05, 1)
    mus.add(l14["start"] + 2.7, ping(note("D6"), 5.0, 0.7), 0.09)
    mus.add(l14["start"] + 2.7, ping(note("A6"), 4.0, 0.9), 0.04)

    music = reverb(mus.buf, 6.5, 0.42)
    effects = reverb(sfx.buf, 3.0, 0.2)
    return music, effects


def pluck(freq, dur=0.5, decay=7.0, bright=2600):
    """Short synth pluck: band-limited saw with a fast decay and a closing filter."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = (freq * t) % 1.0
    s = saw_table(freq)[(ph * TABLE).astype(np.int32)]
    s = lp(s, bright) * np.exp(-t * decay) * (1 - np.exp(-t * 600))
    return s * 0.5


def build_ch3(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    mus = Track(total + 1)
    sfx = Track(total + 1)

    def shot_chord(sh, notes, gain, bright, seed, lead=0.4, tail=1.6, a=0.9):
        chord(mus, sh["start"] - lead, sh["end"] - sh["start"] + lead + tail, notes, gain, a=a, r=tail + 0.6, bright=bright, seed=seed)

    un, cv, shd, mv = shots["understand"], shots["civilization"], shots["shield"], shots["move"]
    li, rd, hp_ = shots["lifting"], shots["reddwarf"], shots["hope"]

    # ---- Understanding: out of silence, a quiet motif over a low pad -----------
    for i, nm in enumerate(["D5", "A5", "F#5", "E5", "A4", "D5", "E5", "F#5"]):
        mus.add(0.6 + i * 0.62, ping(note(nm), 2.6, 1.6), 0.06, pan=-0.3 + 0.08 * i)
    shot_chord(un, ["D2", "A2", "E3"], 0.45, 1400, 31, lead=0, a=2.0)
    for k in np.arange(0.8, un["end"], 2.7):        # the core's slow pulse
        sfx.add(k, thud(1.6) * 0.25, 0.7)

    # ---- Civilization and engineering: an arpeggiated pulse at 96 bpm ----------
    step = 60 / 96 / 2
    prog = [(cv, ["B1", "F#2", "D3", "A3", "C#4"], ["B3", "D4", "F#4", "A4", "C#5", "A4", "F#4", "D4"]),
            (shd, ["E2", "B2", "G3", "D4", "F#4"], ["E4", "G4", "B4", "D5", "F#5", "D5", "B4", "G4"]),
            (mv, ["C2", "G2", "E3", "B3", "F#4"], ["C4", "E4", "G4", "B4", "F#5", "B4", "G4", "E4"])]
    for j, (sh, ch, arp) in enumerate(prog):
        shot_chord(sh, ch, 0.5 + 0.05 * j, 2000 + 300 * j, 32 + j)
        t0 = sh["start"]
        for i, tt in enumerate(np.arange(t0, sh["end"], step)):
            g = 0.05 + 0.03 * j * ((tt - t0) / (sh["end"] - t0))
            mus.add(tt, pluck(note(arp[i % len(arp)]), 0.45, 8, 2200 + 600 * j), g, pan=0.5 * np.sin(i * 0.9))
        if j > 0:   # sub pulse joins once building begins
            for tt in np.arange(t0, sh["end"], step * 2):
                mus.add(tt, sine_pad(note(ch[0]), 0.28, 0.01, 0.2, 0.0) * 0.5, 0.35)
    # The shade's panels locking: a rapid run of ticks sweeping outward.
    d = shd["end"] - shd["start"]
    for i, tt in enumerate(np.sort(rng.uniform(shd["start"] + 0.2, shd["end"] - 0.2, 40))):
        sfx.add(tt, hp(noise(0.02), 3000) * np.exp(-np.arange(int(0.02 * SR)) / SR * 220), 0.05, pan=rng.uniform(-0.6, 0.6))
    sfx.add(shd["end"] - 0.6, ping(note("A6"), 2.5, 1.5), 0.05)
    # Asteroid flybys: a whoosh and a low tug at each close pass (orbit.ts FLY: three
    # passes, closest at move = .2, .5, .8; move = (s - 0.3) / (dur - 0.4) in shot time).
    X = tl["cues"]["xfade"]
    a0 = mv["start"] - X / 2
    md = mv["end"] - mv["start"] + X - 0.4
    for k, fly in enumerate((0.2, 0.5, 0.8)):
        tc = a0 + 0.3 + fly * md
        dw = 2.0
        tw = np.arange(int(dw * SR)) / SR
        w = bp(noise(dw), 400, 3000) * np.exp(-((tw - dw / 2) / 0.36) ** 2)
        pan = np.tanh((tw - dw / 2) * 3) * (-1 if k == 1 else 1)   # the second rock crosses right to left
        sfx.add(tc - dw / 2, np.stack([w * (1 - pan) / 2, w * (1 + pan) / 2], 1), 0.09)
        sfx.add(tc, thud(1.4), 0.12)
    sfx.add(mv["start"], boom(4.0) * 0.5, 0.5)

    # ---- Recasting the Sun: the full ensemble, timpani, a roar of plasma -------
    shot_chord(li, ["Bb1", "F2", "Bb2", "D3", "F3", "C4"], 0.72, 3000, 38, a=0.6)
    d = li["end"] - li["start"] + rd["end"] - rd["start"]
    roar = lp(noise(d), 220) * swell(d, 0.6, 1.4) * 0.45
    sfx.add(li["start"], roar, 1)
    for tt in (li["start"] + 0.1, li["start"] + 1.6, rd["start"] + 0.1, rd["start"] + 1.4, rd["start"] + 2.4):
        mus.add(tt, boom(2.5) * 0.45, 0.6)
    shot_chord(rd, ["G1", "D2", "G2", "B2", "E3", "A3"], 0.72, 2600, 39, a=0.6, tail=1.0)
    sfx.add(hp_["start"] - 2.2, riser(2.2), 0.3)

    # ---- Hope: the first resolution, warm and open, under the red dwarf --------
    d = total - hp_["start"] + 1
    chord(mus, hp_["start"] - 0.1, d, ["D2", "A2", "F#3", "A3", "D4", "F#4"], 0.7, a=0.4, r=d * 0.75, bright=2400, seed=40)
    mus.add(hp_["start"], boom(5.0) * 0.5, 0.6)
    mus.add(hp_["start"], sine_pad(note("D5"), d, 0.5, d * 0.7, 0.4) * 0.06, 1)
    for i, (dt, nm) in enumerate([(1.0, "F#5"), (2.2, "A5"), (3.4, "E5"), (4.8, "D5"), (6.4, "A4")]):
        mus.add(hp_["start"] + dt, ping(note(nm), 3.5, 1.0), 0.06, pan=0.4 - 0.2 * i)
    # Waves on the shore.
    for k in range(3):
        tt = hp_["start"] + 0.5 + k * 3.4
        w = lp(noise(3.2), 900) * (np.sin(np.pi * np.arange(int(3.2 * SR)) / (3.2 * SR)) ** 3) * 0.12
        sfx.add(tt, np.stack([w, np.roll(w, 600)], 1), 1)

    music = reverb(mus.buf, 6.5, 0.42)
    effects = reverb(sfx.buf, 3.0, 0.2)
    return music, effects


def synth_pad(freq, dur, open_curve, dark=500, bright=4200, seed=0):
    """Analog-style pad: detuned saws (no vibrato) whose filter opens along open_curve (0..1)."""
    x = saw_ens(freq, dur, voices=6, detune=0.09, vib=0.0, bright=9000, seed=seed)
    lo = np.stack([lp(x[:, c], dark) for c in range(2)], 1)
    hi = np.stack([lp(x[:, c], bright) for c in range(2)], 1)
    k = np.clip(open_curve, 0, 1)[:, None]
    return lo * (1 - k) + hi * k


def synth_chord(track, t0, dur, notes, gain, open_curve, a=1.0, r=2.0, seed=0, **kw):
    for i, nm in enumerate(notes):
        s = synth_pad(note(nm), dur, open_curve, seed=seed * 17 + i, **kw)
        track.add(t0, s * env(len(s), a, r)[:, None], gain / np.sqrt(len(notes)))


def blip(freq, dur=0.08):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 60) * (1 - np.exp(-t * 2000))


def build_ch4(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    lines = {l["id"]: l for l in tl["lines"]}
    X = tl["cues"]["xfade"]
    mus = Track(total + 1)
    sfx = Track(total + 1)
    ve, lf, sw = shots["vessels"], shots["lastforest"], shots["swarm"]
    si, me, vo = shots["silicon"], shots["memory"], shots["voyage"]

    def ramp(n, a, b):
        t = np.arange(n) / SR
        return np.clip((t - a) / max(b - a, 1e-3), 0, 1)

    # ---- Vessels: the last strings of ch3 hand over to synthesizers ------------
    d = ve["end"] + 1.5
    chord(mus, 0, 4.2, ["D2", "A2", "F#3", "D4"], 0.5, a=0.2, r=3.4, bright=2000, seed=50)
    synth_chord(mus, 0.8, d, ["D2", "A2", "E3", "F#3", "B3"], 0.55, ramp(int(d * SR), 0.8, 4.6), a=2.2, r=1.6, seed=51)
    # A digital shimmer climbs with the scan line.
    for i, tt in enumerate(np.arange(1.4, 4.8, 60 / 112 / 4)):
        nm = ["D5", "F#5", "A5", "E6", "B5", "A5"][i % 6]
        mus.add(tt, blip(note(nm) * (1 + (tt - 1.4) / 3.4 * 0.0), 0.12), 0.02 + 0.03 * (tt - 1.4) / 3.4, pan=np.sin(i * 1.3) * 0.6)
    sfx.add(1.3, riser(3.4) * 0.6, 0.18)

    # ---- Last forest: a launch rumbles far away ------------------------------
    d = lf["end"] - lf["start"] + 1.2
    synth_chord(mus, lf["start"] - 0.3, d, ["B1", "F#2", "D3", "A3", "C#4"], 0.5, np.full(int(d * SR), 0.35), a=0.8, r=1.2, seed=52)
    nn = int((d - 0.4) * SR)
    rumble = lp(noise(d - 0.4), 160) * swell(d - 0.4, 0.35, 1.2) * 0.5
    sfx.add(lf["start"] + 0.6, np.stack([rumble, np.roll(rumble, 400)], 1), 1)
    wind = lp(hp(noise(d), 150), 700) * env(int(d * SR), 0.6, 0.8) * 0.04
    sfx.add(lf["start"] - 0.3, np.stack([wind, np.roll(wind, 700)], 1), 1)

    # ---- Swarm + silicon: a sequencer drives the self-copying machines ---------
    step = 60 / 112 / 4
    seq = [(sw, ["G1", "D2", "B2", "F#3", "A3"], ["G3", "D4", "B4", "D4", "F#4", "D4", "A4", "B4"]),
           (si, ["E2", "B2", "G3", "D4", "F#4"], ["E4", "B4", "G4", "D5", "B4", "F#5", "D5", "G4"])]
    for j, (sh, ch, arp) in enumerate(seq):
        a0, a1 = sh["start"] - X / 2, sh["end"] + X / 2
        dd = a1 - a0 + 1.2
        synth_chord(mus, a0, dd, ch, 0.5, 0.3 + 0.5 * ramp(int(dd * SR), 0, dd) * (j + 1) / 2, a=0.5, r=1.2, seed=53 + j)
        for i, tt in enumerate(np.arange(a0, a1, step)):
            prog = (tt - sw["start"]) / (si["end"] - sw["start"])
            g = 0.035 + 0.05 * prog
            mus.add(tt, pluck(note(arp[i % 8]), 0.3, 11, 1500 + 3000 * prog), g, pan=0.55 * np.sin(i * 0.7))
            if i % 4 == 0:   # kick-like sub on the beat
                mus.add(tt, thud(0.5) * 0.6, 0.12 + 0.1 * prog)
            if i % 8 == 4:
                sfx.add(tt, hp(noise(0.05), 6000) * np.exp(-np.arange(int(0.05 * SR)) / SR * 90), 0.03)
    # Every replication in the swarm shader (generation g at t = g * 0.62) chirps.
    for g in range(1, 8):
        for k in range(min(2 ** (g - 1), 6)):
            tt = sw["start"] - X / 2 + g * 0.62 + 0.25 * rng.uniform()
            if tt < sw["end"]:
                sfx.add(tt, blip(note("A6") * 2 ** (rng.integers(-5, 3) / 12), 0.06), 0.035, pan=rng.uniform(-0.7, 0.7))

    # ---- Memory: a node dies, its memory runs on ------------------------------
    l5 = lines["l5"]
    tf = l5["start"] + l5["dur"] * 0.4
    d = me["end"] - me["start"] + 1.4
    synth_chord(mus, me["start"] - 0.3, d, ["A1", "E2", "B2", "D3", "E3", "A3"], 0.55, 0.25 + 0.4 * ramp(int(d * SR), 0, d), a=0.4, r=1.4, seed=56)
    for i, tt in enumerate(np.arange(me["start"] - X / 2, tf, step)):
        mus.add(tt, pluck(note(["A3", "E4", "B4", "E4"][i % 4]), 0.3, 11, 3000), 0.06, pan=0.4 * np.sin(i))
    crack = hp(noise(0.5), 1500) * np.exp(-np.arange(int(0.5 * SR)) / SR * 9)
    sfx.add(tf, crack, 0.12)
    sfx.add(tf, boom(3.0) * 0.5, 0.5)
    for k, nm in enumerate(["E6", "B5", "A5", "E5", "B4"]):    # the packet echoing outward
        mus.add(tf + 0.15 + k * 0.32, ping(note(nm), 2.2, 2.0), 0.07 * 0.8 ** k, pan=(-1) ** k * 0.5)

    # ---- Voyage: one long chord for a journey of millennia --------------------
    d = total - vo["start"] + 1
    swp = 0.2 + 0.5 * (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(int(d * SR)) / SR / 9))
    synth_chord(mus, vo["start"] - 0.4, d, ["D2", "A2", "E3", "F#3", "A3", "C#4", "E4"], 0.7, swp, a=1.4, r=d * 0.6, seed=58)
    chord(mus, vo["start"] + 1.0, d - 1, ["D3", "A3", "F#4"], 0.25, a=3.0, r=d * 0.6, bright=1800, seed=59)
    mus.add(vo["start"] - 0.4, sine_pad(note("D1"), d, 2.0, d * 0.6, 0.07), 0.25)
    sfx.add(vo["start"] - 0.4, boom(6.0) * 0.4, 0.5)
    # The probe's beacon (peaks of sin(2t) in the shader, every pi seconds).
    t_local0 = vo["start"] - X / 2
    k0 = int(np.ceil((0.0 - np.pi / 4) / np.pi))
    for k in range(k0, 20):
        tt = t_local0 + np.pi / 4 + k * np.pi
        if vo["start"] - X / 2 < tt < total - 2:
            mus.add(tt, ping(note("A5"), 2.4, 2.4), 0.04)
            mus.add(tt + 0.42, ping(note("A5"), 2.0, 3.0), 0.015, pan=0.5)

    music = reverb(mus.buf, 6.5, 0.42)
    effects = reverb(sfx.buf, 3.0, 0.2)
    return music, effects


def whale_call(dur, f0, f1, seed=0):
    """A humpback-like moan: a gliding tone with slow vibrato and a few formant-ish harmonics."""
    t = np.arange(int(dur * SR)) / SR
    r = np.random.default_rng(seed)
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    f = f0 * (f1 / f0) ** (0.5 - 0.5 * np.cos(np.pi * t / dur)) * (1 + 0.012 * np.sin(2 * np.pi * (4.5 + r.uniform()) * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.45 * np.sin(2 * ph + 0.3) + 0.2 * np.sin(3 * ph + 1.1) + 0.08 * np.sin(5 * ph)
    s = lp(s, 1800)
    return s * shape * (1 - np.exp(-t * 30))


def build_ch5(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    lines = {l["id"]: l for l in tl["lines"]}
    X = tl["cues"]["xfade"]
    mus = Track(total + 1)
    sfx = Track(total + 1)
    ho, hd, da = shots["handoff"], shots["homedot"], shots["dapple"]
    wh, lg, th, ha = shots["whales"], shots["lastgaze"], shots["thread"], shots["hands"]

    def span(sh, lead=0.4, tail=1.6):
        return sh["start"] - lead, sh["end"] - sh["start"] + lead + tail

    # ---- Handoff: the synths of ch4 settle under returning strings ------------
    d = ho["end"] + 1.2
    synth_chord(mus, 0, d, ["D2", "A2", "E3", "F#3", "A3"], 0.4, 0.15 + 0.35 * np.linspace(0, 1, int(d * SR)), a=1.5, r=2.0, seed=60)
    chord(mus, 1.0, d - 1.0, ["D3", "A3", "F#4", "E5"], 0.4, a=3.0, r=2.2, bright=2400, seed=61)
    # Glyphs arriving in the mind: soft glassy blips, more of them as it fills.
    for k in range(34):
        tt = 1.0 + 6.8 * (k / 34) ** 0.8 + rng.uniform(-0.1, 0.1)
        mus.add(tt, blip(note(["A5", "D6", "E6", "F#6", "A6"][rng.integers(5)]), 0.1), 0.012 + 0.012 * k / 34, pan=rng.uniform(0.1, 0.7))

    # ---- Home, a single point: everything thins to one high tone ---------------
    t0, d = span(hd, 0.5, 1.8)
    chord(mus, t0, d, ["B1", "F#2", "D3"], 0.42, a=1.2, r=2.2, bright=1200, seed=62)
    mus.add(t0 + 0.3, sine_pad(note("F#5"), d - 0.3, 1.5, 2.5, 0.4), 0.05)
    mus.add(t0 + 0.8, ping(note("B5"), 4.0, 0.9), 0.03)

    # ---- Dappled light: warm open strings, leaves in the wind, a bird ---------
    t0, d = span(da, 0.5, 1.6)
    chord(mus, t0, d, ["G2", "D3", "B3", "A4", "D5"], 0.55, a=1.0, r=2.0, bright=3200, seed=63)
    leaves = lp(hp(noise(d), 1200), 6000) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * np.arange(int(d * SR)) / SR)) * env(int(d * SR), 0.8, 1.2)
    sfx.add(t0, np.stack([leaves, np.roll(leaves, 1100)], 1), 0.03)
    for i, tt in enumerate(np.arange(da["start"] + 0.3, da["end"], 0.55)):
        mus.add(tt + rng.uniform(-0.08, 0.08), ping(note(["D6", "B5", "G6", "A5", "D7", "B6"][i % 6]), 2.0, 1.8), 0.035, pan=rng.uniform(-0.6, 0.6))
    for k in range(2):
        tb = da["start"] + 1.0 + k * 1.6
        for j in range(3):
            tt = np.arange(int(0.09 * SR)) / SR
            f = 3800 + 1400 * np.sin(np.pi * tt / 0.09) + j * 120
            chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.09) ** 2
            sfx.add(tb + j * 0.13, chirp, 0.012, pan=-0.5)

    # ---- Whales: low strings and their song -----------------------------------
    t0, d = span(wh, 0.5, 1.8)
    chord(mus, t0, d, ["E1", "B1", "G2", "D3", "F#3"], 0.6, a=1.0, r=2.2, bright=900, seed=64)
    water = lp(noise(d), 220) * env(int(d * SR), 0.8, 1.2)
    sfx.add(t0, np.stack([water, np.roll(water, 2000)], 1), 0.12)
    a0 = wh["start"] - X / 2
    calls = [(1.9, 180, 420), (1.5, 520, 300), (1.8, 140, 260)]
    for k in range(3):
        tt = a0 + 0.4 + k * 2.6
        if tt < wh["end"] + 0.4:
            dd, f0, f1 = calls[k]
            mus.add(tt, whale_call(dd, f0, f1, seed=k), 0.09, pan=(-0.3, 0.3, 0.0)[k])
            mus.add(tt + 0.9, whale_call(dd * 0.8, f1 * 1.5, f0 * 1.5, seed=k + 9), 0.03, pan=0.6)

    # ---- The long-gone stargazer: ch1's question chord, recalled ---------------
    t0, d = span(lg, 0.5, 1.6)
    chord(mus, t0, d, ["D2", "A2", "E3", "G3", "A3", "E4"], 0.5, a=1.2, r=2.2, bright=2200, seed=9)
    mus.add(t0 + 0.4, sine_pad(note("E5"), d - 0.4, 1.0, 2.0, 0.5), 0.04)
    for i, tt in enumerate(np.arange(lg["start"] + 0.9, lg["end"], 0.45)):
        mus.add(tt, ping(note(["E6", "D6", "A5", "E6", "B5", "A5", "D6", "E5", "A5"][i % 9]), 2.5, 1.6), 0.03 * (0.92 ** i), pan=rng.uniform(-0.4, 0.4))

    # ---- The thread: strings gather, still in D ------------------------------
    t0, d = span(th, 0.5, 1.6)
    chord(mus, t0, d, ["D2", "A2", "D3", "F#3", "A3", "E4", "A4"], 0.62, a=0.9, r=2.0, bright=2600, seed=65)
    swl = swell(d, 0.8, 1.6)
    chord(mus, t0 + 0.6, d - 0.6, ["F#4", "A4", "D5"], 0.2, a=2.0, r=1.4, bright=3600, seed=66)
    for i, tt in enumerate(np.arange(th["start"], th["end"], 0.5)):
        mus.add(tt, ping(note("A5") if i % 2 else note("D6"), 1.4, 3.0), 0.02)

    # ---- Hands: trembling strings in the cold, then the light rises ----------
    l9 = lines["l9"]
    tr = l9["start"] + l9["dur"] * 0.55
    t0 = ha["start"] - 0.5
    d = tr - t0 + 1.5
    tt = np.arange(int(d * SR)) / SR
    trem = (0.62 + 0.38 * np.sin(2 * np.pi * (6.5 + 0.6 * np.sin(tt * 0.7)) * tt))[:, None]
    for i, nm in enumerate(["B2", "F#3", "D4", "E4", "A4"]):
        sv = saw_ens(note(nm), d, bright=2000, seed=70 + i)
        mus.add(t0, sv * trem * env(len(sv), 1.0, 1.5)[:, None], 0.5 / np.sqrt(5))
    mus.add(t0, sine_pad(note("B1"), d, 1.5, 1.5, 0.08), 0.2)
    wind = lp(hp(noise(total - t0), 200), 1500) * env(int((total - t0) * SR), 1.0, 3.0)
    wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.17 * np.arange(len(wind)) / SR + 1)
    sfx.add(t0, np.stack([wind, np.roll(wind, 1500)], 1), 0.05)
    # The light leaves: an open D chord blooms upward as it climbs.
    d2 = total - tr + 1
    chord(mus, tr - 0.3, d2, ["D2", "A2", "E3", "F#3", "A3", "D4", "E4", "A4"], 0.62, a=2.2, r=d2 * 0.55, bright=3200, seed=72)
    sfx.add(tr - 0.6, riser(1.4) * 0.5, 0.06)
    for k, nm in enumerate(["A4", "D5", "E5", "F#5", "A5", "D6", "E6", "A6"]):
        mus.add(tr + k * 0.48, ping(note(nm), 4.0, 1.0), 0.04 + 0.006 * k, pan=0.15 * np.sin(k))
    # It settles as a star: one high bell left ringing.
    mus.add(tr + 4.2, ping(note("A6"), 6.0, 0.55), 0.06)
    mus.add(tr + 4.2, sine_pad(note("D7") / 2, total - tr - 4.2 + 1, 0.8, 3.0, 0.3), 0.025)

    music = reverb(mus.buf, 6.5, 0.42)
    effects = reverb(sfx.buf, 3.0, 0.2)
    return music, effects


def build_ch6(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    lines = {l["id"]: l for l in tl["lines"]}
    X = tl["cues"]["xfade"]
    mus = Track(total + 1)
    sfx = Track(total + 1)
    wa, ru, dy, em, go = (shots[k] for k in ("wane", "rust", "dyson", "ember", "goout"))
    ab, inf, sp, st = (shots[k] for k in ("abyss", "infall", "spin", "starve"))

    def span(sh, lead=0.4, tail=1.6):
        return sh["start"] - lead, sh["end"] - sh["start"] + lead + tail

    def lin(n, a, b):
        return np.linspace(a, b, n)

    # ---- Wane: ch5's open D, its filter slowly closing and the third falling to minor --
    d = wa["end"] + 1.5
    n = int(d * SR)
    closing = lin(n, 0.6, 0.0) ** 1.5
    synth_chord(mus, 0, d, ["D2", "A2", "D3", "A3", "E4"], 0.5, closing, a=0.4, r=2.4, seed=80)
    mus.add(0, synth_pad(note("F#3"), 2.6, np.full(int(2.6 * SR), 0.5), seed=81) * env(int(2.6 * SR), 0.2, 2.0)[:, None], 0.18)
    fpad = synth_pad(note("F3"), d - 2.2, closing[int(2.2 * SR):][: int((d - 2.2) * SR)], seed=82)
    mus.add(2.2, fpad * env(len(fpad), 1.5, 2.4)[:, None], 0.18)
    for k in range(10):
        tt = 1.2 + k * 0.45 * (1 + 0.12 * k)
        mus.add(tt, blip(note(["A5", "E6", "D6", "A5", "F5"][k % 5]), 0.1), 0.02 * 0.85 ** k, pan=rng.uniform(-0.5, 0.5))

    # ---- Rust: low hum breaking up, crackle, failing blips -----------------------
    t0, d = span(ru, 0.4, 1.2)
    n = int(d * SR)
    tt = np.arange(n) / SR
    gate = (np.sin(2 * np.pi * 7.3 * tt) + 0.6 * np.sin(2 * np.pi * 2.1 * tt + 1) > -0.4 + 1.2 * tt / d).astype(float)
    gate = lp(gate, 60)
    hum = (np.sin(2 * np.pi * 60 * tt) + 0.4 * np.sin(2 * np.pi * 120 * tt) + 0.2 * np.sin(2 * np.pi * 180 * tt)) * env(n, 0.3, 1.0)
    sfx.add(t0, hum * gate, 0.06)
    crack = noise(d) * (rng.uniform(size=n) > 0.9993) * 6
    sfx.add(t0, hp(crack, 1500) * (0.4 + tt / d), 0.05)
    chord(mus, t0, d + 0.5, ["D2", "A2", "F3"], 0.35, a=0.6, r=1.8, bright=900, seed=83)
    for k in range(9):
        tb = ru["start"] + 0.3 + k * 0.33
        if rng.uniform() < 0.8 - k * 0.07:
            mus.add(tb, blip(note(["D6", "C6", "A5", "F5"][k % 4]) * (1 - 0.01 * k), 0.12), 0.02, pan=rng.uniform(-0.6, 0.6))
    sfx.add(ru["start"] + 0.5, thud(1.4), 0.05)

    # ---- Dyson: matter and energy -- a steady synth chord with a pulse ----------
    t0, d = span(dy, 0.5, 1.8)
    n = int(d * SR)
    synth_chord(mus, t0, d, ["D2", "A2", "F3", "C4", "E4"], 0.55, 0.15 + 0.45 * swell(d, 0.75, 1.4), a=1.0, r=2.0, seed=84)
    for i, tb in enumerate(np.arange(dy["start"], dy["end"] + 0.6, 0.25)):
        mus.add(tb, pluck(note(["D3", "A3", "D4", "F4", "A3", "C4", "D4", "E4"][i % 8]), 0.4, 9.0, 1800), 0.08, pan=0.3 * np.sin(i * 0.8))
    mus.add(t0, sine_pad(note("D1"), d, 1.0, 2.0, 0.05), 0.12)

    # ---- Ember: the last star cooling -- low strings sliding down, a final flare ---
    t0, d = span(em, 0.5, 1.8)
    n = int(d * SR)
    chord(mus, t0, d, ["D2", "A2", "D3", "F3", "A3"], 0.55, a=1.0, r=2.6, bright=1400, seed=85)
    tt = np.arange(n) / SR
    glide = note("A3") * 2 ** (-(np.clip((tt - 1.0) / (d - 2.5), 0, 1) ** 1.3) * 7 / 12)
    gl = np.sin(2 * np.pi * np.cumsum(glide) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(glide) / SR)
    mus.add(t0, gl * env(n, 1.2, 2.0), 0.05)
    a0 = em["start"] - X / 2
    flare = a0 + 0.6 + 0.533 * (em["end"] - em["start"] - 0.9 + X)
    sfx.add(flare - 0.5, riser(0.6) * 0.6, 0.05)
    sfx.add(flare, boom(5.0), 0.12)
    mus.add(flare, ping(note("D5"), 4.0, 0.9), 0.04)

    # ---- Go out: each star a falling ping; under it, three notes keep walking ------
    t0, d = span(go, 0.4, 1.8)
    mus.add(t0, sine_pad(note("D2"), d, 1.0, 2.2, 0.06), 0.2)
    k = 0
    for tb in np.sort(rng.uniform(go["start"], go["end"] - 0.3, 18)):
        mus.add(tb, ping(note(["A6", "F6", "D6", "C6", "A5", "F5"][k % 6]) * (0.995 ** k), 1.6, 3.0), 0.022 * (0.94 ** k), pan=rng.uniform(-0.8, 0.8))
        k += 1
    line5 = lines["l5"]
    walk = line5["start"] + line5["dur"] * 0.55   # "远征仍未结束"
    for j, nm in enumerate(["D4", "E4", "A4", "D4", "E4", "A4", "D5"]):
        mus.add(walk + j * 0.42, pluck(note(nm), 1.2, 3.0, 2400), 0.12, pan=-0.2 + 0.07 * j)

    # ---- The abyss: minimalism. A sub drone and a slow ostinato that runs on ------
    t0 = ab["start"] - 0.5
    d = total - t0 + 1
    n = int(d * SR)
    tt = np.arange(n) / SR
    starve_at = st["start"] - t0
    fade = np.clip(1 - (tt - starve_at - 2.0) / (d - starve_at - 3.0), 0, 1) ** 1.4
    fade[tt < starve_at + 2.0] = 1
    sub = (np.sin(2 * np.pi * note("D1") * tt) + 0.5 * np.sin(2 * np.pi * note("A1") * tt + 0.7)) * env(n, 3.0, 2.0)
    mus.add(t0, sub * fade, 0.28)
    apad = sine_pad(note("A2"), d - 1, 4.0, 3.0, 0.07)
    mus.add(t0 + 1.0, apad * fade[int(SR):][: len(apad)], 0.06)
    # Ostinato: an 8-step figure on D. It enters at the abyss, speeds a little and gains
    # notes with the spin, and loses them one by one as the hole starves.
    pat = ["D4", "A4", "E5", "A4", "D4", "A4", "F5", "A4"]
    step = 0.32
    tb, i = ab["start"] + 0.6, 0
    l7 = lines["l7"]
    while tb < total - 2.0:
        in_spin = sp["start"] <= tb < st["start"]
        in_starve = tb >= st["start"]
        k = (tb - st["start"]) / (st["end"] - st["start"] - 3.0) if in_starve else 0
        drop = in_starve and rng.uniform() < np.clip(k * 1.2, 0, 1)
        if not drop:
            g = 0.06 if tb < inf["start"] else 0.075
            if in_starve:
                g *= 1 - 0.8 * np.clip(k, 0, 1)
            pan = 0.5 * np.sin(i * (0.9 if in_spin else 0.4))
            mus.add(tb, ping(note(pat[i % 8]), 1.8, 2.4), g, pan=pan)
            if in_spin and i % 2 == 0:
                mus.add(tb + step / 2, ping(note(pat[(i + 3) % 8]) * 2, 1.0, 4.0), g * 0.4, pan=-pan)
        i += 1
        tb += step * (0.85 if in_spin else 1.0)
    # Infall: matter falling in -- a long rising roar and a lit chord.
    t0i, di = span(inf, 0.6, 1.0)
    roar = lp(noise(di), 500) * (np.linspace(0, 1, int(di * SR)) ** 2) * env(int(di * SR), 0.5, 0.8)
    sfx.add(t0i, np.stack([roar, np.roll(roar, 800)], 1), 0.1)
    sfx.add(t0i + 0.2, riser(di - 0.6) * 0.6, 0.05)
    chord(mus, inf["start"], di + 1.0, ["D3", "A3", "E4", "A4"], 0.22, a=1.0, r=2.0, bright=2000, seed=86)
    # Cities lighting up at the edge of the abyss: warm chimes round the ring.
    ci = shots["cities"]
    for j, nm in enumerate(["A5", "D6", "E6", "F#6", "A6", "E6", "D6"]):
        mus.add(ci["start"] + 0.2 + j * 0.42, ping(note(nm), 3.0, 1.4), 0.035, pan=-0.7 + 0.23 * j)
    chord(mus, ci["start"] - 0.2, ci["end"] - ci["start"] + 1.6, ["D3", "F#3", "A3", "E4"], 0.2, a=0.8, r=1.6, bright=2200, seed=88)
    # Spin: a slow rotating whoosh.
    t0s, ds = span(sp, 0.3, 0.8)
    ns = int(ds * SR)
    ts = np.arange(ns) / SR
    wh = bp(noise(ds), 250, 900) * env(ns, 1.0, 1.0)
    rot = np.sin(2 * np.pi * 0.7 * ts)
    sfx.add(t0s, np.stack([wh * (1 + rot) / 2, wh * (1 - rot) / 2], 1), 0.06)
    synth_chord(mus, sp["start"], ds, ["D2", "A2", "E3", "A3"], 0.25, np.full(ns, 0.3), a=1.5, r=1.8, seed=87)
    # Starve: one last low tone left when the ostinato is gone.
    mus.add(st["end"] - 6.0, sine_pad(note("D2"), 7.0, 2.0, 4.5, 0.03), 0.08)

    music = reverb(mus.buf, 7.5, 0.45)
    effects = reverb(sfx.buf, 3.0, 0.2)
    return music, effects


def build_ch7(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    lines = {l["id"]: l for l in tl["lines"]}
    mus = Track(total + 1)
    sfx = Track(total + 1)
    ed, hk, wk, va = (shots[k] for k in ("edge", "hawking", "wake", "vanish"))

    def at(i, k):
        return lines[i]["start"] + lines[i]["dur"] * k

    # Same moments as Chapter7.tsx.
    wake_a, msg, wake_b, flash = at("l5", 0.62), at("l5", 0.8), at("l6", 1.0) + 0.3, at("l8", 0.86)

    # ---- Edge: almost silence. The last low D from ch6, and one tone left hanging. ----
    mus.add(0, sine_pad(note("D2"), hk["end"] + 1.5, 2.0, 2.5, 0.03), 0.14)
    mus.add(at("l1", 0.55), ping(note("A4"), 6.0, 0.5), 0.05)
    mus.add(at("l1", 0.55) + 0.02, ping(note("D5"), 6.0, 0.55), 0.03, pan=0.3)

    # ---- Hawking: the faintest radiation -- sparse high grains, more as it goes. -------
    t0 = hk["start"] - 0.4
    d = hk["end"] - t0 + 1.4
    mus.add(t0 + 0.5, sine_pad(note("A1"), d, 3.0, 2.5, 0.02), 0.08)
    for tb in np.sort(rng.uniform(hk["start"] + 0.8, hk["end"], 22)):
        k = (tb - hk["start"]) / (hk["end"] - hk["start"])
        if rng.uniform() < 0.3 + 0.6 * k:
            mus.add(tb, blip(note(rng.choice(["A6", "E7", "D7", "A7"])), 0.06), 0.006 + 0.008 * k, pan=rng.uniform(-0.9, 0.9))

    # ---- Wake: two notes, a long way apart. ------------------------------------------
    t0 = wk["start"] - 0.4
    d = wk["end"] - t0 + 1.6
    mus.add(t0, sine_pad(note("D2"), d, 2.5, 2.5, 0.025), 0.12)
    # A wakes: a warm chord blooms and fades.
    chord(mus, wake_a - 0.1, 4.5, ["D3", "A3", "F#4"], 0.18, a=0.6, r=3.4, bright=1600, seed=90)
    mus.add(wake_a, ping(note("A4"), 5.0, 0.7), 0.06, pan=-0.5)
    # The conversation: a slow thread of notes crossing left to right.
    n_steps = 9
    for j in range(n_steps):
        tb = msg + (wake_b - msg) * j / n_steps
        nm = ["D5", "E5", "F#5", "A5", "F#5", "E5", "A5", "B5", "A5"][j]
        mus.add(tb, ping(note(nm), 2.5, 1.6), 0.025, pan=-0.6 + 1.2 * j / (n_steps - 1))
    # B wakes on receiving it: the answering chord.
    chord(mus, wake_b - 0.1, 4.0, ["E3", "B3", "A4"], 0.16, a=0.6, r=3.0, bright=1600, seed=91)
    mus.add(wake_b, ping(note("E5"), 5.0, 0.7), 0.05, pan=0.5)
    # They slow their thinking: the same two notes, further and further apart, softer.
    sleep = at("l6b", 0.1)
    for j, dt in enumerate([0.0, 1.6, 3.6, 6.2]):
        mus.add(sleep + dt, ping(note(["A4", "E5"][j % 2]), 5.0, 0.7), 0.045 * 0.72 ** j, pan=-0.5 if j % 2 == 0 else 0.5)

    # ---- Vanish: a rising, thinning tone as the hole heats, then the burst and silence. -
    t0 = va["start"] - 0.4
    d = flash - t0
    n = int(d * SR)
    x = np.linspace(0, 1, n)
    f = note("D3") * 2 ** (np.log2(note("A6") / note("D3")) * x ** 3)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.2 * np.sin(2 * ph)) * (0.25 + 0.75 * x ** 2) * env(n, 2.0, 0.02)
    mus.add(t0, tone, 0.06)
    # Crackle of escaping particles, denser as it heats up.
    grains = noise(d) * (rng.uniform(size=n) > 1 - (0.0002 + 0.004 * x ** 3)) * 4
    sfx.add(t0, hp(grains, 3000), 0.04)
    mus.add(t0, sine_pad(note("D2"), d + 1.0, 2.0, 1.0, 0.02), 0.12)
    # The burst: a soft bright chord and a low bloom that leave a long silence.
    sfx.add(flash - 0.35, riser(0.4) * 0.6, 0.05)
    mus.add(flash, ping(note("D6"), 7.0, 0.55), 0.08)
    mus.add(flash, ping(note("A6"), 7.0, 0.6), 0.05, pan=0.25)
    chord(mus, flash, total - flash + 1, ["D3", "A3", "E4", "A4", "D5"], 0.16, a=0.05, r=total - flash - 0.2, bright=3000, seed=92)
    sfx.add(flash, boom(6.0), 0.07)

    music = reverb(mus.buf, 9.0, 0.5)
    effects = reverb(sfx.buf, 4.0, 0.3)
    return music, effects


def build_ch8(tl):
    total = tl["total"]
    shots = {s["shot"]: s for s in tl["shots"]}
    lines = {l["id"]: l for l in tl["lines"]}
    X = tl["cues"]["xfade"]
    mus = Track(total + 1)
    sfx = Track(total + 1)
    li, fi, la, hd, sh, sg, da = (shots[k] for k in ("lineage", "first", "last", "homedot", "shallows", "stargazer", "dawn"))
    def at(i, k):
        return lines[i]["start"] + lines[i]["dur"] * k

    def ease(x):
        c = np.clip(x, 0, 1)
        return c * c * (3 - 2 * c)

    def ease_inv(y):
        xs = np.linspace(0, 1, 4001)
        return float(np.interp(y, ease(xs), xs))

    # ---- Lineage: strings return, and each form along the thread rings as it appears --
    t0 = li["start"]
    d = li["end"] + 1.6
    chord(mus, 0, d, ["D2", "A2", "D3", "F#3", "A3", "E4"], 0.5, a=1.2, r=2.0, bright=2200, seed=100)
    mus.add(0, sine_pad(note("D1"), d, 2.0, 2.0, 0.05), 0.15)
    # Same camera move as Chapter8.tsx: pan = -0.4 + 2.6 * ease((s - 0.2) / (dur - 0.4)).
    a0 = 0.0
    dur = li["end"] + X / 2 - a0
    notes = ["D4", "E4", "F#4", "A4", "B4", "D5", "E5", "A5"]
    for i in range(8):
        fx = -0.8 + 0.5 * i
        y = (fx - 0.7 + 0.4) / 2.6
        if y <= 0.02:
            tt = 0.6 + 0.35 * i
        elif y < 1:
            tt = a0 + 0.2 + ease_inv(y) * (dur - 0.4)
        else:
            tt = a0 + dur - 1.4
        mus.add(tt, ping(note(notes[i]), 3.5, 1.1), 0.05, pan=-0.6 + 0.17 * i)
        mus.add(tt, pluck(note(notes[i]) / 2, 1.0, 3.0, 2000), 0.06, pan=-0.6 + 0.17 * i)

    # ---- First: the first life alone; the sea chord thins toward the unimaginable --
    d = fi["end"] - fi["start"] + 1.8
    chord(mus, fi["start"] - 0.4, d, ["D2", "A2", "F3", "E4"], 0.4, a=0.9, r=1.8, bright=1300, seed=2)
    mus.add(fi["start"] + 0.4, ping(note("D4"), 3.5, 1.1), 0.05, pan=-0.5)
    mus.add(at("l3", 0.75), ping(note("E6"), 4.0, 0.9), 0.02, pan=0.6)

    # ---- Last: the traveller remembers -- the lineage notes run back, right to left --
    d = la["end"] - la["start"] + 1.8
    chord(mus, la["start"] - 0.4, d, ["B1", "F#2", "D3", "A3"], 0.4, a=1.0, r=1.8, bright=1300, seed=62)
    mem = at("l4", 0.45)    # Chapter8.tsx MEM_A
    for j, nm in enumerate(reversed(notes)):
        mus.add(mem + j * 0.22, ping(note(nm), 2.6, 1.4), 0.04 * (1 - 0.05 * j), pan=0.6 - 0.17 * j)

    # ---- Memories: blue planet, warm sea, the one who looked up. One long swell ------
    t0 = hd["start"] - 0.4
    d = da["start"] - t0 + 1.0
    sw = swell(d, (sg["end"] - 0.3 - t0) / d, 1.6)[:, None]
    for i, nm in enumerate(["D2", "A2", "D3", "F#3", "A3", "D4", "E4", "F#4", "A4", "D5"]):
        sv = saw_ens(note(nm), d, bright=3200, seed=110 + i)
        mus.add(t0, sv * sw * env(len(sv), 0.5, 1.2)[:, None], 0.7 / np.sqrt(10))
    # Home dot: ch5's high tone.
    mus.add(hd["start"] - 0.2, sine_pad(note("F#5"), hd["end"] - hd["start"] + 1.0, 1.0, 1.2, 0.4), 0.04)
    mus.add(hd["start"] + 0.4, ping(note("B5"), 4.0, 0.9), 0.03)
    # Warm sea: ch1's bubbles and murmur.
    d2 = sh["end"] - sh["start"] + 1.0
    for k in range(5):
        sfx.add(sh["start"] + rng.uniform(0, d2 - 1), ping(rng.uniform(500, 1400), 0.25, 18) * 0.5, 0.035, pan=rng.uniform(-0.8, 0.8))
    sfx.add(sh["start"] - 0.4, lp(noise(d2), 400) * env(int(d2 * SR), 0.5, 0.8) * 0.08, 1)
    # The stargazer: ch1's star pings over the peak.
    for i, tt in enumerate(np.arange(sg["start"] + 0.3, sg["end"], 0.6)):
        pent = ["D6", "E6", "A6", "F#6", "A5", "D7"]
        mus.add(tt + rng.uniform(-0.08, 0.08), ping(note(pent[i % len(pent)]), 3.0, 1.3), 0.045, pan=rng.uniform(-0.6, 0.6))

    # ---- Dawn: quiet before the sun; then the final chord, held and left to decay -----
    sunrise = at("l8", 0.55)
    mus.add(da["start"] - 0.3, sine_pad(note("D2"), sunrise - da["start"] + 2, 1.2, 1.5, 0.04), 0.14)
    chord(mus, at("l7", 0) - 0.2, sunrise - at("l7", 0) + 1.0, ["D3", "A3", "E4"], 0.22, a=1.5, r=1.2, bright=1500, seed=120)
    sfx.add(sunrise - 1.6, riser(1.7) * 0.7, 0.12)
    sfx.add(sunrise, boom(9.0), 0.7)
    # The extremely long final chord: everything, then nothing, until the last frame.
    d = total - sunrise + 1.0
    final = ["D1", "D2", "A2", "D3", "F#3", "A3", "D4", "E4", "F#4", "A4", "D5", "E5", "A5"]
    tt = np.arange(int(d * SR)) / SR
    decay = np.exp(-tt / 9.0)
    # The filter closes as it decays so the tail darkens rather than just softening.
    for i, nm in enumerate(final):
        sv = saw_ens(note(nm), d, bright=3600 if note(nm) < 800 else 2400, seed=130 + i)
        dark = np.stack([lp(sv[:, c], 700) for c in range(2)], 1)
        k = np.clip(tt / 14, 0, 1)[:, None]
        sv = sv * (1 - k) + dark * k
        mus.add(sunrise - 0.05, sv * (decay * env(len(tt), 0.25, 3.0))[:, None], 0.85 / np.sqrt(len(final)))
    mus.add(sunrise, sine_pad(note("D6"), d, 0.8, d * 0.9, 0.2) * decay ** 0.6, 0.03)
    mus.add(sunrise + 0.1, ping(note("A6"), 9.0, 0.4), 0.05)
    mus.add(sunrise + 0.1, ping(note("D6"), 9.0, 0.35), 0.06, pan=-0.2)
    # One last high bell under the end card.
    tl_black = sunrise + 12.0
    mus.add(tl_black + 1.6, ping(note("D6"), 6.0, 0.6), 0.025)

    music = reverb(mus.buf, 10.0, 0.5)
    effects = reverb(sfx.buf, 4.0, 0.3)
    return music, effects


BUILD = {"ch1": build_ch1, "ch2": build_ch2, "ch3": build_ch3, "ch4": build_ch4, "ch5": build_ch5, "ch6": build_ch6, "ch7": build_ch7, "ch8": build_ch8}


def vo_track(tl, total):
    vo = Track(total + 1)
    for ln in tl["lines"]:
        x, sr = sf.read(str(ROOT / f"public/vo/{tl['chapter']}/{ln['id']}.wav"))
        assert sr == SR
        vo.add(ln["start"], x, 1.0)
    # Light room tone so the voice sits in the same space as the score.
    return reverb(vo.buf, 1.6, 0.12)


def duck(tl, n):
    """Gain curve lowering the score while the narrator speaks."""
    g = np.ones(n)
    for ln in tl["lines"]:
        a, b = int((ln["start"] - 0.25) * SR), int((ln["end"] + 0.3) * SR)
        g[max(0, a):b] = np.minimum(g[max(0, a):b], 0.5)
    k = int(0.3 * SR)
    c = np.concatenate([[0], np.cumsum(np.pad(g, (k // 2, k - k // 2), mode="edge"))])
    g = (c[k:] - c[:-k])[: len(g)] / k
    return g[:, None]


def master(x, peak_db=-1.0, ref=None):
    """Soft-clip and normalise; with `ref`, use the gain that would normalise `ref` instead."""
    y = np.tanh(x * 1.1) / 1.1
    p = np.abs(np.tanh((x if ref is None else ref) * 1.1) / 1.1).max()
    return y / p * 10 ** (peak_db / 20)


def main(ch):
    tl = json.loads((ROOT / f"src/{ch}/timeline.json").read_text())
    total = tl["total"]
    music, effects = BUILD[ch](tl)
    n = int(total * SR)
    music, effects = music[:n], effects[:n]
    fade = np.ones(n)
    fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR)) ** 2
    out = ROOT / "public/music"
    out.mkdir(parents=True, exist_ok=True)

    a = (music + effects) * fade[:, None]
    sf.write(str(out / f"{ch}_music.wav"), master(a), SR, subtype="PCM_24")

    vo = vo_track(tl, total)[:n]
    b0 = music * duck(tl, n) * 0.85 + effects * 0.85 + vo * 1.15
    b = b0 * fade[:, None]
    sf.write(str(out / f"{ch}_narr.wav"), master(b), SR, subtype="PCM_24")
    # The same mixes without the closing fade, at the same level, for the full film
    # (gen_full.py crossfades each chapter into the next instead).
    sf.write(str(out / f"{ch}_music_seam.wav"), master(music + effects, ref=a), SR, subtype="PCM_24")
    sf.write(str(out / f"{ch}_narr_seam.wav"), master(b0, ref=b), SR, subtype="PCM_24")
    print("wrote", out / f"{ch}_music.wav", out / f"{ch}_narr.wav", f"{total:.2f}s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ch1")
