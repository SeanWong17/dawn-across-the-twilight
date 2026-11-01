import { PRELUDE } from '../../lib/glsl';

// The last black hole, alone in the dark after the stars. Nothing falls in any more: it
// shows only as a shadow edged by a faint photon ring, bending the few dim stars left.
// Uniforms:
//  "R"     shadow radius (screen units); it shrinks as the hole evaporates,
//  "stars" (0..1) how many of the last dim background stars remain,
//  "emit"  (0..1) Hawking radiation: virtual pairs flicker at the horizon, one of each
//          pair escapes as a faint spark, and a thin thermal glow hangs round the hole,
//  "heat"  (0..1) the glow's temperature: dull red while the hole is huge, blue-white as it
//          shrinks toward the end,
//  "flash" seconds since the final burst (negative = not yet).
export const HAWKING = PRELUDE + `
uniform float expo;
uniform float R;
uniform float stars;
uniform float emit;
uniform float heat;
uniform float flash;

vec3 tempCol(float h) {
  vec3 c = mix(vec3(.6, .08, .03), vec3(1., .55, .25), smoothstep(0., .4, h));
  c = mix(c, vec3(1., .95, .9), smoothstep(.35, .75, h));
  return mix(c, vec3(.65, .8, 1.), smoothstep(.7, 1., h));
}

vec3 sky(vec2 uv) {
  // Sparse, dim, reddened stars, each going out at its own moment.
  vec2 g = uv * 40.;
  vec2 id = floor(g), f = fract(g) - .5;
  float h = hash21(id + 13.);
  if (h > .05) return vec3(0.);
  vec2 o = (hash22(id) - .5) * .7;
  float d = length(f - o) * res.y / 40.;
  float alive = smoothstep(hash11(h * 51.) - .05, hash11(h * 51.) + .05, stars);
  return vec3(1., .45, .3) * exp(-d * d * 1.4) * (.15 + .9 * pow(hash11(h * 7.), 4.)) * alive;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 p = uv - vec2(0., .01);
  float r = length(p);
  float px = 1. / res.y;
  float Rs = max(R, 1e-4);
  float rho = r / Rs;

  // Background with gravitational lensing around the shadow.
  vec2 lp = p * (1. - 1. / max(rho * rho, 1.05));
  vec3 col = vec3(.0008, .0007, .001) + mix(sky(uv), sky(lp), smoothstep(8., 2., rho));
  // Einstein-ring smear of the light behind it.
  col += vec3(.6, .3, .2) * exp(-abs(rho - 1.6) * 6.) * .012 * stars * step(.002, R);

  // The shadow and its faint photon ring.
  float sh = smoothstep(1.02, .97, rho) * step(.0005, R);
  col *= 1. - sh;
  float ringK = (.05 + .3 * stars) + emit * (.2 + 1.2 * heat);
  vec3 tc = tempCol(heat);
  col += mix(vec3(.9, .55, .4), tc, emit) * (exp(-abs(rho - 1.025) * 70.) * .9 + exp(-abs(rho - 1.04) * 12.) * .12) * ringK * step(.0005, R);

  // Thermal glow: grows hotter and, relative to the hole, larger as it shrinks.
  float gl = exp(-max(r - Rs, 0.) / (Rs * .5 + .004 + .02 * heat)) * step(Rs * .97, r);
  col += tc * gl * emit * (.04 + .9 * heat * heat);

  // Virtual pairs at the horizon. Each slot creates a pair at a random angle: one member
  // drops back in, the other escapes outward as a spark that fades as it travels.
  if (emit > 0.) {
    float rate = mix(.25, 2.4, heat);
    for (int i = 0; i < 48; i++) {
      float fi = float(i);
      float cyc = t * rate * (.6 + .8 * hash11(fi * 3.1)) + hash11(fi * 7.7);
      float k = floor(cyc), ph = fract(cyc);
      float hk = hash11(fi * 13.1 + k * 1.37);
      if (hk > emit) continue;
      float a = hash11(fi * 5.3 + k * 2.9) * TAU;
      vec2 dir = vec2(cos(a), sin(a));
      vec2 tang = vec2(-dir.y, dir.x);
      // Creation flash just outside the horizon.
      vec2 birth = dir * Rs * 1.08;
      float born = exp(-ph * 14.);
      float sep = Rs * .05 * smoothstep(0., .15, ph);
      float d1 = length(p - birth - tang * sep) / px;
      float d2 = length(p - birth + tang * sep - dir * Rs * .12 * ph) / px;
      col += tc * (exp(-d1 * d1 * .3) + exp(-d2 * d2 * .3) * (1. - smoothstep(.0, .25, ph))) * born * .9;
      // The escaping particle.
      vec2 q = birth + tang * sep + dir * (Rs * .1 + .55 * pow(ph, 1.3));
      float dq = length(p - q) / px;
      float b = (1. - ph) * (1. - ph) * (.35 + .9 * heat);
      col += tc * (exp(-dq * dq * .25) * 1.2 + exp(-dq * .18) * .05) * b;
    }
  }

  // The final burst: a white flash and a shell of light running outward into nothing.
  if (flash >= 0.) {
    float f = flash;
    col += vec3(1., .97, .92) * exp(-r / (.004 + f * .05)) * exp(-f * 1.4) * 2.5;
    col += vec3(.75, .85, 1.) * exp(-abs(r - f * .22) / (.004 + f * .01)) * exp(-f * .8) * .5;
    col += vec3(.6, .7, 1.) * exp(-r / .35) * exp(-f * 2.) * .15;
  }

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
