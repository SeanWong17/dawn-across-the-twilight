import { PRELUDE } from '../../lib/glsl';
import { FIGURE } from '../../lib/figure';

// The voyage across generations of body and mind. A thread of light runs left to right
// out of the shallow sea; along it stand, one after another, the forms that carried it:
// a frond of the Ediacaran sea, a fish, a great beast, the stargazer, the body of light,
// a probe under its sail, a mind, and the last traveller, a small ember. Countless beads
// of light between them are the generations in between. "pan" tracks the camera along
// the thread; each form lights up as it comes into view. "focus" = i + 1 isolates form i
// (zoomed by "zoom"), the thread fading away from it; "mem" (0..1) sends a pulse of light
// back along the thread from it toward the origin: remembering where it began.
export const LINEAGE = PRELUDE + FIGURE + `
uniform float expo;
uniform float pan;
uniform float focus;
uniform float zoom;
uniform float mem;

const float H = .24;            // height of a form
const float GAP = .5;           // spacing along the thread
const float X0 = -.8;           // first form

float threadY(float x) { return -.2 + .04 * sin(1.7 * x) + .02 * sin(4.1 * x + 1.); }

float ell(vec2 q, vec2 c, vec2 r) { return (length((q - c) / r) - 1.) * min(r.x, r.y); }
float box(vec2 q, vec2 c, vec2 b) { vec2 d = abs(q - c) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }

// Distance (in form units, height 1, base at 0) to form i.
float form(int i, vec2 q) {
  if (i == 0) {                 // Charnia frond on a short stalk
    float d = ell(q, vec2(0., .55), vec2(.14, .42));
    return min(d, sdSeg(q, vec2(0., 0.), vec2(0., .16), .02, .015));
  }
  if (i == 1) {                 // an early fish, heading right
    float d = ell(q, vec2(.02, .42), vec2(.3, .1));
    d = min(d, sdSeg(q, vec2(-.26, .42), vec2(-.44, .54), .03, .012));
    d = min(d, sdSeg(q, vec2(-.26, .42), vec2(-.44, .3), .03, .012));
    return min(d, sdSeg(q, vec2(-.02, .5), vec2(-.1, .6), .02, .006));
  }
  if (i == 2) {                 // a sauropod
    float d = ell(q, vec2(0., .45), vec2(.26, .14));
    d = smin(d, sdSeg(q, vec2(.16, .5), vec2(.42, .9), .065, .03), .04);
    d = min(d, length(q - vec2(.46, .92)) - .045);
    d = smin(d, sdSeg(q, vec2(-.2, .45), vec2(-.62, .28), .07, .008), .04);
    d = min(d, sdSeg(q, vec2(-.15, .38), vec2(-.17, 0.), .05, .04));
    d = min(d, sdSeg(q, vec2(-.07, .38), vec2(-.04, 0.), .05, .04));
    d = min(d, sdSeg(q, vec2(.1, .38), vec2(.13, 0.), .05, .04));
    return min(d, sdSeg(q, vec2(.17, .38), vec2(.2, 0.), .05, .04));
  }
  if (i == 3 || i == 4) return figure(vec2(-q.x, q.y), 1.);
  if (i == 5) {                 // probe beneath a square sail, rigged at the corners
    float d = abs(box(q, vec2(0., .62), vec2(.3, .3))) - .008;
    for (int k = 0; k < 2; k++) {
      vec2 c = vec2(k == 0 ? -.3 : .3, .32);
      d = min(d, sdSeg(q, c, vec2(0., .1), .004, .004));
    }
    return min(d, length(q - vec2(0., .08)) - .035);
  }
  if (i == 6) return length(q - vec2(0., .5)) - .38;
  return length(q - vec2(0., .5)) - .03;
}

vec3 formCol(int i) {
  if (i == 0) return vec3(.35, .95, .8);
  if (i == 1) return vec3(.45, .85, 1.);
  if (i == 2) return vec3(1., .66, .38);
  if (i == 3) return vec3(1., .82, .6);
  if (i == 4) return vec3(.4, .85, 1.);
  if (i == 5) return vec3(.78, .86, 1.);
  if (i == 6) return vec3(.6, .78, 1.);
  return vec3(1., .7, .38);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float z = max(zoom, 1.);
  float px = 1. / res.y / z;
  float YC = threadY(pan) + H * .5;
  vec2 w = vec2(pan, YC) + (uv - vec2(0., YC)) / z;
  float wx = w.x;
  float solo = step(.5, focus);
  float fF = X0 + GAP * max(focus - 1., 0.);

  // From the sea on the left into the dark of space on the right.
  float era = smoothstep(-1.2, 2.6, wx);
  vec3 col = mix(vec3(.004, .022, .028), vec3(.002, .002, .006), era);
  col += vec3(.02, .08, .09) * (1. - era) * smoothstep(.45, -.1, uv.y) * fbm(w * 3. + t * .05) * .6;
  col += starfield(w * .8 + 3., 70., .15, .5) * .45 * smoothstep(.2, 1.4, wx);

  // The thread, and the beads of the generations flowing along it.
  float ty = threadY(wx);
  float dy = (w.y - ty) / px;
  float beads = pow(.5 + .5 * sin(wx * 95. - t * 2.5), 24.) * (.5 + .5 * hash11(floor(wx * 95. / TAU - t * 2.5 / TAU) + 3.));
  vec3 tc = mix(vec3(.4, .95, .85), vec3(1., .72, .4), era);
  // Solo: the thread fades with distance from the form, toward a future (or a past) out of sight.
  float reachK = mix(1., exp(-abs(wx - fF) * 2.2), solo);
  col += tc * (exp(-dy * dy * .3) * (.12 + 1.1 * beads) + exp(-abs(dy) * .08) * .02) * reachK;
  // Memory: a pulse running back along the thread toward the origin, leaving it lit.
  if (mem > 0.) {
    float hx = fF - mem * 1.4;
    float lit = smoothstep(hx - .01, hx + .01, wx) * step(wx, fF);
    float head = exp(-pow((wx - hx) / .02, 2.));
    vec3 mc = vec3(1., .78, .5);
    col += mc * exp(-dy * dy * .2) * (lit * .35 + head * 2.2) * smoothstep(1., .85, mem);
    col += mc * exp(-length(vec2(wx - hx, w.y - ty)) / (px * 18.)) * head * .4 * smoothstep(1., .85, mem);
  }

  for (int i = 0; i < 8; i++) {
    float fx = X0 + GAP * float(i);
    if (abs(wx - fx) > .5) continue;
    float sx = fx - pan;        // screen x of this form
    float on = smoothstep(.95, .45, sx) * mix(1., step(abs(float(i) + 1. - focus), .5), solo);
    if (on <= 0.) continue;
    vec2 q = (w - vec2(fx, threadY(fx))) / H;
    q.y -= .02;
    float d = form(i, q);
    float dp = abs(d) * H / px;
    vec3 c = formCol(i);
    float line = exp(-dp * dp * .3) * 1.1 + exp(-dp * .12) * .06;
    float fill = smoothstep(.01, -.01, d) * .07;
    vec3 add = c * (line + fill);
    if (i == 0) {
      // Charnia's chevron ribs and midrib.
      float v = (q.y - .55) - abs(q.x) * .9;
      float rib = exp(-pow((fract(v * 11. - t * .05) - .5) / .09, 2.)) + exp(-abs(q.x) * H / px * .6);
      add += c * rib * smoothstep(.0, -.03, d) * .55;
    }
    if (i == 4) add += c * exp(-pow(fract(-d * 30. - t * .6) - .5, 2.) * 60.) * smoothstep(-.12, 0., d) * step(d, 0.) * .3;
    if (i == 6) {
      vec3 sp = vec3(q - vec2(0., .5), 0.) / .38;
      float fil = 1. - abs(vnoise3(sp * 5. + vec3(0., 0., t * .2)) * 2. - 1.);
      add += c * pow(fil, 10.) * step(d, 0.) * .6 + c * exp(-length(q - vec2(0., .5)) * 8.) * .25;
    }
    if (i == 7) {
      float r = length(q - vec2(0., .5));
      add += c * (exp(-r * r * 900.) * 2.5 + exp(-r * 12.) * .25 + exp(-abs(r - .14) * 260.) * .35 + exp(-abs(r - .24) * 300.) * .18);
    }
    // A flare as each form arrives.
    float flare = exp(-pow((sx - .7) / .12, 2.)) * .6 * (1. - solo);
    col += add * on * (1. + flare);
  }

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
