import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { SANS, SERIF } from '../lib/fonts';
import { IMG_H, W } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { SEA } from '../ch1/glsl/sea';
import { FOREST } from '../ch1/glsl/forest';
import { BEASTS } from '../ch1/glsl/beasts';
import { NIGHT } from '../ch1/glsl/night';
import { SUMMER } from './glsl/summer';

// The cosmic timeline at the end of chapter 2. Earth's history is drawn as a line in
// billions of years (Gyr); the flourishing of complex life is the short gold segment.
// The axis first extends into the long silence after it, then zooms into the gold
// segment (which opens into a window of life), then explodes out to 10^14 years until
// the whole of it is a single spark.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

const LEFT = 160;
const SPAN = 1600;
const Y = IMG_H / 2;
const LIFE: [number, number] = [-0.57, 0.8];
const PAST: [number, number] = [-4.6, -0.57];
const GOLD = '255,206,140';

type Cue = { start: number; end: number };

const Label: React.FC<{ x: number; above: boolean; zh: string; en: string; a: number; y?: number }> = ({ x, above, zh, en, a, y = Y }) =>
  a <= 0 ? null : (
    <div
      style={{
        position: 'absolute', left: x - 300, width: 600, textAlign: 'center', opacity: a,
        top: above ? y - 78 : y + 22,
      }}
    >
      <div style={{ fontFamily: SERIF, fontSize: 21, color: '#ECE6DB', letterSpacing: '0.14em' }}>{zh}</div>
      <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(220,214,204,0.6)', letterSpacing: '0.2em', marginTop: 4 }}>{en}</div>
    </div>
  );

const Tick: React.FC<{ x: number; a: number; h?: number; color?: string }> = ({ x, a, h = 10, color = '235,228,215' }) =>
  a <= 0 ? null : <div style={{ position: 'absolute', left: x - 0.75, top: Y - h, width: 1.5, height: h * 2, background: `rgba(${color},${0.7 * a})` }} />;

const Seg: React.FC<{ x0: number; x1: number; thick: number; color: string; a: number; glow?: number }> = ({ x0, x1, thick, color, a, glow = 0 }) => {
  const l = Math.max(-10, Math.min(x0, x1));
  const r = Math.min(W + 10, Math.max(x0, x1));
  if (a <= 0 || r <= l) return null;
  const w = Math.max(r - l, thick);
  const c = (l + r) / 2;
  return (
    <div
      style={{
        position: 'absolute', left: c - w / 2, top: Y - thick / 2, width: w, height: thick, borderRadius: thick,
        background: `rgba(${color},${a})`,
        boxShadow: glow ? `0 0 ${glow}px ${glow / 3}px rgba(${color},${0.55 * a})` : undefined,
      }}
    />
  );
};

const MONTAGE: { frag: string; u: Record<string, number>; offset: number }[] = [
  { frag: SEA, u: { expo: 1 }, offset: 2 },
  { frag: FOREST, u: { expo: 1, grow: 1 }, offset: 3 },
  { frag: BEASTS, u: { expo: 1, stride: 1.9 }, offset: 0.6 },
  { frag: SUMMER, u: { expo: 1 }, offset: 2 },
  { frag: NIGHT, u: { expo: 1, tilt: 0, push: 0 }, offset: 3 },
];

export const Timeline: React.FC<{ start: number; end: number; cue: Record<string, Cue> }> = ({ start, end, cue }) => {
  const { fps } = useVideoConfig();
  const s = useCurrentFrame() / fps;
  if (s < start || s > end) return null;
  const { l9, l10, l11, l12, l13, l14 } = cue;

  // Visible range [a, b] in Gyr.
  let a = -4.9;
  let b = mix(1.7, 7.4, ease((s - l12.start + 0.2) / 1.8));
  const zin = ease((s - (l13.start - 0.5)) / 1.0);
  a = mix(a, -0.75, zin);
  b = mix(b, 1.0, zin);
  const boom = clamp01((s - l14.start) / 3.6);
  const f = Math.pow(1e5, boom * boom * (3 - 2 * boom));
  a *= f;
  b *= f;
  const x = (v: number) => LEFT + ((v - a) / (b - a)) * SPAN;

  const draw = ease((s - start - 0.3) / 1.4);
  const axisEnd = mix(x(PAST[0]), W + 10, draw);
  const markersOut = 1 - ease((s - (l13.start - 0.6)) / 0.5);
  const lifeA = ease((s - l10.start + 0.2) / 0.8);
  // Edge labels of the gold segment give way to one centred label once it narrows.
  const edgeOut = 1 - ease((s - l12.start + 0.2) / 0.5);
  const lifeGrow = ease((s - l10.start + 0.2) / 1.2);

  // The window of life inside the gold segment.
  const open = ease((s - (l13.start + 0.05)) / 0.5) * (1 - ease((s - (l14.start - 0.25)) / 0.4));
  const winT0 = l13.start + 0.05;
  const winDur = l14.start + 0.15 - winT0;
  const cut = Math.min(MONTAGE.length - 1, Math.max(0, Math.floor(((s - winT0) / winDur) * MONTAGE.length)));
  const wx0 = x(LIFE[0]), wx1 = x(LIFE[1]);
  const wh = 430 * open;

  // The final spark: the whole of it, seen from 10^14 years away.
  const sparkX = x((LIFE[0] + LIFE[1]) / 2);
  const spark = ease((boom - 0.75) / 0.25) * (1 - ease((s - (end - 1.6)) / 1.2));
  const flick = 0.85 + 0.15 * Math.sin(s * 23) * Math.sin(s * 7.3);

  const far: [number, string, string][] = [
    [10, '100 亿年', '10 BILLION YEARS'],
    [100, '1000 亿年', '100 BILLION'],
    [1000, '1 万亿年', '1 TRILLION'],
    [1e4, '10 万亿年', '10 TRILLION'],
    [1e5, '100 万亿年', '100 TRILLION YEARS'],
  ];
  const fade = 1 - ease((s - (end - 1.4)) / 1.2);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      {/* Axis */}
      <Seg x0={x(PAST[0])} x1={axisEnd} thick={1.5} color="235,228,215" a={0.32 * (1 - boom * 0.4)} />
      {/* The long wait */}
      <Seg x0={x(PAST[0])} x1={mix(x(PAST[0]), x(PAST[1]), draw)} thick={2.5} color="150,175,215" a={mix(0.35, 0.85, ease((s - l11.start + 0.1) / 0.5)) * draw} />
      {/* The longer silence */}
      <Seg x0={x(LIFE[1])} x1={axisEnd} thick={2} color="170,160,190" a={0.6 * ease((s - l12.start + 0.1) / 0.6) * (1 - boom)} />
      {/* The flourishing */}
      <Seg x0={x(LIFE[0])} x1={mix(x(LIFE[0]), x(LIFE[1]), lifeGrow)} thick={4} color={GOLD} a={lifeA} glow={14} />

      <Tick x={x(-4.6)} a={draw * markersOut} />
      <Tick x={x(LIFE[0])} a={lifeA * (1 - boom)} color={GOLD} />
      <Tick x={x(0)} a={draw * (1 - open) * (1 - boom)} h={14} />
      <Tick x={x(LIFE[1])} a={lifeA * (1 - boom)} color={GOLD} />
      <Tick x={x(5)} a={ease((s - l12.start - 0.6) / 0.6) * markersOut} />

      <Label x={x(-4.6)} above={false} zh="地球诞生" en="EARTH FORMS · 4.6 BILLION YEARS AGO" a={draw * markersOut} />
      <Label x={x(0)} above={false} zh="今天" en="TODAY" a={ease((s - start - 1) / 0.6) * markersOut} />
      <Label x={x(LIFE[0])} above zh="复杂生命出现" en="COMPLEX LIFE · 570 MILLION YEARS AGO" a={lifeA * edgeOut} />
      <Label x={x(LIFE[1])} above zh="复杂生命终结" en="~800 MILLION YEARS FROM NOW" a={ease((s - l10.start - 0.6) / 0.6) * edgeOut} />
      <Label x={(x(LIFE[0]) + x(LIFE[1])) / 2} above zh="约 14 亿年" en="~1.4 BILLION YEARS" a={(1 - edgeOut) * markersOut} />
      <Label x={(x(PAST[0]) + x(PAST[1])) / 2} above={false} zh="约 40 亿年" en="~4 BILLION YEARS" a={ease((s - l11.start) / 0.5) * markersOut} y={Y + 64} />
      <Label x={x(5)} above={false} zh="太阳成为红巨星" en="THE SUN BECOMES A RED GIANT · ~5 BILLION YEARS" a={ease((s - l12.start - 0.6) / 0.6) * markersOut} />

      {/* Window of life */}
      {open > 0.001 && (
        <div style={{ position: 'absolute', left: wx0, top: Y - wh / 2, width: wx1 - wx0, height: wh, overflow: 'hidden', boxShadow: `0 0 30px 4px rgba(${GOLD},${0.35 * open})` }}>
          {MONTAGE.map((m, i) =>
            i !== cut ? null : (
              <Sequence key={i} from={Math.round((winT0 + (i * winDur) / MONTAGE.length - m.offset) * fps)} layout="none">
                <div style={{ position: 'absolute', left: -wx0, top: -(Y - wh / 2), width: W, height: IMG_H }}>
                  <ShaderCanvas frag={m.frag} uniforms={m.u} />
                </div>
              </Sequence>
            ),
          )}
          <div style={{ position: 'absolute', inset: 0, borderTop: `1.5px solid rgba(${GOLD},0.8)`, borderBottom: `1.5px solid rgba(${GOLD},0.8)` }} />
        </div>
      )}

      {/* Timescale ticks rushing in as the view pulls out to 10^14 years */}
      {far.map(([v, zh, en], i) => {
        const xv = x(v);
        const a2 = boom > 0 ? ease((xv - sparkX - 70) / 160) * ease((W - 60 - xv) / 120) : 0;
        return (
          <React.Fragment key={v}>
            <Tick x={xv} a={a2} />
            <Label x={xv} above={i % 2 === 0} zh={zh} en={en} a={a2} />
          </React.Fragment>
        );
      })}

      {spark > 0 && (
        <div
          style={{
            position: 'absolute', left: sparkX - 40, top: Y - 40, width: 80, height: 80, borderRadius: '50%', opacity: spark * flick,
            background: `radial-gradient(circle, rgba(255,250,235,1) 0%, rgba(${GOLD},0.8) 7%, rgba(${GOLD},0.18) 22%, rgba(${GOLD},0) 60%)`,
          }}
        />
      )}
    </div>
  );
};
