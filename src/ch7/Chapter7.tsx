import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { Era } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { HAWKING } from './glsl/hawking';
import { WAKE } from './glsl/wake';
import tl from './timeline.json';

export const CH7_FRAMES = tl.frames;
const X = tl.cues.xfade;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const span = (name: string) => tl.shots.find((s) => s.shot === name)!;
const line = (id: string) => tl.lines.find((l) => l.id === id)!;
const local = (name: string, at: number) => at - (span(name).start - X / 2);
const at = (id: string, k: number) => line(id).start + line(id).dur * k;

// Shared with the score (gen_music.py build_ch7 derives the same moments from the timeline).
const WAKE_A = local('wake', at('l5', 0.62));   // "一次醒来"
const MSG_AT = local('wake', at('l5', 0.8));    // "一场交谈"
const WAKE_B = local('wake', at('l6', 1.0) + 0.3);
const FLASH = local('vanish', at('l8', 0.86));  // "归于消逝"
const SLEEP = local('wake', at('l6b', 0.1));    // "它们放慢思考"

// The hole as ch6 left it (R = .085 × 1.55), now with nothing left to feed it.
const R0 = 0.13;
const R1 = 0.1;

const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  edge: (s, dur, j) => <ShaderCanvas frag={HAWKING} uniforms={{ expo: j.dissolveIn ? 1 : clamp01(s / 1.6), R: R0, stars: 1 - 0.4 * ease(s / dur), emit: 0, heat: 0, flash: -1 }} />,
  // Over ages: the hole shrinks a little, and the faint glow of its radiation appears.
  hawking: (s, dur) => {
    const k = ease(s / dur);
    return <ShaderCanvas frag={HAWKING} uniforms={{ expo: 1, R: R0 - (R0 - R1) * k, stars: 0.6 - 0.5 * k, emit: 0.15 + 0.6 * ease((s - 0.8) / (dur * 0.6)), heat: 0.05 + 0.15 * k, flash: -1 }} />;
  },
  wake: (s, dur) => (
    <ShaderCanvas frag={WAKE} uniforms={{ expo: clamp01(s / 1.2), wakeA: s - WAKE_A, msg: clamp01((s - MSG_AT) / (WAKE_B - MSG_AT)), wakeB: s - WAKE_B, drift: s / dur, sleep: ease((s - SLEEP) / 4.0) }} />
  ),
  // Evaporation runs away at the end: radius ∝ (1 − x)^(1/3), temperature ∝ 1/radius.
  vanish: (s) => {
    const x = clamp01((s - 0.2) / (FLASH - 0.2));
    const R = 0.09 * Math.cbrt(1 - x);
    return (
      <ShaderCanvas
        frag={HAWKING}
        uniforms={{ expo: 1 - ease((s - FLASH - 0.6) / 2.6), R, stars: 0.08 * (1 - x), emit: s >= FLASH ? 0 : 0.8 + 0.2 * x, heat: clamp01(0.2 + 0.8 * (1 - R / 0.09) ** 0.8), flash: s >= FLASH ? s - FLASH : -1 }}
      />
    );
  },
};

// The CJK faces have no superscript digits, so the exponent is set as <sup>.
const sup = (e: string) => <sup style={{ fontSize: '0.62em', verticalAlign: '0.55em', lineHeight: 0 }}>{e}</sup>;
const ERAS: Record<string, [React.ReactNode, React.ReactNode]> = {
  vanish: [<>最后的黑洞蒸发 · 约10{sup('100')}年后</>, <>THE LAST BLACK HOLE EVAPORATES · SOME 10{sup('100')} YEARS FROM NOW</>],
};

// After the burst the picture goes fully black and stays black to the end of the chapter.
const FLASH_G = at('l8', 0.86);
const Blackout: React.FC = () => {
  const { fps } = useVideoConfig();
  const k = ease((useCurrentFrame() / fps - FLASH_G - 1.2) / 2.4);
  return k > 0 ? <AbsoluteFill style={{ background: '#000', opacity: k }} /> : null;
};

export const Chapter7: React.FC<{ narration: boolean }> = ({ narration }) => {
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
        <Blackout />
      </Screen>
      {shots.map((sh) =>
        ERAS[sh.shot] ? <Era key={sh.shot} t0={sh.start + 0.3} t1={sh.shot === 'vanish' ? FLASH_G + 1.0 : sh.end} zh={ERAS[sh.shot][0]} en={ERAS[sh.shot][1]} /> : null,
      )}
      <Subtitles lines={tl.lines} />
      {audio && <Audio src={staticFile(narration ? 'music/ch7_narr.wav' : 'music/ch7_music.wav')} />}
    </ChapterRoot>
  );
};
