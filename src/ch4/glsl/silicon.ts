import { PRELUDE } from '../../lib/glsl';

// Macro view across a silicon die. Manhattan traces on a cell grid; "grow" spreads a
// branching front of light out from the centre along the traces, the way a thought
// spreads, while pulses run along the lit wires. A dull metal sheen.
// Chapter 6 adds "decay" (0..1; 0 = chapter 4 look): corrosion blooms across the die,
// a crack opens through it, and the wires it reaches flicker and go dark.
export const SILICON = PRELUDE + `
uniform float expo;
uniform float grow;
uniform float decay;

// Distance-like value from the trace network inside one grid cell. Each cell carries a
// horizontal and/or vertical wire through its centre and sometimes a via.
vec3 traces(vec2 p, float scale, float seed) {
  vec2 g = p * scale;
  vec2 id = floor(g), f = fract(g) - .5;
  float h = hash21(id + seed);
  float wire = 1e3;
  if (h < .55) wire = min(wire, abs(f.y));
  if (h > .35) wire = min(wire, abs(f.x));
  // Wires only run part-way across some cells, ending in a via.
    float d = h > .93 ? length(f) - .09 : wire;
  return vec3(d / scale, h, hash21(id * 1.7 + seed + 4.));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  // Slight perspective: the die recedes toward the top of frame.
  float persp = 1. + uv.y * .45;
  vec2 p = vec2(uv.x / persp, uv.y / persp * 1.25) + vec2(t * .006, t * .004);
  float px = 1.6 / res.y;

  vec3 base = vec3(.015, .018, .028) + vec3(.012, .01, .025) * fbm(p * 8.);
  base += vec3(.01, .015, .03) * fbm(p * 2.);
  vec3 col = base;

  float r = length(p - vec2(.02, .0));
  float front = grow * 1.25;
  vec3 light = vec3(0.);
  float metalTot = 0.;
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float sc = 26. * pow(2.4, fl);
    vec3 tr = traces(p + fl * .37, sc, fl * 11.);
    float w = .07 / sc;
    float m = smoothstep(w + px, w - px, tr.x);
    metalTot = max(metalTot, m * (1. - fl * .25));
    // Light reaches this cell once the front passes, with irregular lag per cell.
    float lag = tr.z * .18 + .1 * fbm(p * 6.);
    float on = smoothstep(0., .04, front - r - lag) * step(tr.z, .3);
    // Pulses running along the wire.
    float pulse = pow(.5 + .5 * sin((p.x + p.y) * sc * 1.3 - t * (4. + tr.y * 5.) + tr.z * 30.), 12.);
    vec3 hue = mix(vec3(.25, .7, 1.), vec3(1., .75, .4), step(.8, tr.z));
    light += hue * m * on * (.12 + 1.8 * pulse) * (1. - fl * .3);
    // The front itself flares as it arrives.
    light += hue * m * exp(-abs(front - r - lag) * 40.) * .8 * step(tr.z, .7);
    // Halo around lit wires.
    light += hue * exp(-tr.x * sc * 5.) * on * (.03 + .12 * pulse);
  }
  vec3 metal = vec3(.32, .3, .3) * (.5 + .7 * fbm(p * 30.)) + vec3(.5, .45, .4) * pow(max(0., 1. - abs(uv.y - .25 + uv.x * .2) * 2.5), 3.);
  // Corrosion: patches spreading from a few pits, and a crack across the die.
  float cn = fbm(p * 5. + 7.) + .35 * fbm(p * 22.);
  float rot = decay * smoothstep(1.25 - decay * .95, 1.3 - decay * .9, cn + .25 * decay);
  float crackL = abs(uv.y - .06 - .18 * uv.x - .05 * fbm(vec2(uv.x * 4., 2.)) + .02 * fbm(uv * 30.));
  float reach = step(.05, decay) * smoothstep(-.9, -.9 + decay * 2.4, uv.x);
  float crack = smoothstep(.003 + .005 * decay, 0., crackL) * reach;
  float dead = max(rot, smoothstep(.04 * decay + .002, 0., crackL) * reach);
  float flick = 1. - decay * step(.55, vnoise(vec2(t * 7., floor(p.x * 8.) + floor(p.y * 8.) * 9.)));
  light *= (1. - dead) * mix(1., flick, smoothstep(0., .3, decay)) * (1. - .55 * decay);
  col = mix(col, metal * .18, metalTot * .8);
  vec3 oxide = mix(vec3(.05, .025, .012), vec3(.16, .07, .025), fbm(p * 40.)) * (.5 + .8 * fbm(p * 9.));
  oxide += vec3(.08, .1, .07) * smoothstep(.6, .8, fbm(p * 16. + 3.)) * .5;
  col = mix(col, oxide, rot * .95);
  col = mix(col, vec3(0.), crack);
  col += light;
  // Shallow depth of field: soften toward the top.
  col *= 1. - .35 * smoothstep(.15, .45, uv.y);

  outColor = finish(col * 1.15 * expo, gl_FragCoord.xy);
}`;
