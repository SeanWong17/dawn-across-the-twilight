import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SANS, SERIF } from './fonts';
import { useJoin } from './join';
import { useOpts, useTextMode } from './lang';

// 2.39:1 picture area inside the 16:9 frame; subtitles live in the lower bar.
export const W = 1920;
export const IMG_H = 804;
export const BAR = (1080 - IMG_H) / 2;

export const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { textOnly } = useOpts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The text-only layer draws no picture at all: it renders in seconds instead of minutes.
  if (textOnly) return null;
  // Inside the full film the picture dissolves in over the previous chapter's last shot.
  const { dissolveIn } = useJoin();
  const a = dissolveIn > 0 ? ease(Math.min(1, frame / fps / dissolveIn)) : 1;
  return (
    <AbsoluteFill style={{ background: dissolveIn > 0 ? 'transparent' : '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: BAR, width: W, height: IMG_H, overflow: 'hidden', background: '#000', opacity: a }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};

export type Line = { id: string; zh: string; en: string; start: number; end: number };

const ease = (x: number) => x * x * (3 - 2 * x);

export const Subtitles: React.FC<{ lines: Line[] }> = ({ lines }) => {
  const mode = useTextMode();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  if (mode === 'none') return null;
  // A line stays up through its trailing pause so the reader can finish it.
  const active = lines
    .map((l, i) => ({ l, on: l.start - 0.12, off: Math.min(l.end + 0.9, (lines[i + 1]?.start ?? 1e9) - 0.12) }))
    .find(({ on, off }) => s >= on && s < off);
  if (!active) return null;
  const { l, on, off } = active;
  const a = ease(Math.min(1, Math.max(0, (s - on) / 0.22))) * ease(Math.min(1, Math.max(0, (off - s) / 0.22)));
  const lift = interpolate(a, [0, 1], [6, 0]);
  // In `en` the line is set as the poem itself, not as a small translation under a
  // larger Chinese one: a jury that does not read Chinese should be able to follow it.
  const en = mode === 'en';
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: BAR + IMG_H,
        height: BAR,
        padding: '0 96px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: en ? 9 : 10,
        opacity: a,
        transform: `translateY(${lift}px)`,
      }}
    >
      {en ? (
        <>
          <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 33, letterSpacing: '0.02em', color: '#EDE8DF', lineHeight: 1.34, textAlign: 'center', maxWidth: 1680 }}>
            {l.en}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 18, letterSpacing: '0.14em', color: 'rgba(214,210,200,0.5)', lineHeight: 1.15 }}>
            {l.zh}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 44, letterSpacing: '0.14em', color: '#EDE8DF', lineHeight: 1.1 }}>
            {l.zh}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 21, letterSpacing: '0.06em', color: 'rgba(214,210,200,0.62)', lineHeight: 1.1 }}>
            {l.en}
          </div>
        </>
      )}
    </div>
  );
};

/** Opacity envelope for a shot that overlaps its neighbours by `xIn`/`xOut` seconds. */
export const useShotFade = (dur: number, xIn: number, xOut: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const a = xIn > 0 ? Math.min(1, s / xIn) : 1;
  const b = xOut > 0 ? Math.min(1, (dur - s) / xOut) : 1;
  return ease(Math.max(0, a)) * ease(Math.max(0, b));
};
