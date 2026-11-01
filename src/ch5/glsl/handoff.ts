import { PRELUDE } from '../../lib/glsl';

// A river of glyphs (language, knowledge: seal-like strokes drawn on a 3x3 node grid)
// flows from the warm left of frame into a mind on the right: a translucent sphere of
// filaments that brightens as it takes them in. A few open, unclosed marks drift with
// them, the questions still unanswered. "take" (0..1) is how much the mind has received.
export const HANDOFF = PRELUDE + `
uniform float expo;
uniform float take;

const vec2 MIND = vec2(.5, .04);
const float MR = .19;

float pathY(float x) { return .05 * sin(x * 2.2 + 1.3) - .06 * x + .035 * sin(x * 5.1 + t * .3); }

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.));
}

// One glyph in a unit cell centred on 0; returns distance to its strokes.
float glyph(vec2 f, vec2 id) {
  float d = 1e3;
  for (int k = 0; k < 7; k++) {
    float h = hash21(id * 1.37 + float(k) * 7.1);
    if (h > .72) continue;
    vec2 a = floor(hash22(id + float(k) * 3.3) * 3.) - 1.;
    float dir = floor(hash11(h * 91.) * 4.);
    vec2 o = dir < 1. ? vec2(1, 0) : dir < 2. ? vec2(0, 1) : dir < 3. ? vec2(1, 1) : vec2(1, -1);
    vec2 b = clamp(a + o, -1., 1.);
    if (a == b) b = clamp(a - o, -1., 1.);
    d = min(d, seg(f, a * .3, b * .3));
  }
  if (hash21(id + 5.) > .6) d = min(d, abs(length(f - vec2(.15, .15)) - .1));
  return d;
}

// Ridged 3D filaments for the mind.
float filaments(vec3 q) {
  float n = 1. - abs(vnoise3(q) * 2. - 1.);
  float m = 1. - abs(vnoise3(q * 2.1 + 4.) * 2. - 1.);
  return pow(n, 14.) + .5 * pow(m, 18.);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float px = 1. / res.y;

  // Warm human side on the left, cool deep field on the right.
  vec3 col = vec3(.004, .004, .008);
  col += vec3(.05, .024, .01) * smoothstep(.3, -1., uv.x) * pow(fbm(uv * 1.6 + vec2(t * .02, 0.)), 2.) * 1.6;
  col += vec3(.006, .012, .028) * smoothstep(-.2, .9, uv.x) * pow(fbm(uv * 2.3 - 3.), 2.) * 1.6;
  col += starfield(uv + vec2(t * .004, 0.), 70., .1, .6) * .5;

  // The river: lanes of glyphs following pathY, narrowing as they reach the mind.
  float width = mix(.2, .025, smoothstep(-.1, MIND.x - MR * .3, uv.x));
  float v = (uv.y - pathY(uv.x) - mix(0., MIND.y - pathY(MIND.x), smoothstep(-.3, MIND.x, uv.x))) / width;
  float inMind = length(uv - MIND) / MR;
  vec3 river = vec3(0.);
  const float CS = .042;      // glyph cell size before the river narrows
  if (abs(v) < 1.2) {
    float row = floor(v * .2 / CS + .5);
    // Each lane moves at its own speed.
    float speed = .1 + .05 * hash11(row + 2.);
    vec2 g = vec2((uv.x - t * speed) / CS, v * .2 / CS + .5);
    vec2 id = floor(g), f = fract(g) - .5;
    float h = hash21(id + 17.);
    float squash = width / .2;   // vertical compression of the cell on screen
    float cpx = CS * squash;     // shortest cell side on screen
    if (h < .55) {
      float d = h < .05 ? 1e3 : glyph(f, id) * cpx;
      float stroke = smoothstep(.0009 + px, .0009, d) * .5 + smoothstep(.0003 + px, .0003, d) * .5;
      float glow = exp(-d / px * .3);
      vec3 ink = mix(vec3(1., .62, .3), vec3(.75, .88, 1.), smoothstep(-.2, MIND.x, uv.x));
      float life = smoothstep(1.15, .7, abs(v)) * smoothstep(.95, 1.3, inMind) * smoothstep(-.98, -.7, uv.x) * step(uv.x, MIND.x);
      river += ink * (stroke + glow * .1) * life * (.55 + .45 * sin(h * 40. + t * 2.));
      // The unanswered questions: rare open rings, pale and slowly pulsing.
      if (h < .05) {
        float ring = abs(length(f) - .28) * cpx;
        float gap = smoothstep(.1, .5, fract(atan(f.y, f.x) / TAU + h * 7.));
        river += vec3(.85, .9, 1.) * exp(-ring / px * .5) * gap * life * (.6 + .4 * sin(t * 1.7 + h * 99.)) * 1.2;
      }
    }
  }
  col += river * (.6 + .4 * smoothstep(0., .2, take + .1));

  // Faint carrier current under the glyphs.
  float cv = abs(uv.y - pathY(uv.x) - mix(0., MIND.y - pathY(MIND.x), smoothstep(-.3, MIND.x, uv.x)));
  col += vec3(.9, .6, .35) * exp(-cv / width * 3.) * .025 * smoothstep(MIND.x - MR, -.5, uv.x);

  // The mind: a translucent shell of filaments, front and back surfaces, slowly turning.
  vec2 q = (uv - MIND) / MR;
  float r2 = dot(q, q);
  float lum = .25 + 1.6 * take;
  if (r2 < 1.) {
    float z = sqrt(1. - r2);
    float rot = t * .12;
    mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    vec3 pf = vec3(q, -z), pb = vec3(q, z);
    pf.xz = R * pf.xz; pb.xz = R * pb.xz;
    float ff = filaments(pf * 3.2 + 1.), fb = filaments(pb * 3.2 + 1.);
    float fresnel = pow(1. - z, 2.5);
    vec3 cool = vec3(.55, .78, 1.);
    col += cool * (ff * 1.2 + fb * .45) * lum * .55;
    col += cool * fresnel * .18 * lum;
    // Inner shells.
    for (int k = 1; k < 3; k++) {
      float s = 1. - float(k) * .3;
      float rr = r2 / (s * s);
      if (rr < 1.) {
        vec3 pk = vec3(q / s, -sqrt(1. - rr));
        pk.xz = R * R * pk.xz;
        col += cool * filaments(pk * (3.2 + float(k)) + float(k) * 9.) * lum * .35 * float(k) * .6;
      }
    }
    // Where the glyphs enter, the shell flares warm.
    float entry = exp(-pow((atan(q.y, q.x) - PI) * 2.2, 2.)) * exp(-pow((length(q) - .95) * 8., 2.));
    col += vec3(1., .75, .5) * entry * (.2 + .6 * take) * .25;
  }
  // Core glow, growing as it takes more in.
  float dm = length(uv - MIND);
  col += vec3(.6, .8, 1.) * (exp(-dm * 22.) * .25 + exp(-dm * 5.) * .06) * lum;
  col += vec3(.9, .95, 1.) * exp(-dm * 120.) * .4 * lum;

  outColor = finish(col * 1.2 * expo, gl_FragCoord.xy);
}`;
