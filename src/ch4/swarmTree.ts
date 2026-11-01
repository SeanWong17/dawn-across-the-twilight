// Self-replicating probe tree, computed on the CPU each frame. Heap-ordered binary tree:
// probe i (1-based) has parent i>>1 and is built in generation floor(log2 i), every
// PERIOD seconds. Each probe flies straight from where its parent was when it was born.
export const N_PROBES = 127;
const PERIOD = 0.62;

const hash = (x: number) => {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const gen = (i: number) => Math.floor(Math.log2(i) + 1e-3);
const birth = (i: number) => (i === 1 ? 0 : gen(i) * PERIOD + 0.25 * hash(i * 3.7));

/** Returns `seg` (start.xy, pos.xy per probe) and `age` (seconds since birth, < 0 = unborn), flattened as vec4s. */
export function swarmUniforms(t: number) {
  const ang = new Float64Array(N_PROBES + 1);
  const spd = new Float64Array(N_PROBES + 1);
  const seg = new Array(N_PROBES * 4).fill(0);
  const age = new Array(Math.ceil(N_PROBES / 4) * 4).fill(-1);
  const start: [number, number][] = [];
  for (let i = 1; i <= N_PROBES; i++) {
    const p = i >> 1;
    const b = birth(i);
    ang[i] = i === 1 ? 0.35 : ang[p] + (i % 2 === 0 ? 1 : -1) * (0.55 + 0.45 * hash(i * 1.3));
    spd[i] = i === 1 ? 0.1 : 0.19 * Math.pow(0.94, gen(i)) * (0.8 + 0.4 * hash(i * 5.1));
    // Where the parent was at this probe's birth.
    let s0: [number, number] = [0, 0];
    if (i > 1) {
      const ps = start[p];
      const dt = b - birth(p);
      s0 = [ps[0] + Math.cos(ang[p]) * spd[p] * dt, ps[1] + Math.sin(ang[p]) * spd[p] * dt];
    }
    start[i] = s0;
    const a = Math.max(0, t - b);
    seg.splice((i - 1) * 4, 4, s0[0], s0[1], s0[0] + Math.cos(ang[i]) * spd[i] * a, s0[1] + Math.sin(ang[i]) * spd[i] * a);
    age[i - 1] = t - b;
  }
  return { seg, age };
}
