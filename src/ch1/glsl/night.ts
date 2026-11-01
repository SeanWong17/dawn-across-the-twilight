import { PRELUDE } from '../../lib/glsl';
import { FIGURE } from '../../lib/figure';

// A person on a ridge under the Milky Way. "tilt" (0..1) pans the camera up off the
// figure into the galaxy for the closing question; "push" slowly zooms into the core.
// Chapter 5 recalls the scene ("memory" = 1): the arm is already raised, and with "gone"
// (0..1) the person dissolves into motes while the line of their question stays behind.
export const NIGHT = PRELUDE + `
uniform float expo;
uniform float tilt;
uniform float push;
uniform float memory;
uniform float gone;

vec3 milkyway(vec2 p) {
  // Band rotated across the sky.
  float a = -.55;
  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 q = R * p;
  float w = .16 + .05 * fbm(vec2(q.x * 2., 3.));
  float band = exp(-pow(q.y / w, 2.));
  float core = exp(-pow((q.x - .25) / .5, 2.)) ;
  float n = fbm(q * 6. + 2.);
  float n2 = fbm(q * 18. + 7.);
  vec3 glow = mix(vec3(.25, .3, .5), vec3(.95, .75, .55), core) * band * (.35 + .9 * n) * (.6 + .6 * core);
  // Dust lanes.
  float lane = smoothstep(.45, .7, fbm(q * vec2(4., 14.) + 11.)) * exp(-pow(q.y / (w * .45), 2.));
  glow *= 1. - .85 * lane;
  glow += vec3(.6, .25, .35) * smoothstep(.72, .9, n2) * band * .25;
  return glow * .55;
}

${FIGURE}
float ridgeY(float x) {
  return -.3 + .1 * fbm(vec2(x * 1.6 + 3., 1.)) + .06 * exp(-pow((x - .32) * 3.5, 2.));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float tl = smoothstep(0., 1., tilt);
  vec2 sky = uv / (1. + push * .35) + vec2(0., tl * .9);

  vec3 col = vec3(.004, .006, .014) + vec3(.02, .03, .06) * smoothstep(.3, -.4, sky.y);
  col += milkyway(sky - vec2(.1, .25));
  float rot = t * .004;
  mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
  vec2 sp = R * sky;
  col += starfield(sp, 55., .14, .8) * 1.1;
  col += starfield(sp * 1.9 + 4.2, 130., .3, 1.) * .45;
  // Airglow near the horizon.
  col += vec3(.05, .12, .08) * exp(-max(sky.y + .2, 0.) * 9.) * .5;

  // Ridge and figure, dropping out of frame as the camera tilts up. The figure stands
  // on the crest, feet slightly sunk into the ground line.
  float gy = uv.y + tl * 1.2;  // ground parallaxes out faster than the sky
  float ridge = ridgeY(uv.x);
  float hill = smoothstep(.0015, -.0015, gy - ridge);
  col = mix(col, vec3(.006, .007, .012), hill);
  const float FX = .32, FH = .27;
  vec2 fp = (vec2(uv.x, gy) - vec2(FX, ridgeY(FX) - .004)) / FH;
  float fd = figure(fp, memory > .5 ? 1. : smoothstep(.4, 2.6, t)) * FH;
  float f = smoothstep(.0012, -.0004, fd);
  float burn = 0.;
  if (memory > .5) {
    // Dissolve from the feet up, with a ragged glowing front.
    float th = gone * 1.5 - .25 + .25 * fbm(fp * 14.) - fp.y * .3;
    float keep = smoothstep(-.03, .03, fbm(fp * 9. + 3.) - th);
    burn = f * exp(-abs(fbm(fp * 9. + 3.) - th) * 40.) * step(.001, gone) * (1. - smoothstep(.85, 1., gone));
    f *= keep;
  }
  // Faint cool rim from the galaxy on the upper-left edges.
  float rim = smoothstep(-.0025, -.0004, fd) * f * smoothstep(.3, .9, fp.y) * .5;
  col = mix(col, vec3(.004, .004, .008), f);
  col += vec3(.12, .14, .22) * rim * .35;
  if (memory > .5) {
    col += vec3(.55, .7, 1.) * burn * .9;
    // Motes lifting off the dissolving figure and drifting up toward the galaxy.
    vec2 base = vec2(FX, ridgeY(FX) + FH * .5);
    for (int i = 0; i < 40; i++) {
      float fi = float(i);
      float born = hash11(fi * 1.3) * .9;
      float age = gone - born;
      if (age <= 0.) continue;
      vec2 o = vec2(hash11(fi * 2.7) - .5, hash11(fi * 4.1)) * vec2(.06, FH);
      vec2 mp = base + o - vec2(0., FH * .5) + vec2(-.18, .45) * age * (.6 + .6 * hash11(fi * 7.)) + .01 * vec2(sin(t + fi), cos(t * .8 + fi));
      float dm = length(uv - mp) * res.y;
      col += vec3(.6, .75, 1.) * exp(-dm * .7) * exp(-age * 2.5) * .7;
    }
    // The question: a fine line of light rising from the fingertip, left behind.
    vec2 tip = vec2(FX, ridgeY(FX) - .004) + FH * vec2(-.209, 1.018);
    vec2 dir = normalize(vec2(-.53, .848));
    float along = dot(uv - tip, dir);
    float len = .05 + .55 * smoothstep(.05, .8, gone);
    float across = abs(dot(uv - tip, vec2(-dir.y, dir.x)) - .004 * sin(along * 30. - t * 2.) * along);
    float ln = exp(-across * res.y * .8) * smoothstep(0., .01, along) * smoothstep(len, len * .4, along);
    col += vec3(.95, .9, .8) * ln * (.25 + .35 * smoothstep(.2, .6, gone));
  }

  outColor = finish(col * 1.25 * expo, gl_FragCoord.xy);
}`;
