import { PRELUDE } from '../../lib/glsl';

// The home world under its recast Sun: a large, soft red dwarf hangs low over a calm
// sea; forested headlands stand against an amber and violet sky. The swell crests
// glow faintly with life. "pull" (0..1) slowly widens the view.
export const REDSHORE = PRELUDE + `
uniform float expo;
uniform float pull;

float ridge(float x, float seed) {
  return fbm(vec2(x * 1.2 + seed, seed)) - .5 + .3 * (fbm(vec2(x * 4. + seed * 2., 1.)) - .5);
}
float canopy(float x, float scale, float seed) {
  float c = .6 * vnoise(vec2(x * scale, seed)) + .3 * vnoise(vec2(x * scale * 2.7, seed + 3.)) + .1 * vnoise(vec2(x * scale * 7., seed + 5.));
  float f = fract(x * scale * 1.3 + seed) - .5;
  return c + .4 * max(0., 1. - abs(f) * 4.) * step(.6, hash11(floor(x * scale * 1.3 + seed)));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  uv /= 1. + .12 * (1. - pull);
  float horizon = -.05;
  vec2 sun = vec2(-.1, .12);
  float sd = length(uv - sun);

  // Sky: violet overhead, amber toward the dwarf star; a few stars remain visible.
  vec3 col = mix(vec3(.95, .38, .16), vec3(.12, .05, .16), smoothstep(-.05, .45, uv.y));
  col += starfield(uv, 70., .1, .6) * smoothstep(.15, .45, uv.y) * .6;
  col += vec3(1., .35, .12) * (exp(-sd * 3.) * .6 + exp(-sd * 10.) * .5);
  float disc = smoothstep(.15, .145, sd);
  vec3 sunC = vec3(1.5, .5, .2) * (1. - .25 * smoothstep(.0, .15, sd));
  // Slow star with large, dim granulation.
  vec2 sp = (uv - sun) / .15;
  sunC *= .85 + .2 * vnoise(sp * 9. + t * .1);
  col = mix(col, sunC, disc);
  // Thin cloud streaks across the star.
  float cl = fbm(vec2(uv.x * 2. + t * .01, uv.y * 20.));
  col = mix(col, col * vec3(.55, .4, .45), smoothstep(.55, .78, cl) * smoothstep(-.02, .1, uv.y) * smoothstep(.45, .1, uv.y) * .7);

  // Sea, all the way to the bottom of the frame. Nearer water reflects less of the sky,
  // so it darkens smoothly toward the viewer; slow swells roll in, and the crests glow
  // faintly with life.
  if (uv.y < horizon) {
    float dz = horizon - uv.y;
    float z = .2 / dz;
    float w = fbm(vec2(uv.x * z * .8, z * 1.5 - t * .25));
    vec3 sea = mix(vec3(.06, .03, .06), vec3(.22, .09, .1), w);
    float near = smoothstep(.08, .42, dz);
    float swell = .5 + .5 * sin(z * 9. - t * .9 + 1.5 * fbm(vec2(uv.x * z * .5, t * .1)));
    sea *= mix(1., .62 + .3 * swell, near);
    float path = exp(-abs(uv.x - sun.x) * mix(7., 2., smoothstep(0., .3, dz)));
    float glint = pow(vnoise(vec2(uv.x * z * 6., z * 4. - t * .6)), 5.);
    sea += vec3(1., .4, .15) * path * (.25 + 2.2 * glint) * mix(1., .55 + .45 * swell, near);
    float crest = smoothstep(.6, .78, fbm(vec2(uv.x * z * 1.6 + t * .05, z * 3. - t * .4))) * smoothstep(.75, 1., swell);
    sea += vec3(.2, .7, 1.) * .12 * crest * near;
    sea = mix(sea, col * .8, exp(-dz * 25.));
    col = sea;
  }

  // Far forested headland on the left, sitting on the horizon.
  float px = 1.5 / res.y;
  float hl = smoothstep(-.02, -.55, uv.x);
  float topL = horizon + .085 * hl + .02 * (fbm(vec2(uv.x * 3., 1.)) - .5) * hl + canopy(uv.x, 150., 1.) * .01 * step(.01, hl);
  float mL = smoothstep(px, -px, uv.y - topL) * step(horizon - .004, uv.y) * step(.01, hl);
  col = mix(col, vec3(.2, .07, .08) + vec3(1., .35, .12) * smoothstep(topL - .008, topL, uv.y) * .1, mL);
  // A second headland on the right, nearer than the first but still across the water,
  // rising gently toward the frame edge.
  float hr = smoothstep(.3, .95, uv.x);
  float topR = horizon + .12 * hr + .025 * (fbm(vec2(uv.x * 2.5, 5.)) - .5) * hr + canopy(uv.x, 70., 4.) * .022 * step(.01, hr);
  float mR = smoothstep(px, -px, uv.y - topR) * step(horizon - .004, uv.y) * step(.01, hr);
  vec3 landR = vec3(.07, .025, .04) + vec3(1., .35, .12) * smoothstep(topR - .01, topR, uv.y) * .12;
  col = mix(col, landR, mR);

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
