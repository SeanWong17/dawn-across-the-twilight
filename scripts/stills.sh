#!/usr/bin/env bash
# Usage: scripts/stills.sh out.jpg 'shot|from|{json uniforms}' ...
# Renders each spec to a still and tiles them 2-wide into out.jpg.
set -e
cd "$(dirname "$0")/.."
out=$1; shift
tmp=$(mktemp -d)
i=0
for spec in "$@"; do
  IFS='|' read -r shot from u <<<"$spec"
  timeout 400 npx remotion still ShotTest "$tmp/$i.png" --gl=angle --log=error \
    --props="{\"shot\":\"$shot\",\"from\":$from,\"u\":${u:-{\}}}" 2>&1 | grep -vE "webpack|^$" | tail -5 &
  i=$((i+1)); if (( i % 4 == 0 )); then wait; fi
done
wait
n=$i; inputs=""; filt=""; layout=""
for ((k=0;k<n;k++)); do
  inputs+=" -i $tmp/$k.png"; filt+="[$k]crop=1920:804:0:138,scale=960:-1[v$k];"
  layout+="$(( (k%2)*960 ))_$(( (k/2)*402 ))|"
done
if ((n==1)); then cp "$tmp/0.png" "$out"; else
ffmpeg -y -loglevel error $inputs -filter_complex "${filt}$(for ((k=0;k<n;k++)); do printf "[v$k]"; done)xstack=inputs=$n:layout=${layout%|}:fill=black" -frames:v 1 "$out"; fi
rm -rf "$tmp"
