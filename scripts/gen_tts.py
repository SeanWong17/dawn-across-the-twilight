"""Generate per-line narration with edge-tts and build the chapter timeline.

Usage: python scripts/gen_tts.py ch1
Writes public/vo/<ch>/<id>.wav and src/<ch>/timeline.json.

Pacing is driven by the narration at a normal reading speed: the gap after each line
comes from its closing punctuation (PAUSE), plus a longer breath at paragraph ends.
A line may override this with "post". A shot is held for at least "minShot" seconds.
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import edge_tts
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent

PAUSE = {"，": 0.28, "、": 0.2, "——": 0.32, "：": 0.38, "；": 0.42, "。": 0.6, "？": 0.75}
PARA = 1.3        # extra breath at the end of a paragraph
LEAD = 0.35       # a new shot appears this long before its first line
MIN_SHOT = 3.0


def pause_after(zh: str) -> float:
    for mark, s in PAUSE.items():
        if zh.endswith(mark):
            return s
    return 0.3


async def synth(text: str, voice: str, rate: str, pitch: str, out_mp3: Path) -> None:
    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(out_mp3))


def main(ch: str) -> None:
    spec = json.loads((ROOT / f"scripts/{ch}_script.json").read_text())
    vo_dir = ROOT / f"public/vo/{ch}"
    vo_dir.mkdir(parents=True, exist_ok=True)

    t = spec["intro"]
    lines = []
    specs = spec["lines"]
    shot_start = 0.0
    for i, ln in enumerate(specs):
        mp3, wav, key = (vo_dir / f"{ln['id']}{ext}" for ext in (".mp3", ".wav", ".key"))
        k = f"{spec['voice']}|{spec['rate']}|{spec['pitch']}|{ln['zh']}"
        if not mp3.exists() or not key.exists() or key.read_text() != k:
            asyncio.run(synth(ln["zh"], spec["voice"], spec["rate"], spec["pitch"], mp3))
            key.write_text(k)
        # Decode, trim edge silence, resample to 48k mono.
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3),
             "-af", "silenceremove=start_periods=1:start_threshold=-50dB,"
                    "areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
             "-ar", "48000", "-ac", "1", str(wav)],
            check=True,
        )
        dur = sf.info(str(wav)).duration
        if i == 0 or specs[i - 1]["shot"] != ln["shot"]:
            shot_start = 0.0 if i == 0 else t - LEAD
            shot_min = ln.get("minShot", MIN_SHOT)
        start = t
        end = start + dur
        post = ln.get("post", pause_after(ln["zh"]) + (PARA if ln.get("para") else 0.0))
        t = end + post
        if i + 1 < len(specs) and specs[i + 1]["shot"] != ln["shot"]:
            # Hold the shot long enough to read before cutting to the next one.
            t = max(t, shot_start + shot_min + LEAD)
        lines.append({**ln, "start": round(start, 3), "end": round(end, 3), "dur": round(dur, 3)})

    total = t + spec["tail"]
    shots = []
    for ln in lines:
        if not shots or shots[-1]["shot"] != ln["shot"]:
            shots.append({"shot": ln["shot"], "start": ln["start"] - LEAD})
    shots[0]["start"] = 0.0
    for i, s in enumerate(shots):
        s["end"] = shots[i + 1]["start"] if i + 1 < len(shots) else total

    out = {
        "chapter": ch,
        "fps": spec["fps"],
        "intro": spec["intro"],
        "total": round(total, 3),
        "frames": int(round(total * spec["fps"])),
        "lines": [{k: v for k, v in ln.items() if k not in ("post", "para", "minShot")} for ln in lines],
        "cues": spec.get("cues", {}),
        "shots": [{**s, "start": round(s["start"], 3), "end": round(s["end"], 3)} for s in shots],
    }
    dst = ROOT / f"src/{ch}/timeline.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    for ln in out["lines"]:
        print(f"{ln['start']:7.2f}-{ln['end']:7.2f}  {ln['shot']:9s} {ln['zh']}")
    for s in out["shots"]:
        print(f"shot {s['shot']:9s} {s['start']:7.2f}-{s['end']:7.2f} ({s['end']-s['start']:.1f}s)")
    print("total", out["total"])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ch1")
