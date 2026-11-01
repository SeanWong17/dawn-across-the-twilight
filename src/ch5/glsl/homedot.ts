import { PRELUDE } from '../../lib/glsl';

// Looking back from very far away: the Earth is a single pale blue point inside a band
// of scattered sunlight, as in Voyager's "Pale Blue Dot". Sensor grain, soft streaks of
// stray light across the frame, a slow push toward the point. "push" goes 0..1.
export const HOMEDOT = PRELUDE + `
uniform float expo;
uniform float push;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 dot0 = vec2(.12, -.06);
  float z = 1. + push * .35;
  vec2 p = (uv - dot0) / z + dot0;

  vec3 col = vec3(.004, .004, .006);
  // Stray sunlight from out of frame (upper left), scattered into slanted bands.
  vec2 dir = normalize(vec2(.96, -.28));
  float across = dot(p, vec2(-dir.y, dir.x));
  float along = dot(p, dir);
  float bands = 0.;
  vec3 tint = vec3(0.);
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float c = -.32 + fk * .2 + .03 * sin(fk * 2.7);
    float w = .035 + .03 * hash11(fk + 3.);
    float b = exp(-pow((across - c) / w, 2.)) * (.5 + .5 * fbm(vec2(along * 3., fk * 7.)));
    vec3 hue = k == 0 ? vec3(.95, .55, .3) : k == 1 ? vec3(.6, .45, .55) : k == 2 ? vec3(.85, .6, .45) : vec3(.4, .5, .7);
    tint += hue * b * (.6 + .4 * hash11(fk * 5.));
  }
  // The bands brighten toward the hidden Sun.
  float sunward = smoothstep(.9, -.9, along);
  col += tint * .09 * (.4 + sunward);
  col += vec3(.06, .04, .03) * exp(-length(p - vec2(-1.1, .55)) * 1.6);
  // A few faint stars.
  col += starfield(p * .9 + 3., 50., .04, .3) * .18;

  // The pale blue dot, sitting inside one band.
  float d = length(p - dot0) * res.y / z;
  float tw = 1. + .25 * sin(t * 1.3) * sin(t * 2.9);
  col += vec3(.55, .7, 1.) * (exp(-d * d * .35) * 1.3 + exp(-d * .25) * .06) * tw;

  // Sensor grain and faint row noise.
  float row = hash11(floor(gl_FragCoord.y) + floor(t * 12.) * 37.);
  col += vec3(.003) * (row - .5);
  col += vec3(.012) * (hash21(gl_FragCoord.xy + floor(t * 24.)) - .5);

  outColor = finish(col * 1.3 * expo, gl_FragCoord.xy);
}`;
