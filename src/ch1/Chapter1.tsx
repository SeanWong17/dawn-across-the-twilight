import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Screen, Subtitles, useShotFade } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { EarthShot } from './shots/EarthShot';
import { SEA } from './glsl/sea';
import { FOREST } from './glsl/forest';
import { BEASTS } from './glsl/beasts';
import { NIGHT } from './glsl/night';
import { Era, Title } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import tl from './timeline.json';

export const CH1_FRAMES = tl.frames;
const FPS = tl.fps;
const X = tl.cues.xfade; // cross-dissolve length between shots (s)

type ShotName = 'earth' | 'sea' | 'forest' | 'beasts' | 'stars';

const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const night = { start: span('stars').start, end: span('question').end };
const question = span('question');

const Body: React.FC<{ name: ShotName; dur: number }> = ({ name, dur }) => {
  const frame = useCurrentFrame();
  const { joinedOut } = useJoin();
  const s = frame / FPS;
  const k = Math.min(1, Math.max(0, s / dur));
  switch (name) {
    case 'earth':
      return <EarthShot sunrise={tl.cues.sunrise} ageFrom={tl.lines[0].start} ageDur={tl.lines[0].dur + 0.6} dur={dur} />;
    case 'sea':
      return <ShaderCanvas frag={SEA} uniforms={{ expo: 1 }} />;
    case 'forest':
      return <ShaderCanvas frag={FOREST} uniforms={{ expo: 1, grow: 0.2 + 0.85 * k }} />;
    case 'beasts':
      return <ShaderCanvas frag={BEASTS} uniforms={{ expo: 1, stride: tl.cues.stepPeriod }} />;
    case 'stars': {
      // Tilt off the stargazer into the galaxy as the question is asked.
      const q = (question.start - night.start) - 0.3;
      const tilt = Math.min(1, Math.max(0, (s - q) / 4.5));
      return <ShaderCanvas frag={NIGHT} uniforms={{ expo: joinedOut ? 1 : 1 - 0.85 * Math.max(0, (s - (dur - 2.2)) / 2.2), tilt, push: s / dur }} />;
    }
  }
};

const Shot: React.FC<{ name: ShotName; start: number; end: number; first?: boolean; last?: boolean }> = ({ name, start, end, first, last }) => {
  const from = first ? 0 : start - X / 2;
  const to = last ? end : end + X / 2;
  const dur = to - from;
  const Inner: React.FC = () => {
    const a = useShotFade(dur, first ? 0 : X, last ? 0 : X);
    return (
      <AbsoluteFill style={{ opacity: a }}>
        <Body name={name} dur={dur} />
      </AbsoluteFill>
    );
  };
  return (
    <Sequence from={Math.round(from * FPS)} durationInFrames={Math.round(dur * FPS)} name={name}>
      <Inner />
    </Sequence>
  );
};

export const Chapter1: React.FC<{ narration: boolean }> = ({ narration }) => {
  const c = tl.cues;
  const { audio } = useJoin();
  const sea = span('sea'), forest = span('forest'), beasts = span('beasts');
  return (
    <ChapterRoot>
      <Screen>
        <Shot name="earth" {...span('earth')} first />
        <Shot name="sea" {...sea} />
        <Shot name="forest" {...forest} />
        <Shot name="beasts" {...beasts} />
        <Shot name="stars" {...night} last />
      </Screen>

      <Title t0={c.title} t1={tl.lines[0].start - 0.2} />

      <Era t0={tl.lines[0].start} t1={span('earth').end} zh="约四十亿年前 · 冥古宙" en="~4 BILLION YEARS AGO · HADEAN" />
      <Era t0={sea.start + 0.3} t1={sea.end} zh="约五亿七千万年前 · 埃迪卡拉纪" en="~570 MILLION YEARS AGO · EDIACARAN" />
      <Era t0={forest.start + 0.3} t1={forest.end} zh="约三亿八千万年前 · 泥盆纪" en="~380 MILLION YEARS AGO · DEVONIAN" />
      <Era t0={beasts.start + 0.3} t1={beasts.end} zh="约一亿五千万年前 · 侏罗纪" en="~150 MILLION YEARS AGO · JURASSIC" />
      <Era t0={night.start + 0.3} t1={question.start} zh="今天" en="THE PRESENT" />

      <Subtitles lines={tl.lines} />

      {audio && <Audio src={staticFile(narration ? 'music/ch1_narr.wav' : 'music/ch1_music.wav')} />}
    </ChapterRoot>
  );
};
