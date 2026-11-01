import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { SANS, SERIF } from '../lib/fonts';
import { IMG_H, W } from '../lib/frame';
import { project } from './sunBasis';

// Diagram annotations for the cutaway Sun: leader lines from each layer to a label
// column on the left, typed on one after another.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

const LABELS: { o: [number, number, number]; y: number; zh: string; en: string; at: number }[] = [
  { o: [0, 0.12, 0.12], y: 440, zh: '核心 · 核聚变  约 1500 万 K', en: 'CORE · HYDROGEN FUSES INTO HELIUM · ~15 MILLION K', at: 0 },
  { o: [0, 0.33, 0.33], y: 340, zh: '辐射区', en: 'RADIATIVE ZONE · LIGHT TAKES ~100,000 YEARS TO CROSS', at: 0.6 },
  { o: [0, 0.55, 0.55], y: 240, zh: '对流区', en: 'CONVECTIVE ZONE', at: 1.2 },
  { o: [0.2, -0.61, 0.76], y: 610, zh: '光球层  约 5800 K', en: 'PHOTOSPHERE · ~5,800 K', at: 1.8 },
];
const COL = 780;

export const SunLabels: React.FC<{ t0: number; t1: number; eq: number }> = ({ t0, t1, eq }) => {
  const { fps } = useVideoConfig();
  const s = useCurrentFrame() / fps;
  const out = 1 - ease((s - (t1 - 0.6)) / 0.6);
  if (s < t0 || out <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <svg width={W} height={IMG_H} style={{ position: 'absolute', inset: 0 }}>
        {LABELS.map((l) => {
          const [ax, ay] = project(l.o);
          const k = ease((s - t0 - l.at) / 0.6);
          if (k <= 0) return null;
          // Draw the leader from the anchor out to the label column.
          const ex = COL + 20;
          const len1 = Math.hypot(ax - ex, ay - l.y);
          const len2 = 20;
          const total = len1 + len2;
          return (
            <g key={l.zh} opacity={0.85}>
              <circle cx={ax} cy={ay} r={3.5} fill="none" stroke="rgba(255,240,220,0.9)" strokeWidth={1.2} opacity={k} />
              <polyline
                points={`${ax},${ay} ${ex},${l.y} ${COL},${l.y}`}
                fill="none" stroke="rgba(255,240,220,0.75)" strokeWidth={1}
                strokeDasharray={total} strokeDashoffset={total * (1 - k)}
              />
            </g>
          );
        })}
      </svg>
      {LABELS.map((l) => {
        const a = ease((s - t0 - l.at - 0.3) / 0.5);
        if (a <= 0) return null;
        return (
          <div key={l.zh} style={{ position: 'absolute', right: W - COL + 14, top: l.y - 22, textAlign: 'right', opacity: a }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: '#F0E9DD', letterSpacing: '0.12em' }}>{l.zh}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(225,218,205,0.62)', letterSpacing: '0.18em', marginTop: 4 }}>{l.en}</div>
          </div>
        );
      })}
      {/* The force itself: four hydrogen nuclei become one helium nucleus and light. */}
      <div style={{ position: 'absolute', left: 0, width: COL - 14, top: 500, textAlign: 'right', opacity: ease((s - eq) / 0.7), fontFamily: SERIF, fontSize: 26, color: 'rgba(255,226,180,0.92)', letterSpacing: '0.08em' }}>
        4 ¹H → ⁴He + 2e⁺ + 2ν + γ
      </div>
    </div>
  );
};
