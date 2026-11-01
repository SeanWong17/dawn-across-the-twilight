import { PRELUDE } from '../../lib/glsl';

// Deep space behind the cosmic timeline: sparse stars and faint dust. "zoom" streams
// the stars outward as the timescale explodes.
export const VOID = PRELUDE + `
uniform float expo;
uniform float zoom;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec3 col = vec3(.003, .004, .008);
  col += vec3(.03, .035, .06) * fbm(uv * 1.5 + 4.) * fbm(uv * 4. - 2.);
  // Several copies at slightly different scales smear into radial streaks while zooming.
  for (int i = 0; i < 4; i++) {
    float k = 1. + zoom * (.03 + .025 * float(i));
    col += starfield(uv / k + vec2(t * .001, 0.), 70., .12, .5) * (i == 0 ? .8 : .15 * zoom);
  }
  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
