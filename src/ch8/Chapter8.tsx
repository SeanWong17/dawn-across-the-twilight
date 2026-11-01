import React from 'react';
import { Audio, staticFile } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { EndCard } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { SEA } from '../ch1/glsl/sea';
import { EARTH } from '../ch1/glsl/earth';
import { NIGHT } from '../ch1/glsl/night';
import { HOMEDOT } from '../ch5/glsl/homedot';
import { LINEAGE } from './glsl/lineage';
import tl from './timeline.json';

export const CH8_FRAMES = tl.frames;
const X = tl.cues.xfade;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const line = (id: string) => tl.lines.find((l) => l.id === id)!;
const local = (name: string, at: number) => at - (span(name).start - X / 2);
const at = (id: string, k: number) => line(id).start + line(id).dur * k;

// Moments shared with the score (gen_music.py build_ch8 derives the same ones).
// The last traveller remembers: a pulse runs back along the thread from "记得出发的地方".
const MEM_A = local('last', at('l4', 0.45));
// The shader's sun is visible about a second after its "sunrise", so it crests the limb on "黎明".
const SUNRISE = local('dawn', at('l8', 0.55)) - 1.0;
const FADE_AT = SUNRISE + 8.5; // the Earth then fades into the dark under the last chord
const FADE_LEN = 4.5;
const END_BLACK = span('dawn').start - X / 2 + FADE_AT + FADE_LEN; // global time the picture is black

const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  lineage: (s, dur) => <ShaderCanvas frag={LINEAGE} uniforms={{ expo: clamp01(s / 1.0), pan: -0.4 + 2.6 * ease((s - 0.2) / (dur - 0.4)), focus: 0, zoom: 1, mem: 0 }} />,
  // The first life alone on the thread; ahead of it the thread runs out into the dark.
  first: (s, dur) => <ShaderCanvas frag={LINEAGE} uniforms={{ expo: 1, pan: -0.8 + 0.04 * (s / dur), focus: 1, zoom: 2.3 + 0.3 * ease(s / dur), mem: 0 }} />,
  // The last traveller, and the memory running back toward where it all began.
  last: (s, dur) => (
    <ShaderCanvas frag={LINEAGE} uniforms={{ expo: 1, pan: 2.7 - 0.35 * ease((s - MEM_A) / (dur - MEM_A + 0.3)), focus: 8, zoom: 2.2 - 0.3 * ease(s / dur), mem: clamp01((s - MEM_A) / (dur - MEM_A + 0.2)) }} />
  ),
  // What it remembers: a blue planet, a warm shallow sea, someone looking up on a cold night.
  homedot: (s, dur) => <ShaderCanvas frag={HOMEDOT} uniforms={{ expo: 1, push: ease(s / dur) }} />,
  shallows: () => <ShaderCanvas frag={SEA} uniforms={{ expo: 1 }} />,
  stargazer: (s, dur) => <ShaderCanvas frag={NIGHT} uniforms={{ expo: 1, tilt: 0, push: 0.3 * (s / dur), memory: 1, gone: 0 }} />,
  // The dawn of chapter 1, once more: a living Earth and its sunrise.
  dawn: (s) => <ShaderCanvas frag={EARTH} uniforms={{ sunrise: SUNRISE, age: 1, expo: clamp01(s / 1.5) * (1 - ease((s - FADE_AT) / FADE_LEN)) }} />,
};

export const Chapter8: React.FC<{ narration: boolean }> = ({ narration }) => {
  const shots = tl.shots;
  const { audio } = useJoin();
  return (
    <ChapterRoot>
      <Screen>
        {shots.map((sh, i) => (
          <Shot
            key={sh.shot}
            name={sh.shot}
            from={i === 0 ? 0 : sh.start - X / 2}
            to={i === shots.length - 1 ? sh.end : sh.end + X / 2}
            xIn={i === 0 ? 0 : X}
            xOut={i === shots.length - 1 ? 0 : X}
            render={render[sh.shot]}
          />
        ))}
      </Screen>
      <Subtitles lines={tl.lines} />
      {/* The last frame of the film: the title once more, and who made it. */}
      <EndCard t0={END_BLACK - 1.0} t1={tl.total - 0.3} />
      {audio && <Audio src={staticFile(narration ? 'music/ch8_narr.wav' : 'music/ch8_music.wav')} />}
    </ChapterRoot>
  );
};
