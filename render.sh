#!/usr/bin/env bash
# Build the whole film from source: narration timelines, score, full mix, video.
# Writes out/dawn_across_the_twilight_{music,narration}.mp4.
set -euo pipefail
cd "$(dirname "$0")"

CHAPTERS="ch1 ch2 ch3 ch4 ch5 ch6 ch7 ch8"

# Narration clips and chapter timelines. A line is re-synthesised with edge-tts (network)
# only when its text or voice settings change; otherwise the cached MP3 is reused.
for ch in $CHAPTERS; do python3 scripts/gen_tts.py "$ch" >/dev/null; done
# Each chapter's score and mixes, then the continuous full-film mix and layout.
for ch in $CHAPTERS; do python3 scripts/gen_music.py "$ch"; done
python3 scripts/gen_full.py

mkdir -p out
# Headless Chrome only gets a software GL here, so render on the CPU through ANGLE.
npx remotion render Full-Music out/dawn_across_the_twilight_music.mp4 \
  --gl=angle --concurrency=8 --codec=h264 --crf=18 --audio-bitrate=320k --log=error
# The narration version is the same picture with the narrated mix.
ffmpeg -y -loglevel error -i out/dawn_across_the_twilight_music.mp4 -i public/music/full_narr.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest out/dawn_across_the_twilight_narration.mp4
ls -lh out/
