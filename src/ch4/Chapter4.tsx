import React from 'react';
import { Audio, staticFile } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { Era } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { FOREST } from '../ch1/glsl/forest';
import { VESSELS } from './glsl/vessels';
import { SWARM } from './glsl/swarm';
import { swarmUniforms } from './swarmTree';
import { SILICON } from './glsl/silicon';
import { MEMORY } from './glsl/memory';
import { VOYAGE } from './glsl/voyage';
import tl from './timeline.json';

export const CH4_FRAMES = tl.frames;
const X = tl.cues.xfade;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const line = (id: string) => tl.lines.find((l) => l.id === id)!;

// The memory node fails just as "损毁" is spoken (about 40% into the line).
const FAIL_AT = line('l5').start + line('l5').dur * 0.4 - (span('memory').start - X / 2);

const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  // Flesh to light: the scan climbs the stargazer over the length of the first line.
  vessels: (s, _d, j) => <ShaderCanvas frag={VESSELS} uniforms={{ expo: j.dissolveIn ? 1 : clamp01(s / 1.2), morph: ease((s - 1.4) / 3.2) }} />,
  // Last forest, slightly withered; a craft lifts off beyond the ridges.
  lastforest: (s) => <ShaderCanvas frag={FOREST} uniforms={{ expo: 1, grow: 1, wither: 0.3, launch: Math.max(0.001, s - 0.6) }} />,
  swarm: (s, dur) => <ShaderCanvas frag={SWARM} uniforms={{ expo: 1, pull: ease(s / dur), ...swarmUniforms(s) }} />,
  silicon: (s, dur) => <ShaderCanvas frag={SILICON} uniforms={{ expo: 1, grow: ease((s - 0.3) / (dur - 0.5)) }} />,
  memory: (s) => <ShaderCanvas frag={MEMORY} uniforms={{ expo: 1, fail: s - FAIL_AT }} />,
  voyage: (s, dur, j) => <ShaderCanvas frag={VOYAGE} uniforms={{ expo: j.joinedOut ? 1 : 1 - 0.85 * clamp01((s - (dur - 2.4)) / 2.4), arrive: ease(s / (dur - 1.5)) }} />,
};

const ERAS: Record<string, [string, string]> = {
  swarm: ['自我复制探测器', 'SELF-REPLICATING PROBES'],
  voyage: ['星际航行 · 数千年', 'AN INTERSTELLAR VOYAGE · THOUSANDS OF YEARS'],
};

export const Chapter4: React.FC<{ narration: boolean }> = ({ narration }) => {
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
      {audio && <Audio src={staticFile(narration ? 'music/ch4_narr.wav' : 'music/ch4_music.wav')} />}
    </ChapterRoot>
  );
};
