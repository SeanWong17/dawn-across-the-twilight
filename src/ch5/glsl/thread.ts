import { PRELUDE } from '../../lib/glsl';

// A spiral galaxy seen from far outside at an angle. From a point in an outer arm (home)
// a fine golden thread unspools inward toward the bright core, through the stars, with
// small pulses travelling back along it toward home. "reach" (0..1) is how far it runs.
export const THREAD = PRELUDE + `
uniform float expo;
uniform float reach;

const float INC = .42;          // y squash of the disk (inclination)
const float ROT = -.25;          // position angle on screen

vec2 toDisk(vec2 uv) {
  vec2 q = mat2(cos(ROT), -sin(ROT), sin(ROT), cos(ROT)) * uv;
  return vec2(q.x, q.y / INC);
}
vec2 toScreen(vec2 d) {
  vec2 q = vec2(d.x, d.y * INC);
  return mat2(cos(-ROT), -sin(-ROT), sin(-ROT), cos(-ROT)) * q;
}

// The thread's path in disk coordinates: s = 0 at home, 1 at the core.
vec2 threadAt(float s) {
  float r = mix(.62, .03, s);
  float a = 2.2 + s * 3.4 + .25 * sin(s * 9.);
  return r * vec2(cos(a), sin(a));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float px = 1. / res.y;
  float zoom = 1. - .08 * reach;
  uv *= zoom;
  vec3 col = vec3(.002, .002, .005);
  col += starfield(uv * .7 + 5., 70., .1, .4) * .35;

  vec2 d = toDisk(uv);
  float r = length(d);
  float spin = t * .01;
  float a = atan(d.y, d.x) - spin;
  // Two logarithmic arms with dust lanes on their inner edges.
  float pitch = .32;
  float arm = .5 + .5 * cos(2. * (a - log(r + .02) / pitch));
  float armS = pow(arm, 3.);
  vec2 dp = vec2(cos(a), sin(a)) * r;
  float n = fbm(dp * 8. + 3.), n2 = fbm(dp * 25. - 1.);
  float disk = exp(-r * 3.4);
  vec3 young = vec3(.55, .7, 1.), old = vec3(1., .82, .6);
  vec3 g = mix(old, young, smoothstep(.1, .5, r)) * disk * (.25 + 1.6 * armS * (.5 + n));
  float lane = smoothstep(.55, .9, pow(.5 + .5 * cos(2. * (a - log(r + .02) / pitch) - .9), 4.)) * smoothstep(.06, .2, r);
  g *= 1. - .7 * lane * n;
  // HII regions dotting the arms.
  g += vec3(1., .45, .55) * smoothstep(.78, .9, n2) * armS * disk * 1.2;
  // Resolved stars in the disk.
  g += starfield(dp * 1.4, 160., .35, .5) * disk * armS * 1.4;
  // Bulge.
  g += old * (exp(-r * 18.) * 1.4 + exp(-length(uv) * 9.) * .25);
  col += g * .9;

  // The thread.
  float dth = 1e3, sAt = 0.;
  const int N = 48;
  vec2 prev = toScreen(threadAt(0.));
  for (int i = 1; i <= N; i++) {
    float s = float(i) / float(N);
    if (s - 1. / float(N) > reach) break;
    float se = min(s, reach);
    vec2 cur = toScreen(threadAt(se));
    vec2 pa = uv - prev, ba = cur - prev;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0., 1.);
    float dd = length(pa - ba * h);
    if (dd < dth) { dth = dd; sAt = mix(se - 1. / float(N), se, h); }
    prev = cur;
  }
  float line = exp(-dth / px * .9) * .9 + exp(-dth / px * .12) * .06;
  // Pulses heading home along it.
  float pulse = pow(.5 + .5 * sin(sAt * 40. + t * 3.), 16.);
  vec3 gold = vec3(1., .78, .42);
  col += gold * line * (.7 + 1.6 * pulse) * smoothstep(0., .02, reach);
  // Home: a tiny warm point where it starts; the leading end glows.
  vec2 home = toScreen(threadAt(0.));
  float dh = length(uv - home) / px;
  col += vec3(.6, .8, 1.) * (exp(-dh * .5) * 1.4 + exp(-dh * .05) * .05);
  vec2 tip = toScreen(threadAt(reach));
  float dt = length(uv - tip) / px;
  col += gold * (exp(-dt * .35) * 1.6 + exp(-dt * .04) * .08) * smoothstep(0., .02, reach) * step(reach, .995);

  outColor = finish(col * 1.15 * expo, gl_FragCoord.xy);
}`;
