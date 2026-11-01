import React from 'react';
import { Audio, staticFile } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { Era } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { PLANET } from '../ch2/glsl/planet';
import { CUTAWAY } from './glsl/cutaway';
import { SHIELD } from './glsl/shield';
import { ORBIT } from './glsl/orbit';
import { LIFT } from './glsl/lift';
import { REDSHORE } from './glsl/redshore';
import { cutawayUniforms } from './sunBasis';
import { SunLabels } from './SunLabels';
import tl from './timeline.json';

export const CH3_FRAMES = tl.frames;
const X = tl.cues.xfade;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const line = (id: string) => tl.lines.find((l) => l.id === id)!;

const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  understand: (s, _d, j) => <ShaderCanvas frag={CUTAWAY} uniforms={{ expo: j.dissolveIn ? 1 : clamp01(s / 1.0), reveal: 1, ...cutawayUniforms }} />,
  civilization: (s, dur) => (
    <ShaderCanvas frag={PLANET} uniforms={{ expo: 1, decline: 0, push: 0.2 + 0.4 * (s / dur), spin: 5.1, night: 1, lights: ease(s / 2.5), ring: ease((s - 1.5) / 3) }} />
  ),
  shield: (s, dur) => <ShaderCanvas frag={SHIELD} uniforms={{ expo: 1, deploy: ease((s - 0.2) / (dur - 0.6)) }} />,
  move: (s, dur) => <ShaderCanvas frag={ORBIT} uniforms={{ expo: 1, move: clamp01((s - 0.3) / (dur - 0.4)) }} />,
  lifting: (s, dur) => <ShaderCanvas frag={LIFT} uniforms={{ expo: 1, lift: ease(s / (dur * 0.7)), shrink: 0 }} />,
  reddwarf: (s, dur) => <ShaderCanvas frag={LIFT} uniforms={{ expo: 1, lift: 1 - 0.7 * ease(s / dur), shrink: ease((s - 0.2) / (dur - 0.6)) }} />,
  hope: (s, dur, j) => <ShaderCanvas frag={REDSHORE} uniforms={{ expo: j.joinedOut ? 1 : 1 - 0.85 * clamp01((s - (dur - 2.4)) / 2.4), pull: s / dur }} />,
};

const ERAS: Record<string, [string, string]> = {
  civilization: ['遥远的未来', 'THE DEEP FUTURE'],
  shield: ['遮阳薄帆 · 日地之间', 'A SUNSHADE SAIL BETWEEN THE SUN AND THE EARTH'],
  move: ['小行星引力助推 · 外迁轨道', 'ASTEROID FLYBYS · A WIDER ORBIT'],
  lifting: ['恒星抽取 · 从两极剥离物质', 'STAR LIFTING · DRAWING MASS FROM THE POLES'],
  reddwarf: ['红矮星 · 可稳定燃烧千亿年以上', 'A RED DWARF BURNS STEADILY FOR OVER 100 BILLION YEARS'],
};

export const Chapter3: React.FC<{ narration: boolean }> = ({ narration }) => {
  const shots = tl.shots;
  const u = span('understand');
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
        <SunLabels t0={line('l1').start - 0.2} t1={u.end + X / 2} eq={line('l2').start + 0.3} />
      </Screen>

      {shots.map((sh) =>
        ERAS[sh.shot] ? <Era key={sh.shot} t0={sh.start + 0.3} t1={sh.end} zh={ERAS[sh.shot][0]} en={ERAS[sh.shot][1]} /> : null,
      )}
      <Subtitles lines={tl.lines} />
      {audio && <Audio src={staticFile(narration ? 'music/ch3_narr.wav' : 'music/ch3_music.wav')} />}
    </ChapterRoot>
  );
};
