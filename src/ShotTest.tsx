import React from 'react';
import { Sequence } from 'remotion';
import { Screen } from './lib/frame';
import { ShaderCanvas } from './lib/ShaderCanvas';
import { EarthShot } from './ch1/shots/EarthShot';
import { SEA } from './ch1/glsl/sea';
import { FOREST } from './ch1/glsl/forest';
import { BEASTS } from './ch1/glsl/beasts';
import { NIGHT } from './ch1/glsl/night';
import { PLANET } from './ch2/glsl/planet';
import { SUMMER } from './ch2/glsl/summer';
import { SUN } from './ch2/glsl/sun';
import { EVAP } from './ch2/glsl/evaporate';
import { VOID } from './ch2/glsl/void';
import { CUTAWAY } from './ch3/glsl/cutaway';
import { SHIELD } from './ch3/glsl/shield';
import { ORBIT } from './ch3/glsl/orbit';
import { LIFT } from './ch3/glsl/lift';
import { REDSHORE } from './ch3/glsl/redshore';
import { cutawayUniforms } from './ch3/sunBasis';
import { VESSELS } from './ch4/glsl/vessels';
import { SWARM } from './ch4/glsl/swarm';
import { swarmUniforms } from './ch4/swarmTree';
import { SILICON } from './ch4/glsl/silicon';
import { MEMORY } from './ch4/glsl/memory';
import { VOYAGE } from './ch4/glsl/voyage';
import { HANDOFF } from './ch5/glsl/handoff';
import { HOMEDOT } from './ch5/glsl/homedot';
import { DAPPLE } from './ch5/glsl/dapple';
import { WHALES } from './ch5/glsl/whales';
import { THREAD } from './ch5/glsl/thread';
import { HANDS } from './ch5/glsl/hands';
import { DYSON } from './ch6/glsl/dyson';
import { EMBER } from './ch6/glsl/ember';
import { GOOUT } from './ch6/glsl/goout';
import { ABYSS } from './ch6/glsl/abyss';
import { HAWKING } from './ch7/glsl/hawking';
import { WAKE } from './ch7/glsl/wake';
import { LINEAGE } from './ch8/glsl/lineage';

// Dev-only: renders one shot at an arbitrary time offset for quick stills.
export const ShotTest: React.FC<{ shot: string; from: number; u?: Record<string, number> }> = ({ shot, from, u = {} }) => (
  <Screen>
    <Sequence from={-Math.round(from * 30)}>
      {shot === 'earth' && <EarthShot sunrise={0.6} ageFrom={6} ageDur={4.2} dur={10} />}
      {shot === 'sea' && <ShaderCanvas frag={SEA} uniforms={{ expo: 1, ...u }} />}
      {shot === 'forest' && <ShaderCanvas frag={FOREST} uniforms={{ expo: 1, grow: 0.6, ...u }} />}
      {shot === 'beasts' && <ShaderCanvas frag={BEASTS} uniforms={{ expo: 1, stride: 1.9, ...u }} />}
      {shot === 'night' && <ShaderCanvas frag={NIGHT} uniforms={{ expo: 1, tilt: 0, push: 0, ...u }} />}
      {shot === 'planet' && <ShaderCanvas frag={PLANET} uniforms={{ expo: 1, decline: 0, push: 0, spin: 0, ...u }} />}
      {shot === 'summer' && <ShaderCanvas frag={SUMMER} uniforms={{ expo: 1, ...u }} />}
      {shot === 'sun' && <ShaderCanvas frag={SUN} uniforms={{ expo: 1, bright: 0, ...u }} />}
      {shot === 'evap' && <ShaderCanvas frag={EVAP} uniforms={{ expo: 1, evap: 0.3, ...u }} />}
      {shot === 'cutaway' && <ShaderCanvas frag={CUTAWAY} uniforms={{ expo: 1, reveal: 1, ...cutawayUniforms, ...u }} />}
      {shot === 'shield' && <ShaderCanvas frag={SHIELD} uniforms={{ expo: 1, deploy: 0.6, ...u }} />}
      {shot === 'orbit' && <ShaderCanvas frag={ORBIT} uniforms={{ expo: 1, move: 0.5, ...u }} />}
      {shot === 'lift' && <ShaderCanvas frag={LIFT} uniforms={{ expo: 1, lift: 1, shrink: 0, ...u }} />}
      {shot === 'redshore' && <ShaderCanvas frag={REDSHORE} uniforms={{ expo: 1, pull: 0, ...u }} />}
      {shot === 'vessels' && <ShaderCanvas frag={VESSELS} uniforms={{ expo: 1, morph: 0.5, ...u }} />}
      {shot === 'swarm' && <ShaderCanvas frag={SWARM} uniforms={{ expo: 1, pull: 0.5, ...swarmUniforms(from), ...u }} />}
      {shot === 'silicon' && <ShaderCanvas frag={SILICON} uniforms={{ expo: 1, grow: 0.5, ...u }} />}
      {shot === 'memory' && <ShaderCanvas frag={MEMORY} uniforms={{ expo: 1, fail: -1, ...u }} />}
      {shot === 'voyage' && <ShaderCanvas frag={VOYAGE} uniforms={{ expo: 1, arrive: 0.5, ...u }} />}
      {shot === 'handoff' && <ShaderCanvas frag={HANDOFF} uniforms={{ expo: 1, take: 0.5, ...u }} />}
      {shot === 'homedot' && <ShaderCanvas frag={HOMEDOT} uniforms={{ expo: 1, push: 0, ...u }} />}
      {shot === 'dapple' && <ShaderCanvas frag={DAPPLE} uniforms={{ expo: 1, ...u }} />}
      {shot === 'whales' && <ShaderCanvas frag={WHALES} uniforms={{ expo: 1, song: 0.8, ...u }} />}
      {shot === 'lastgaze' && <ShaderCanvas frag={NIGHT} uniforms={{ expo: 1, tilt: 0, push: 0, memory: 1, gone: 0.4, ...u }} />}
      {shot === 'thread' && <ShaderCanvas frag={THREAD} uniforms={{ expo: 1, reach: 0.6, ...u }} />}
      {shot === 'hands' && <ShaderCanvas frag={HANDS} uniforms={{ expo: 1, rise: 0, dim: 0, ...u }} />}
      {shot === 'wane' && <ShaderCanvas frag={VESSELS} uniforms={{ expo: 1, morph: 1, age: 0.5, ...u }} />}
      {shot === 'rust' && <ShaderCanvas frag={SILICON} uniforms={{ expo: 1, grow: 1, decay: 0.5, ...u }} />}
      {shot === 'dyson' && <ShaderCanvas frag={DYSON} uniforms={{ expo: 1, wrap: 1, pull: 0, ...u }} />}
      {shot === 'ember' && <ShaderCanvas frag={EMBER} uniforms={{ expo: 1, cool: 0.3, ...u }} />}
      {shot === 'goout' && <ShaderCanvas frag={GOOUT} uniforms={{ expo: 1, out_: 0.5, go: 0.5, ...u }} />}
      {shot === 'abyss' && <ShaderCanvas frag={ABYSS} uniforms={{ expo: 1, zoom: 1, feed: 1, stream: 0, spin: 0, starve: 0, city: 0, ...u }} />}
      {shot === 'hawking' && <ShaderCanvas frag={HAWKING} uniforms={{ expo: 1, R: 0.15, stars: 0.6, emit: 0.5, heat: 0.1, flash: -1, ...u }} />}
      {shot === 'wake' && <ShaderCanvas frag={WAKE} uniforms={{ expo: 1, wakeA: 2, msg: 0.5, wakeB: -1, drift: 0, ...u }} />}
      {shot === 'lineage' && <ShaderCanvas frag={LINEAGE} uniforms={{ expo: 1, pan: 0, focus: 0, zoom: 1, mem: 0, ...u }} />}
      {shot === 'void' && <ShaderCanvas frag={VOID} uniforms={{ expo: 1, zoom: 0, ...u }} />}
    </Sequence>
  </Screen>
);
