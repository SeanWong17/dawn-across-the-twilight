import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useShotFade } from './frame';
import { Join, useJoin } from './join';

/**
 * A shot on the chapter timeline that cross-dissolves with its neighbours. `render`
 * receives the shot-local time and duration in seconds, and how the chapter meets its
 * neighbours (the first and last shots skip their fade from/to black when joined).
 */
export const Shot: React.FC<{
  from: number;
  to: number;
  xIn: number;
  xOut: number;
  name: string;
  render: (s: number, dur: number, join: Join) => React.ReactNode;
}> = ({ from, to, xIn, xOut, name, render }) => {
  const { fps } = useVideoConfig();
  const dur = to - from;
  const Inner: React.FC = () => {
    const s = useCurrentFrame() / fps;
    const a = useShotFade(dur, xIn, xOut);
    const join = useJoin();
    return <AbsoluteFill style={{ opacity: a }}>{render(s, dur, join)}</AbsoluteFill>;
  };
  return (
    <Sequence from={Math.round(from * fps)} durationInFrames={Math.round(dur * fps)} name={name}>
      <Inner />
    </Sequence>
  );
};
