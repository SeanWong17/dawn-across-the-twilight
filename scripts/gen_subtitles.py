#!/usr/bin/env python3
"""Write SRT/VTT subtitle files for the whole film from the chapter timelines.

The burnt-in text comes from the same per-chapter `timeline.json` files plus the chapter
offsets in `src/full.json`, so these sidecar files always match what is on screen. Each
line is held through its trailing pause, the way `Subtitles` in src/lib/frame.tsx holds it.

    python3 scripts/gen_subtitles.py out/submission
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / "submission"
FPS = 30
# Matches Subtitles: the line appears 0.12 s early and lingers up to 0.9 s.
LEAD = 0.12
HOLD = 0.9


def stamp(t: float, sep: str) -> str:
    ms = max(0, int(round(t * 1000)))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def cues() -> list[tuple[float, float, str, str]]:
    full = json.loads((ROOT / "src" / "full.json").read_text())
    out = []
    for ch in full["chapters"]:
        tl = json.loads((ROOT / "src" / ch["chapter"] / "timeline.json").read_text())
        offset = ch["from"] / FPS
        lines = tl["lines"]
        for i, line in enumerate(lines):
            nxt = lines[i + 1]["start"] if i + 1 < len(lines) else 1e9
            start = offset + line["start"] - LEAD
            end = offset + min(line["end"] + HOLD, nxt - LEAD)
            out.append((start, end, line["zh"], line["en"]))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = cues()
    lang_sets = {"zh": 2, "en": 3}
    for lang, idx in lang_sets.items():
        srt = []
        for n, row in enumerate(rows, 1):
            srt.append(f"{n}\n{stamp(row[0], ',')} --> {stamp(row[1], ',')}\n{row[idx]}\n")
        (OUT / f"dawn_across_the_twilight.{lang}.srt").write_text("\n".join(srt), encoding="utf-8")
    # A bilingual VTT: Chinese above, English below, the same order as the `bi` cut.
    vtt = ["WEBVTT", ""]
    for row in rows:
        vtt.append(f"{stamp(row[0], '.')} --> {stamp(row[1], '.')}")
        vtt.append(row[2])
        vtt.append(row[3])
        vtt.append("")
    (OUT / "dawn_across_the_twilight.bi.vtt").write_text("\n".join(vtt), encoding="utf-8")
    print(f"{len(rows)} cues -> {OUT}")


if __name__ == "__main__":
    main()
