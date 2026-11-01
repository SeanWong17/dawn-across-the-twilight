"""Lay the eight chapters end to end as one continuous film.

Usage: python scripts/gen_full.py   (after gen_music.py has written every chapter)
Writes src/full.json (where each chapter starts and how it meets the next, read by
src/Full.tsx) and public/music/full_{music,narr}.wav.

Instead of each chapter closing on black and the next opening from it, the next
chapter's picture dissolves in over the previous one's last shot, and its score fades
in under the previous one's tail. The narration gap across a join is GAP seconds, a
little longer than a paragraph break inside a chapter.
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
FPS = 30
GAP = 3.4          # end of a chapter's last line → start of the next chapter's first line
CHAPTERS = [f"ch{i}" for i in range(1, 9)]


def line(tl, id_):
    return next(l for l in tl["lines"] if l["id"] == id_)


def earliest_next(ch, tl):
    """Chapter-specific moments that must play out before the next chapter may begin."""
    if ch == "ch5":
        # The light leaves the hands and settles as a star (Chapter5.tsx RISE_AT + 4.2 s);
        # give it a moment as a star before the dissolve.
        l9 = line(tl, "l9")
        return l9["start"] + l9["dur"] * 0.55 + 4.2 + 1.2
    if ch == "ch7":
        # The last black hole flashes out (Chapter7.tsx FLASH_G) and the picture goes black
        # by FLASH_G + 3.6; hold a beat of black before the Earth's lineage fades up.
        l8 = line(tl, "l8")
        return l8["start"] + l8["dur"] * 0.86 + 3.6 + 1.0
    return 0.0


def main():
    tls = {ch: json.loads((ROOT / f"src/{ch}/timeline.json").read_text()) for ch in CHAPTERS}
    entries = []
    off = 0  # frames
    for i, ch in enumerate(CHAPTERS):
        tl = tls[ch]
        first = tl["lines"][0]["start"]
        e = {"chapter": ch, "from": off, "frames": tl["frames"]}
        if i > 0:
            prev, ptl = entries[-1], tls[CHAPTERS[i - 1]]
            pch = CHAPTERS[i - 1]
            # Where, in the previous chapter's own time, this one begins.
            at = max(ptl["lines"][-1]["end"] + GAP - first, earliest_next(pch, ptl))
            at = min(at, ptl["total"] - 0.5)
            start = prev["from"] + int(round(at * FPS))
            # ch8 opens from black after ch7's blackout: a cut on black, no dissolve.
            dis = 0.0 if ch == "ch8" else float(np.clip(first - 0.15, 0.8, 1.4))
            e.update({"from": start, "dissolveIn": round(dis, 3)})
            # The previous chapter keeps its own closing darkening where it means something:
            # the hands dimming to one star (ch5) and the blackout after the last flash (ch7).
            prev["joinedOut"] = pch not in ("ch5", "ch7")
            # It only needs to run until this one is fully in.
            prev["frames"] = min(ptl["frames"], start - prev["from"] + int(np.ceil(max(dis, 0.1) * FPS)) + 1)
            prev["next"] = start - prev["from"]
        else:
            e["dissolveIn"] = 0.0
        e.setdefault("joinedOut", False)
        entries.append(e)
    total = entries[-1]["from"] + tls["ch8"]["frames"]
    (ROOT / "src/full.json").write_text(json.dumps({"fps": FPS, "frames": total, "chapters": entries}, indent=2))

    for kind in ("music", "narr"):
        out = np.zeros((int(total / FPS * SR) + SR, 2))
        for i, e in enumerate(entries):
            x, sr = sf.read(str(ROOT / f"public/music/{e['chapter']}_{kind}_seam.wav"))
            assert sr == SR
            x = x.copy()
            # The next chapter's score fades in over its first second; this one fades out from
            # the moment the next begins, over the rest of its tail (equal power).
            nh = int(0.05 * SR)
            x[:nh] *= np.linspace(0, 1, nh)[:, None]
            if "next" in e:
                a = int(e["next"] / FPS * SR)
                fl = max(len(x) - a, 1)
                g = np.cos(np.linspace(0, np.pi / 2, fl)) ** 2
                x[a:] *= g[:, None][: len(x) - a]
            else:
                f = int(1.5 * SR)
                x[-f:] *= (np.linspace(1, 0, f) ** 2)[:, None]
            i0 = int(round(e["from"] / FPS * SR))
            out[i0:i0 + len(x)] += x
        out = out[: int(total / FPS * SR)]
        peak = np.abs(out).max()
        if peak > 0.95:  # an overlap summed above the chapters' own -1 dBFS peak
            out = np.tanh(out / 0.95) * 0.95 if peak < 1.3 else out * (0.95 / peak)
        sf.write(str(ROOT / f"public/music/full_{kind}.wav"), out, SR, subtype="PCM_24")
        print(f"full_{kind}.wav peak before limit {20 * np.log10(peak):.2f} dBFS")

    for i, e in enumerate(entries):
        nxt = f"next at {e['next'] / FPS:6.2f}s" if "next" in e else ""
        print(f"{e['chapter']} from {e['from'] / FPS:7.2f}s  dissolveIn {e['dissolveIn']:.2f}  joinedOut {e['joinedOut']!s:5}  runs {e['frames'] / FPS:6.2f}s {nxt}")
    print(f"total {total / FPS:.2f}s ({total} frames)")


if __name__ == "__main__":
    main()
