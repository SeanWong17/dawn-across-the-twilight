import React from 'react';
import { Audio, staticFile } from 'remotion';
import { Screen, Subtitles } from '../lib/frame';
import { ShaderCanvas } from '../lib/ShaderCanvas';
import { Shot } from '../lib/Shot';
import { Era } from '../lib/Overlays';
import { ChapterRoot, useJoin } from '../lib/join';
import { VESSELS } from '../ch4/glsl/vessels';
import { SILICON } from '../ch4/glsl/silicon';
import { DYSON } from './glsl/dyson';
import { EMBER } from './glsl/ember';
import { GOOUT } from './glsl/goout';
import { ABYSS } from './glsl/abyss';
import tl from './timeline.json';

export const CH6_FRAMES = tl.frames;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

// The black-hole shots form one continuous move: the camera keeps closing in across
// abyss → infall → spin, then holds while the hole starves.
const render: Record<string, React.ComponentProps<typeof Shot>['render']> = {
  // The body of light from chapter 4, ageing: "even past flesh, no eternity".
  wane: (s, dur) => <ShaderCanvas frag={VESSELS} uniforms={{ expo: 1, morph: 1, age: ease((s - 0.8) / (dur - 1.0)) }} />,
  rust: (s, dur) => <ShaderCanvas frag={SILICON} uniforms={{ expo: 1, grow: 1, decay: ease((s - 0.2) / (dur - 0.3)) }} />,
  dyson: (s, dur) => <ShaderCanvas frag={DYSON} uniforms={{ expo: 1, wrap: ease((s - 0.2) / (dur * 0.7)), pull: ease(s / dur) }} />,
  ember: (s, dur) => <ShaderCanvas frag={EMBER} uniforms={{ expo: 1, cool: ease((s - 0.6) / (dur - 0.9)) }} />,
  goout: (s, dur) => <ShaderCanvas frag={GOOUT} uniforms={{ expo: clamp01(s / 0.8), out_: 0.15 + 0.8 * ease(s / (dur - 0.4)), go: ease((s - 0.4) / (dur - 0.5)) }} />,
  abyss: (s, dur) => <ShaderCanvas frag={ABYSS} uniforms={{ expo: clamp01(s / 1.0), zoom: 0.75 + 0.25 * ease(s / dur), feed: 1, stream: 0, spin: 0, starve: 0, city: 0 }} />,
  infall: (s, dur) => <ShaderCanvas frag={ABYSS} uniforms={{ expo: 1, zoom: 1.0 + 0.15 * ease(s / dur), feed: 1, stream: ease((s - 0.1) / (dur - 0.3)), spin: 0, starve: 0, city: 0 }} />,
  // The light of the falling matter on the habitats: cities at the edge of the abyss.
  cities: (s, dur) => <ShaderCanvas frag={ABYSS} uniforms={{ expo: 1, zoom: 1.15 + 0.1 * ease(s / dur), feed: 1, stream: 1, spin: 0, starve: 0, city: ease((s - 0.1) / (dur * 0.6)) }} />,
  spin: (s, dur) => <ShaderCanvas frag={ABYSS} uniforms={{ expo: 1, zoom: 1.25 + 0.2 * ease(s / dur), feed: 1, stream: 0, spin: ease((s - 0.2) / 2.2), starve: 0, city: 1 }} />,
  starve: (s, dur, j) => (
    <ShaderCanvas frag={ABYSS} uniforms={{ expo: j.joinedOut ? 1 : 1 - 0.9 * ease((s - (dur - 3.2)) / 3.0), zoom: 1.45 + 0.1 * ease(s / dur), feed: 1, stream: 0, spin: 1, starve: ease((s - 0.6) / (dur - 4.0)), city: 1 }} />
  ),
};

const ERAS: Record<string, [string, string]> = {
  ember: ['约一百万亿年后', 'SOME 100 TRILLION YEARS FROM NOW'],
  abyss: ['星系中央 · 超大质量黑洞', 'THE GALACTIC CORE · A SUPERMASSIVE BLACK HOLE'],
};

export const Chapter6: React.FC<{ narration: boolean }> = ({ narration }) => {
  const shots = tl.shots;
  const X = tl.cues.xfade;
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
      {audio && <Audio src={staticFile(narration ? 'music/ch6_narr.wav' : 'music/ch6_music.wav')} />}
    </ChapterRoot>
  );
};
