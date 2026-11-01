import { PRELUDE } from '../../lib/glsl';

// Forests cloaking a continent: an aerial view of ridgelines receding into morning mist,
// each ridge crowned with a dense, fractal canopy edge. "grow" sweeps across the frame;
// ahead of it the ridges are bare stone. "wither" (0..1, chapter 2) browns and thins the
// canopy under a harsher, whiter sun. "launch" (seconds, chapter 4; 0 = off) sends a
// craft climbing from beyond the far ridges on a thin bright trail.
export const FOREST = PRELUDE + `
uniform float expo;
uniform float grow;
uniform float wither;
uniform float launch;

float ridgeLine(float x, float seed, float amp) {
  float r = fbm(vec2(x * .9 + seed, seed * 1.7)) - .5;
  r += .35 * (fbm(vec2(x * 3. + seed * 2., seed)) - .5);
  return amp * r;
}

// Canopy roughness on top of a ridge: many small crowns at several scales.
float crowns(float x, float scale, float seed) {
  float c = 0.;
  c += .55 * vnoise(vec2(x * scale, seed));
  c += .3 * vnoise(vec2(x * scale * 2.7, seed + 3.));
  c += .15 * vnoise(vec2(x * scale * 7.1, seed + 9.));
  // Individual conifer tips poking above.
  float f = fract(x * scale * 1.6 + seed) - .5;
  float tip = max(0., 1. - abs(f) * 4.) * step(.55, hash11(floor(x * scale * 1.6 + seed)));
  return c + .5 * tip;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float aspect = res.x / res.y;
  float cx = t * .01;

  vec2 sun = vec2(.42, .2);
  float sd = length(uv - sun);
  vec3 sky = mix(vec3(.72, .52, .34), vec3(.13, .2, .3), smoothstep(-.05, .5, uv.y));
  sky = mix(sky, mix(vec3(.95, .8, .6), vec3(.6, .55, .5), smoothstep(-.05, .5, uv.y)), wither);
  sky += vec3(1., .8, .55) * (exp(-sd * 6.) * .6 + exp(-sd * 40.) * 1.2) * (1. + wither * 1.5);
  vec3 col = sky;
  if (launch > 0.) {
    // Ascent curve leaning right; the trail behind the craft widens and fades with age.
    float lt = launch;
    float x0 = -.28;
    float yT = -.02 + .09 * lt * lt;
    float yy = clamp(uv.y, -.02, yT);
    float age = yT - yy;
    float xc = x0 + .06 * pow(max(yy + .02, 0.), 1.5) * 3. + .004 * (fbm(vec2(yy * 20., 1.)) - .5) * age * 30.;
    float w = .0015 + age * .03;
    float tr = exp(-pow((uv.x - xc) / w, 2.)) * step(-.02, uv.y) * step(uv.y, yT);
    col = mix(col, vec3(.95, .9, .85), tr * .55 * exp(-age * 2.));
    vec2 cr = vec2(x0 + .06 * pow(yT + .02, 1.5) * 3., yT);
    float dc = length(uv - cr);
    col += vec3(1., .85, .6) * (exp(-dc * 900.) * 2. + exp(-dc * 60.) * .25);
  }

  float front = mix(-.5 * aspect - .3, .5 * aspect + .4, grow);

  // Eight ridges, back to front. Aerial perspective brightens and warms the far ones.
  for (int L = 7; L >= 0; L--) {
    float fl = float(L);
    float depth = fl / 7.;
    float x = uv.x * (.5 + depth * .9) + cx * (1. - depth * .8) + fl * 5.3;
    float base = mix(-.3, .06, pow(depth, .7)) + ridgeLine(x, fl * 13.1, mix(.32, .08, depth));
    float g = smoothstep(front + .05, front - .3, uv.x + .15 * vnoise(vec2(x * 2., fl)));
    float scale = mix(28., 140., depth);
    float can = crowns(x, scale, fl) * mix(.07, .012, depth) * g * (1. - .75 * wither);
    float top = base + can;
    float px = 1.5 / res.y;
    float m = smoothstep(px, -px, uv.y - top);
    if (m <= 0.) continue;

    vec3 hazeCol = mix(vec3(.78, .6, .42), vec3(.5, .55, .6), smoothstep(-.1, .3, uv.y)) * .85;
    hazeCol = mix(hazeCol, vec3(.85, .7, .5), wither * .8);
    vec3 rock = vec3(.12, .1, .09) * (.7 + .4 * fbm(vec2(x * 9., uv.y * 30.)));
    // Canopy: dark green, lit along the upper edge toward the sun.
    float lit = smoothstep(top - .03, top, uv.y);
    float side = smoothstep(.8, -.2, abs(uv.x - sun.x));
    vec3 leaf = vec3(.03, .07, .035) * (.7 + .6 * fbm(vec2(x * scale * .5, uv.y * 80.)));
    leaf += vec3(.5, .42, .2) * lit * (.25 + .5 * side) * .5;
    // Dying canopy: green to rust to grey snags, patchy across the ridge.
    float die = smoothstep(.0, .6, wither + .35 * (vnoise(vec2(x * 6., fl * 2.)) - .5));
    leaf = mix(leaf, mix(vec3(.22, .12, .05), vec3(.16, .14, .12), smoothstep(.5, 1., wither)) * (.8 + .5 * lit), die);
    vec3 c = mix(rock, leaf, g);
    float haze = (1. - exp(-depth * 1.7)) * .8;
    c = mix(c, hazeCol, haze);
    // Mist pooled below each ridge crest.
    float mist = smoothstep(.0, -.12, uv.y - base) * (.4 + .5 * fbm(vec2(x * 1.5 + t * .02, fl * 3.)));
    c = mix(c, hazeCol * 1.05, mist * mix(.35, .25, depth));
    col = mix(col, c, m);
  }

  // Shafts of light slanting down through the mist.
  vec2 dv = uv - sun;
  float a = atan(dv.y, dv.x);
  float r = pow(vnoise(vec2(a * 16., t * .04)), 5.) * smoothstep(.1, .7, length(dv)) * step(uv.y, sun.y);
  col += vec3(1., .78, .5) * r * .1;

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
