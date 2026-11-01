import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ShaderCanvas } from '../../lib/ShaderCanvas';
import { EARTH } from '../glsl/earth';

export const EarthShot: React.FC<{ sunrise: number; ageFrom: number; ageDur: number; dur: number }> = ({ sunrise, ageFrom, ageDur, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const k = Math.min(1, Math.max(0, (s - ageFrom) / ageDur));
  const ageE = k * k * (3 - 2 * k);
  const expo = Math.min(1, s / 1.2) * (1 - 0.5 * Math.max(0, (s - (dur - 1)) / 1));
  return <ShaderCanvas frag={EARTH} uniforms={{ sunrise, age: ageE, expo }} />;
};
