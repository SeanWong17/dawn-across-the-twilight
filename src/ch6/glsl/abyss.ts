import { PRELUDE } from '../../lib/glsl';
import { HOLE } from './hole';

// The black hole at the heart of a galaxy, where the minds we made have settled. A ring
// of habitats (small lit stations) orbits well outside the disk. Uniforms:
//  "zoom"   camera scale (1 = wide, larger = closer),
//  "feed"   brightness of the accretion disk,
//  "stream" (0..1) a stream of gas torn from a star spirals in and lights the disk,
//  "spin"   (0..1) frame dragging made visible: swirling lines, polar jets, and the
//           habitats drawing power along thin beams,
//  "starve" (0..1) the disk thins to dying clumps, the jets fail, the habitats go dark,
//  "city"   (0..1) the habitats seen as cities: larger, ringed with lights, their faces
//           lit by the disk.
export const ABYSS = PRELUDE + HOLE + `
uniform float expo;
uniform float zoom;
uniform float feed;
uniform float stream;
uniform float spin;
uniform float starve;
uniform float city;

const float INC = .24;

float segH(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h);
}

// Screen offset of a point on the disk plane at radius r, angle a (units of R).
vec2 plane(float r, float a) { return vec2(cos(a), sin(a) * INC) * r; }

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float R = .085 * zoom;
  vec2 C = vec2(0., .01);
  vec2 p = uv - C;
  float px = 1. / res.y;

  // Background: the dense starfield and dust of a galactic core, fading as stars die.
  float bgK = 1. - .7 * starve;
  vec3 bg = vec3(.006, .004, .004) + vec3(.06, .035, .02) * fbm(uv * 2.2 + 4.) * exp(-abs(uv.y) * 3.) * bgK;
  bg += starfield(uv * .8 + 1.3, 90., .16, .4) * .5 * bgK;
  bg += starfield(uv * .8 + 7.1, 200., .22, .2) * .2 * bgK;
  // Light from behind is bent around the shadow: sample the background at a lensed point.
  float rr = length(p) / R;
  vec2 lp = p * (1. - 1. / max(rr * rr, 1.05));
  vec3 lensed = vec3(.006, .004, .004) + starfield((lp + C) * .8 + 1.3, 90., .16, .4) * .5 * bgK;
  lensed += vec3(.06, .035, .02) * fbm((lp + C) * 2.2 + 4.) * exp(-abs(lp.y) * 3.) * bgK;
  vec3 col = mix(bg, lensed, smoothstep(6., 1.5, rr));

  // Frame-dragging swirl: faint log-spiral lines turning with the hole.
  if (spin > 0.) {
    vec2 d = vec2(p.x, p.y / (INC * 1.8)) / R;
    float r = length(d), a = atan(d.y, d.x);
    float sw = pow(.5 + .5 * sin(5. * (a + t * 1.4 / max(r, 1.) + 2.4 * log(r))), 8.);
    col += vec3(.25, .45, 1.) * sw * smoothstep(1.2, 1.8, r) * exp(-r * .35) * .18 * spin * (1. - starve);
  }

  // The stream of gas from a torn star, spiralling in from upper right.
  if (stream > 0.) {
    float best = 1e3, bh = 0.;
    vec2 prev = plane(14., .6) + vec2(0., 5.5);
    for (int i = 1; i <= 36; i++) {
      float s = float(i) / 36.;
      float r = mix(14., 1.5, pow(s, .8));
      float a = .6 - s * 5.2;
      vec2 q = plane(r, a) + vec2(0., 5.5 * (1. - s) * (1. - s));
      float h;
      float dd = segH(p / R, prev, q, h);
      if (dd < best) { best = dd; bh = (float(i - 1) + h) / 36.; }
      prev = q;
    }
    float shown = smoothstep(bh - .05, bh, stream * 1.15);
    float w = mix(.25, .06, bh);
    float glow = exp(-best * best / (w * w)) * (.5 + .6 * fbm(vec2(bh * 30. - t * 2., 1.)));
    vec3 sc = mix(vec3(1., .55, .3), vec3(1., .9, .8), bh);
    col += sc * glow * shown * .55 * (1. - starve);
    // The star being torn apart.
    vec2 st = (plane(14., .6) + vec2(0., 5.5)) * R;
    float sd = length(p - st);
    col += vec3(1., .82, .65) * (exp(-sd * sd / (R * R * .08)) * 1.2 + exp(-sd / (R * .9)) * .25) * smoothstep(.0, .2, stream);
  }

  // Polar jets fed by the spin.
  float jet = spin * (1. - smoothstep(.2, .7, starve));
  if (jet > 0.) {
    float ax = abs(p.x + p.y * .06) / R;
    float along = abs(p.y) / R;
    float wj = .05 + along * .025;
    float j = exp(-ax * ax / (wj * wj)) * smoothstep(.8, 2., along) * exp(-along * .09);
    j *= .6 + .6 * fbm(vec2(ax * 3., along * .8 - t * 4.));
    col += vec3(.45, .65, 1.) * j * jet * .35;
  }

  float shade;
  vec3 hole = blackHole(p, R, INC, feed * 1.5 * (1. + .6 * stream), starve, shade);
  col = col * (1. - shade * .85) + hole;

  // The habitat ring. Each station is a small lit node; in front of the disk on the near
  // half, behind it (and dimmer) on the far half. With spin, beams link them to the disk.
  float RH = 6.5;
  for (int i = 0; i < 22; i++) {
    float fi = float(i);
    float a = fi / 22. * TAU + t * .05 + .3 * hash11(fi);
    float rh = RH * (1. + .12 * (hash11(fi * 3.1) - .5));
    vec2 q = plane(rh, a) * R + vec2(0., .02 * R * sin(fi * 2.));
    float d = length(p - q);
    float near = step(sin(a), 0.);
    // Each habitat goes dark at its own moment as the hole starves.
    float alive = 1. - smoothstep(.2 + .7 * hash11(fi * 7.7), .26 + .7 * hash11(fi * 7.7), starve);
    float tw = .8 + .2 * sin(t * 3. + fi * 4.);
    float sz = R * (.08 + .04 * near) * (.6 + .8 * hash11(fi * 5.3)) * (1. + .9 * city);
    vec3 hc = mix(vec3(1., .82, .55), vec3(.6, .85, 1.), hash11(fi * 1.9));
    col = mix(col, vec3(.01), smoothstep(sz * 1.3, sz * .6, d) * .7);
    col += hc * (exp(-d * d / (sz * sz * .12)) * 1.4 + exp(-d / (sz * 2.5)) * .08) * alive * tw * mix(.55, 1., near);
    if (city > 0. && d < sz * 3.) {
      // Districts of lights circling each city, and the disk's glow on its inner face.
      vec2 o = p - q;
      float ca = atan(o.y, o.x), cr = length(o) / sz;
      float seg = fract(ca / TAU * 14. + fi * .37 + t * .02);
      float lights = exp(-pow((cr - 1.15) / .12, 2.)) * smoothstep(.35, .5, seg) * smoothstep(.95, .8, seg);
      lights += exp(-pow((cr - 1.7) / .08, 2.)) * step(.5, fract(ca / TAU * 22. + fi)) * .25;
      vec3 lc = vec3(1., .8, .5) * (.7 + .3 * hash11(floor(ca / TAU * 14.) + fi * 9.));
      float face = .5 + .5 * dot(normalize(o + 1e-5), normalize(-q));
      col += lc * lights * city * alive * mix(.5, 1., near) * .9;
      col += vec3(1., .7, .45) * exp(-pow((cr - 1.0) / .18, 2.)) * face * face * city * alive * .35 * mix(.5, 1., near);
    }
    // Power beams from the inner disk to each habitat while the spin is tapped.
    if (spin > .01 && hash11(fi * 2.9) < .45) {
      float h;
      vec2 a0 = plane(1.6, a + .4) * R;
      float bd = segH(p, a0, q, h);
      float pulse = .4 + .6 * pow(.5 + .5 * sin(h * 18. - t * 6. + fi), 6.);
      col += vec3(.5, .75, 1.) * exp(-bd / (px * .8)) * pulse * spin * alive * .14 * mix(.4, 1., near);
    }
  }

  outColor = finish(col * 1.1 * expo, gl_FragCoord.xy);
}`;
