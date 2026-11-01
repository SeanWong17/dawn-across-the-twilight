import { PRELUDE } from '../../lib/glsl';
import { FIGURE } from '../../lib/figure';

// The stargazer again, arm still raised to the sky. "morph" (0..1) sweeps a scan line up
// the body; below it the flesh silhouette becomes a body of light: glowing contour lines
// of the figure's distance field over a fine lattice of nodes.
// Chapter 6 adds "age" (0..1; 0 = chapter 4 look): the sky wheels on as ages pass, the
// lattice nodes go out one by one and the body of light frays and dims from the edges.
export const VESSELS = PRELUDE + FIGURE + `
uniform float expo;
uniform float morph;
uniform float age;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float wh = age * age * 1.4;
  vec2 sky = mat2(cos(wh), -sin(wh), sin(wh), cos(wh)) * (uv * .9 + vec2(.05, .2) - vec2(.2, .45)) + vec2(.2, .45);
  vec3 col = vec3(.003, .005, .012) + vec3(.015, .03, .05) * smoothstep(.3, -.5, uv.y);
  col += starfield(sky + vec2(t * .002, 0.), 60., .14, .8) * 1.;
  col += starfield(sky * 1.8 + 3.1, 140., .3, 1.) * .4;
  col += vec3(.04, .08, .12) * exp(-pow((uv.y + .35 - .2 * uv.x) / .18, 2.)) * fbm(uv * 3. + 2.) * .6;

  // Low ridge across the bottom of frame.
  float ridge = -.38 + .04 * fbm(vec2(uv.x * 1.5 + 2., 4.));
  col = mix(col, vec3(.004, .005, .01), smoothstep(.0015, -.0015, uv.y - ridge));

  const float FH = .6;
  vec2 base = vec2(.02, -.38 + .04 * fbm(vec2(.02 * 1.5 + 2., 4.)) - .004);
  vec2 fp = (uv - base) / FH;
  float fd = figure(fp, 1.) * FH;
  // Fraying: noise eats in from the outline, more with age.
  float fray = age * (.004 + .03 * age) * (fbm(fp * 18. + vec2(0., t * .1)) * 1.4 - .2);
  fd += fray;
  float inside = smoothstep(.0012, -.0004, fd);

  // Scan front rising from the feet to above the raised hand.
  float front = mix(-.05, 1.25, morph);
  float wave = fp.y - front + .015 * sin(fp.x * 40. + t * 3.);
  float below = smoothstep(.01, -.01, wave);

  // Flesh: an unlit silhouette with a faint rim.
  float rim = smoothstep(-.003, -.0005, fd) * inside;
  vec3 flesh = vec3(.004, .004, .008) + vec3(.1, .12, .2) * rim * .25;

  // Light: contour bands inside the body, a bright outline and a lattice of nodes.
  float bands = exp(-pow(fract(-fd * 140. - t * .6) - .5, 2.) * 60.) * smoothstep(-.06, 0., fd);
  float edge = exp(-abs(fd) * 900.) + exp(-abs(fd) * 120.) * .25;
  vec2 g = fp * 46.;
  vec2 gi = floor(g), gf = fract(g) - .5;
  float node = exp(-dot(gf, gf) * 90.) * step(.55, hash21(gi)) * step(age * 1.15, hash21(gi + 3.7));
  float blink = .5 + .5 * sin(t * 4. + hash21(gi) * 40.);
  vec3 light = vec3(.25, .75, 1.) * (bands * .35 + node * blink * .6) * inside + vec3(.5, .9, 1.) * edge * .9;
  light += vec3(.1, .3, .5) * inside * .15;
  // With age the light flickers and fades, the outline last of all.
  float flick = 1. - age * .35 * (.5 + .5 * sin(t * 13. + fp.y * 9.)) * step(.6, vnoise(vec2(t * 5., 1.)));
  light *= mix(1., .22, age * age) * flick;

  col = mix(col, flesh, inside * (1. - below));
  col = mix(col, vec3(.004, .006, .012), inside * below);
  col += light * below;
  // The scan line itself, only across the body and a short way beyond it.
  float scan = exp(-abs(wave) * 300.) * smoothstep(.04, -.02, fd) * step(.02, morph) * step(morph, .985);
  col += vec3(.6, .95, 1.) * scan * 1.2;
  // Rising motes shed from the transformed body.
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float ph = fract(t * .18 + hash11(fi * 7.1));
    vec2 m = base + FH * vec2((hash11(fi * 3.3) - .5) * .5, ph * front * 1.1);
    m.x += .02 * sin(t + fi);
    col += vec3(.4, .85, 1.) * exp(-length(uv - m) * 900.) * (1. - ph) * below * morph * 2. * (1. - age * .8);
  }

  outColor = finish(col * 1.3 * expo, gl_FragCoord.xy);
}`;
