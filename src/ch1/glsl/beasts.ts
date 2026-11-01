import { PRELUDE } from '../../lib/glsl';

// Great beasts on a plain at dusk: a sauropod herd in silhouette against a huge red sun,
// walking left. Each foot stays planted through its stance while the body moves over it,
// so stride length and walking speed agree. Gait period is "stride" seconds and matches
// the footfall SFX (hind feet land at phase 0 and 0.5).
export const BEASTS = PRELUDE + `
uniform float expo;
uniform float stride;

float sdSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float smin(float a, float b, float k) {
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

const float DUTY = .64;

// Foot position relative to the hip column at gait phase u, stride length L.
vec2 footAt(float u, float L) {
  u = fract(u);
  if (u < DUTY) return vec2(-L * .5 + L * u / DUTY, 0.);         // planted, body passes over
  float s = (u - DUTY) / (1. - DUTY);
  return vec2(L * .5 - L * smoothstep(0., 1., s), sin(PI * s) * .07);  // swing forward
}

// Two-bone leg from hip to foot. bend = -1 puts the knee forward (toward -x).
float leg(vec2 p, vec2 hip, vec2 foot, float l1, float l2, float bend, float r0, float r1, float r2) {
  vec2 ank = foot + vec2(0., .045);
  vec2 d = ank - hip;
  float L = min(length(d), l1 + l2 - .001);
  vec2 dir = normalize(d);
  float a = (l1 * l1 - l2 * l2 + L * L) / (2. * L);
  float h = sqrt(max(l1 * l1 - a * a, 0.));
  vec2 knee = hip + dir * a + vec2(-dir.y, dir.x) * h * bend;
  float s = min(sdSeg(p, hip, knee, r0, r1), sdSeg(p, knee, ank, r1, r2));
  // Broad, elephantine foot pad.
  float pad = length((p - foot - vec2(-.008, .022)) / vec2(r2 * 1.2, .024)) - 1.;
  return smin(s, pad * .024, .015);
}

// Sauropod facing left, hip height ~.58. g: x neck length, y neck raise (0 = level,
// 1 = upright), z tail length, w body length. Returns (near side, far-side legs).
vec2 sauropod(vec2 p, float phase, float L, vec4 g, float sway) {
  float bob = .012 * cos(phase * TAU * 2.);
  p.y -= bob;
  float bl = .38 * g.w;
  vec2 bc = vec2(0., .66);
  float body = (length((p - bc) / vec2(bl, .2)) - 1.) * .19;
  // Shoulders sit a little higher than hips when the neck is raised (brachiosaur-like).
  float sh = .05 * g.y;
  float withers = (length((p - vec2(-bl * .55, .7 + sh)) / vec2(.2, .17)) - 1.) * .16;
  float d = smin(body, withers, .08);

  // Neck: three segments curving up and forward, swaying slightly with the gait.
  float ang = mix(.55, 1.25, g.y);
  vec2 n0 = vec2(-bl * .7, .74 + sh);
  float nl = .36 * g.x;
  vec2 n1 = n0 + nl * vec2(-cos(ang * .7), sin(ang * .7));
  vec2 n2 = n1 + nl * vec2(-cos(ang), sin(ang)) + vec2(0., .01 * sin(phase * TAU + sway));
  vec2 n3 = n2 + nl * .9 * vec2(-cos(ang * 1.1 - .15), sin(ang * 1.1 - .15)) + vec2(0., .015 * sin(phase * TAU + sway));
  float neck = min(sdSeg(p, n0, n1, .13, .085), min(sdSeg(p, n1, n2, .085, .06), sdSeg(p, n2, n3, .06, .042)));
  d = smin(d, neck, .07);
  vec2 hd = normalize(n3 - n2);
  vec2 hdir = normalize(vec2(-1., -.35) + hd * .2);
  vec2 hp = p - (n3 + hdir * .045);
  mat2 hr = mat2(hdir.x, -hdir.y, hdir.y, hdir.x);
  float headD = (length((hr * hp) / vec2(.085, .042)) - 1.) * .042;
  d = smin(d, headD, .025);

  // Tail: long taper with a slow swing.
  float tl = .45 * g.z;
  float tw = .03 * sin(phase * TAU + 1.3 + sway);
  vec2 t0 = vec2(bl * .8, .7), t1 = t0 + vec2(tl, -.04 + tw), t2 = t1 + vec2(tl * .9, -.13 + tw * 2.), t3 = t2 + vec2(tl * .9, -.12 + tw * 3.);
  float tail = min(sdSeg(p, t0, t1, .12, .07), min(sdSeg(p, t1, t2, .07, .035), sdSeg(p, t2, t3, .035, .006)));
  d = smin(d, tail, .06);

  // Lateral-sequence walk: LH 0, LF .25, RH .5, RF .75. Near side = right legs.
  vec2 hipH = vec2(bl * .55, .6), hipF = vec2(-bl * .55, .62 + sh);
  // Columnar legs, nearly straight: total length just over hip height.
  float hl = (hipH.y - .045) * .515, fl = (hipF.y - .045) * .515;
  float nearL = min(
    leg(p, hipH, vec2(hipH.x, 0.) + footAt(phase + .5, L), hl, hl, -1., .1, .062, .05),
    leg(p, hipF, vec2(hipF.x, 0.) + footAt(phase + .75, L), fl, fl, 1., .085, .055, .046));
  float farL = min(
    leg(p, hipH + vec2(.03, 0.), vec2(hipH.x + .03, 0.) + footAt(phase, L), hl, hl, -1., .095, .058, .047),
    leg(p, hipF + vec2(.03, 0.), vec2(hipF.x + .03, 0.) + footAt(phase + .25, L), fl, fl, 1., .08, .052, .043));
  d = smin(d, nearL, .05);
  return vec2(d, farL);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float horizon = -.12;

  // Dusk sky with a swollen, low sun.
  vec2 sun = vec2(-.18, -.02 - t * .003);
  float sd = length(uv - sun);
  vec3 col = mix(vec3(.85, .3, .1), vec3(.1, .05, .1), smoothstep(horizon, .45, uv.y));
  col += vec3(1., .55, .25) * exp(-sd * 3.5) * .7;
  float disc = smoothstep(.215, .21, sd);
  col = mix(col, vec3(1.5, .62, .28) * (1. - .2 * smoothstep(.0, .21, sd)), disc);
  // Thin cloud bands across the sun.
  float cb = fbm(vec2(uv.x * 2. + t * .01, uv.y * 22.));
  col = mix(col, col * vec3(.6, .45, .45), smoothstep(.55, .75, cb) * smoothstep(-.05, .2, uv.y) * .8);

  // Distant volcanic ridge.
  float rx = uv.x * 1.4;
  float r = horizon + .05 + .07 * fbm(vec2(rx * 1.5, 2.)) + .05 * exp(-pow((uv.x - .55) * 6., 2.));
  if (uv.y < r) col = mix(vec3(.25, .1, .08), col, .45);

  // Plain.
  if (uv.y < horizon) {
    float dz = (horizon - uv.y);
    vec3 ground = mix(vec3(.28, .12, .06), vec3(.05, .03, .025), smoothstep(.0, .25, dz));
    ground *= .7 + .3 * fbm(vec2(uv.x / (dz + .05) * .2, 1. / (dz + .05)));
    // Sun reflection on wet ground / shallow water.
    float refl = exp(-abs(uv.x - sun.x) * 9.) * smoothstep(.2, .0, dz) * (.5 + .5 * fbm(vec2(uv.x * 20., dz * 80.)));
    ground += vec3(1., .5, .2) * refl * .5;
    col = ground;
  }

  // Herd at several depths, far to near. Animals differ in size, build and gait phase;
  // a juvenile keeps close to the lead adult.
  const int N = 6;
  float SZ[N] = float[N](.48, .21, .3, .19, .13, .085);
  float X0[N] = float[N](.62, 1.02, .02, -.4, -.75, .35);
  float DY[N] = float[N](.29, .2, .13, .075, .045, .022);
  float PH[N] = float[N](0., .41, .63, .18, .82, .3);
  float SP[N] = float[N](1., .75, .94, 1., 1.05, .9);
  vec4 G[N] = vec4[N](vec4(1.05, .45, 1., 1.), vec4(.8, .3, .8, .85), vec4(1.15, .12, 1.15, 1.08),
                      vec4(.85, .95, .85, .95), vec4(1., .55, 1., 1.), vec4(1.1, .3, 1.1, 1.));
  for (int i = N - 1; i >= 0; i--) {
    float fi = float(i);
    float sz = SZ[i];
    float T = stride * SP[i];
    float L = .26;
    float v = L / (DUTY * T);                     // local units per second
    float phase = t / T + PH[i];
    float x = X0[i] - t * v * sz;
    float y0 = horizon - DY[i];
    vec2 p = (uv - vec2(x, y0)) / sz;
    vec2 dd = sauropod(p, phase, L, G[i], fi * 1.7) * sz;
    float haze = i == 0 ? 0. : (i == 1 ? .12 : clamp((.29 - DY[i]) * 1.9, 0., .8));
    // Dust kicked up behind the feet, drawn under the animal.
    vec2 dq = uv - vec2(x + sz * .5, y0 + sz * .05);
    vec2 ds = dq / vec2(sz * 1.4, sz * .22);
    float du = exp(-dot(ds, ds)) * fbm(dq * 8. / sz + vec2(t * .4, 0.));
    col += vec3(.8, .42, .2) * du * .4 * (1. - haze * .5);
    vec3 dark = vec3(.025, .015, .015);
    vec3 bg = col;
    float mf = smoothstep(.0015, -.0005, dd.y);
    col = mix(col, mix(dark, bg, haze + .14), mf);
    float m = smoothstep(.0015, -.0005, dd.x);
    vec3 c = mix(dark, bg, haze);
    float rim = smoothstep(-.004, -.0005, dd.x) * smoothstep(.45, 1., p.y) * (i == 0 ? .5 : .2);
    c += vec3(1., .45, .18) * rim * (1. - haze);
    col = mix(col, c, m);
  }

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
