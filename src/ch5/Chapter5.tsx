import React from 'react';
import { Audio, staticFile } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { Era } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { NIGHT } from '../ch1/glsl/night';
import { HANDOFF } from './glsl/handoff';
import { HOMEDOT } from './glsl/homedot';
import { DAPPLE } from './glsl/dapple';
import { WHALES } from './glsl/whales';
import { THREAD } from './glsl/thread';
import { HANDS } from './glsl/hands';
import tl from './timeline.json';

export const CH5_FRAMES = tl.frames;
const X = tl.cues.xfade;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const line = (id: string) => tl.lines.find((l) => l.id === id)!;
const local = (name: string, at: number) => at - (span(name).start - X / 2);

// Whale phrases begin every SONG seconds (matched in the score).
export const SONG = 2.6;
// The light leaves the hands as "多留下一点光" begins (about 60% into the last line).
const RISE_AT = local('hands', line('l9').start + line('l9').dur * 0.55);

const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  handoff: (s, dur, j) => <ShaderCanvas frag={HANDOFF} uniforms={{ expo: j.dissolveIn ? 1 : clamp01(s / 1.0), take: ease(s / dur) }} />,
  homedot: (s, dur) => <ShaderCanvas frag={HOMEDOT} uniforms={{ expo: 1, push: ease(s / dur) }} />,
  dapple: () => <ShaderCanvas frag={DAPPLE} uniforms={{ expo: 1 }} />,
  whales: (s) => <ShaderCanvas frag={WHALES} uniforms={{ expo: 1, song: s < 0.4 ? -1 : (s - 0.4) % SONG }} />,
  lastgaze: (s, dur) => <ShaderCanvas frag={NIGHT} uniforms={{ expo: 1, tilt: 0, push: 0, memory: 1, gone: ease((s - 0.9) / (dur - 1.2)) }} />,
  thread: (s, dur) => <ShaderCanvas frag={THREAD} uniforms={{ expo: 1, reach: ease((s - 0.2) / (dur - 1.0)) }} />,
  hands: (s, dur) => (
    <ShaderCanvas frag={HANDS} uniforms={{ expo: 1, rise: ease((s - RISE_AT) / 4.2), dim: 0.85 * ease((s - RISE_AT - 4.0) / Math.max(dur - RISE_AT - 4.0, 0.5)) }} />
  ),
};

const ERAS: Record<string, [string, string]> = {
  homedot: ['暗淡蓝点 · 约六十亿公里外', 'THE PALE BLUE DOT · SOME SIX BILLION KILOMETRES AWAY'],
};

export const Chapter5: React.FC<{ narration: boolean }> = ({ narration }) => {
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
      {shots.map((sh) =>
        ERAS[sh.shot] ? <Era key={sh.shot} t0={sh.start + 0.3} t1={sh.end} zh={ERAS[sh.shot][0]} en={ERAS[sh.shot][1]} /> : null,
      )}
      <Subtitles lines={tl.lines} />
      {audio && <Audio src={staticFile(narration ? 'music/ch5_narr.wav' : 'music/ch5_music.wav')} />}
    </ChapterRoot>
  );
};
