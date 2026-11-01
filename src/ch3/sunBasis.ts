// World↔object basis for the cutaway Sun, shared by the shader and the annotations.
// The removed octant's diagonal (1,1,1)/√3 is turned to face the viewer, slightly up
// and to the left, so all three cut faces are visible.
type V = [number, number, number];
const norm = (v: V): V => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Rotation taking world direction w to object direction d (Rodrigues).
const rotation = (w: V, d: V): V[] => {
  const v = cross(w, d);
  const c = dot(w, d);
  const k = 1 / (1 + c);
  return [
    [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1]],
    [v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0]],
    [v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c],
  ];
};

export const M = rotation(norm([-0.42, 0.34, 1]), norm([1, 1, 1]));
export const SUN_CTR: [number, number] = [0.3, -0.02];
export const SUN_RAD = 0.36;

/** Object-space point (sphere radius 1) → picture pixel position. */
export const project = (o: V): [number, number] => {
  // World = Mᵀ · o
  const w: V = [0, 1, 2].map((j) => M[0][j] * o[0] + M[1][j] * o[1] + M[2][j] * o[2]) as V;
  const u = SUN_CTR[0] + w[0] * SUN_RAD, v = SUN_CTR[1] + w[1] * SUN_RAD;
  return [960 + u * 804, 402 - v * 804];
};

export const cutawayUniforms = { m0: M[0] as V, m1: M[1] as V, m2: M[2] as V, ctr: SUN_CTR, rad: SUN_RAD };
