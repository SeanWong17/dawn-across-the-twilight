import React from 'react';
import { Audio, staticFile } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { Era } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { FOREST } from '../ch1/glsl/forest';
import { PLANET } from './glsl/planet';
import { SUMMER } from './glsl/summer';
import { SUN } from './glsl/sun';
import { EVAP } from './glsl/evaporate';
import { VOID } from './glsl/void';
import { Timeline } from './Timeline';
import tl from './timeline.json';

export const CH2_FRAMES = tl.frames;
const X = tl.cues.xfade;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const cue = Object.fromEntries(tl.lines.map((l) => [l.id, { start: l.start, end: l.end }]));

const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  future: (s, dur, j) => <ShaderCanvas frag={PLANET} uniforms={{ expo: j.dissolveIn ? 1 : clamp01(s / 1.2), decline: 0, push: s / dur, spin: 0 }} />,
  summer: () => <ShaderCanvas frag={SUMMER} uniforms={{ expo: 1 }} />,
  sun: (s, dur) => <ShaderCanvas frag={SUN} uniforms={{ expo: 1, bright: Math.pow(clamp01(s / dur), 1.3) }} />,
  climate: (s, dur) => <ShaderCanvas frag={PLANET} uniforms={{ expo: 1, decline: 0.12 + 0.38 * (s / dur), push: 0.35 + 0.2 * (s / dur), spin: 1.7 }} />,
  wither: (s, dur) => <ShaderCanvas frag={FOREST} uniforms={{ expo: 1, grow: 1, wither: 0.1 + 0.85 * clamp01(s / dur) }} />,
  evaporate: (s, dur) => <ShaderCanvas frag={EVAP} uniforms={{ expo: 1, evap: 0.15 + 0.7 * clamp01(s / dur) }} />,
  timeline: (s) => {
    const boom = clamp01((s + span('timeline').start - cue.l14.start) / 3.6);
    return <ShaderCanvas frag={VOID} uniforms={{ expo: 1, zoom: boom }} />;
  },
};

const ERAS: Record<string, [string, string]> = {
  future: ['未来', 'THE FUTURE'],
  sun: ['每过一亿年，太阳亮度约增加 1%', 'THE SUN BRIGHTENS ~1% EVERY 100 MILLION YEARS'],
  climate: ['约 6 亿年后', '~600 MILLION YEARS FROM NOW'],
  wither: ['约 8 亿年后', '~800 MILLION YEARS FROM NOW'],
  evaporate: ['约 10 亿年后', '~1 BILLION YEARS FROM NOW'],
};

export const Chapter2: React.FC<{ narration: boolean }> = ({ narration }) => {
  const shots = tl.shots;
  const tln = span('timeline');
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
        <Timeline start={tln.start} end={tln.end} cue={cue} />
      </Screen>

      {shots.map((sh) =>
        ERAS[sh.shot] ? <Era key={sh.shot} t0={sh.start + 0.3} t1={sh.end} zh={ERAS[sh.shot][0]} en={ERAS[sh.shot][1]} /> : null,
      )}
      <Subtitles lines={tl.lines} />
      {audio && <Audio src={staticFile(narration ? 'music/ch2_narr.wav' : 'music/ch2_music.wav')} />}
    </ChapterRoot>
  );
};
