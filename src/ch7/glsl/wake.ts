import { PRELUDE } from '../../lib/glsl';

// Two travellers in the thinning dark, far apart, both dormant: small embers of the same
// warm light the hands once held. Far behind them the last black hole is a faint dot,
// glowing as it evaporates. Uniforms:
//  "wakeA" seconds since traveller A woke (negative = still asleep),
//  "msg"   (0..1) a thread of light (the conversation) crossing from A to B,
//  "wakeB" seconds since B woke on receiving it,
//  "drift" slow camera drift,
//  "sleep" (0..1) both slow their thinking and sink back toward dormancy, saving energy.
export const WAKE = PRELUDE + `
uniform float expo;
uniform float wakeA;
uniform float msg;
uniform float wakeB;
uniform float drift;
uniform float sleep;

const vec2 A = vec2(-.5, -.1);
const vec2 B = vec2(.52, .12);

// A sleeping or waking traveller: a tiny lattice shell around a warm core.
vec3 traveller(vec2 p, float w, float seed) {
  float awake = (w < 0. ? 0. : smoothstep(0., 1.6, w)) * (1. - .85 * sleep);
  float breathe = .55 + .45 * sin(t * (.6 + 1.6 * awake) + seed);
  float r = length(p);
  vec3 warm = vec3(1., .66, .32);
  // Dormant: a faint ember that barely pulses.
  vec3 c = warm * (exp(-r * r / 5e-6) * 1.6 + exp(-r / .01) * .12 + exp(-r / .04) * .02) * (.45 + .3 * breathe);
  // Awake: the core brightens, a shell of faint lines opens round it.
  c += warm * (exp(-r * r / 8e-6) * 1.6 + exp(-r / .012) * .3 + exp(-r / .05) * .06) * awake * (.8 + .2 * breathe);
  float a = atan(p.y, p.x);
  float shell = exp(-abs(r - .016 - .004 * breathe) * 1400.) * (.5 + .5 * sin(a * 6. + t + seed));
  float shell2 = exp(-abs(r - .028) * 1600.) * (.5 + .5 * sin(a * 9. - t * .7 + seed));
  c += vec3(1., .75, .45) * (shell * .5 + shell2 * .25) * awake;
  // The flare of waking.
  if (w >= 0.) c += vec3(1., .85, .6) * exp(-abs(r - w * .09) * 300.) * exp(-w * 1.6) * .5;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  uv += vec2(drift * .04, drift * .012);
  float px = 1. / res.y;
  vec3 col = vec3(.0007, .0006, .0009);
  // Almost nothing remains: a faint grain of the cold, and the far hole as a dim spark.
  col += vec3(.012, .008, .01) * fbm(uv * 1.5 + t * .01) * .3;
  vec2 H = vec2(.12, .26);
  float dh = length(uv - H) / px;
  col += vec3(1., .78, .6) * (exp(-dh * dh * .5) * .25 + exp(-dh * .3) * .015) * (.85 + .15 * sin(t * 1.3));

  // The thread of light from A to B, its head moving slowly across.
  if (msg > 0.) {
    vec2 ba = B - A, pa = uv - A;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    float bow = .05 * sin(h * PI);
    vec2 nrm = normalize(vec2(-ba.y, ba.x));
    vec2 on = A + ba * h + nrm * bow;
    float d = length(uv - on) / px;
    float head = clamp(msg, 0., 1.);
    float drawn = smoothstep(head + .002, head - .002, h);
    // Pulses travelling along it, the words.
    float pulse = pow(.5 + .5 * sin(h * 60. - t * 3.), 14.);
    float fadeTail = (.35 + .65 * smoothstep(head - .6, head, h)) * (1. - .8 * sleep);
    col += vec3(1., .7, .38) * exp(-d * d * .35) * drawn * (.15 + .6 * pulse) * fadeTail;
    col += vec3(1., .6, .3) * exp(-d * .25) * drawn * .012;
    // The bright head.
    vec2 hp = A + ba * head + nrm * .05 * sin(head * PI);
    float dd = length(uv - hp) / px;
    col += vec3(1., .85, .6) * (exp(-dd * dd * .2) * 1.6 + exp(-dd * .12) * .06) * step(head, .995);
  }

  col += traveller(uv - A, wakeA, 1.);
  col += traveller(uv - B, wakeB, 4.);

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
