import { PRELUDE } from '../../lib/glsl';

// A network of bodies (nodes) linked by light. At "fail" one node near the centre
// flares, cracks and goes dark, its fragments drifting away; just before, a bright packet
// of its memory runs outward along every link, and the neighbours light up with it.
export const MEMORY = PRELUDE + `
uniform float expo;
uniform float fail;   // seconds since the start of the failure (negative = before)

const vec2 DEAD = vec2(0., 0.);   // cell of the failing node

vec2 nodePos(vec2 id) {
  if (id == DEAD) return vec2(.08, .02);
  return id + .5 + (hash22(id) - .5) * .7 + .06 * vec2(sin(t * .3 + id.x * 2.), cos(t * .25 + id.y * 3.));
}

float segD(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float S = 4.2;
  vec2 p = uv * S + vec2(.5 + .05 * t, .5 + .02 * t);
  float ppx = S / res.y;

  vec3 col = vec3(.002, .003, .007) + vec3(.02, .03, .06) * fbm(uv * 2. + 3.);
  col += starfield(uv + 2., 90., .12, .5) * .4;

  vec2 id = floor(p);
  float packet = fail;                      // time since packets left the dying node
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 a = id + vec2(x, y);
    vec2 pa = nodePos(a);
    bool aDead = a == DEAD;
    // Links to the right, up and diagonal neighbours (each link drawn once).
    for (int k = 0; k < 3; k++) {
      vec2 o = k == 0 ? vec2(1, 0) : k == 1 ? vec2(0, 1) : vec2(1, 1);
      vec2 b = a + o;
      if (k == 2 && hash21(a * 3.1) < .5) continue;
      bool bDead = b == DEAD;
      vec2 pb = nodePos(b);
      float h;
      float d = segD(p, pa, pb, h) / ppx;
      float lineW = exp(-d * .9) * .25 + exp(-d * .15) * .015;
      // Links to the failing node dim to nothing once it dies.
      float alive = (aDead || bDead) ? 1. - smoothstep(.6, 1.6, fail) : 1.;
      // Ordinary traffic.
      float flow = pow(.5 + .5 * sin(h * 12. - t * 3. + hash21(a + o * 7.) * 20.), 20.);
      col += vec3(.2, .5, 1.) * lineW * (.6 + 2. * flow) * alive;
      // The memory packet: from the dying node outward along its links.
      if ((aDead || bDead) && fail > -.2) {
        float pos = aDead ? h : 1. - h;
        float head = clamp((fail + .2) / .7, 0., 1.);
        float pk = exp(-abs(pos - head) * 30.) * step(head, .999) + smoothstep(.0, .2, pos - .02) * step(pos, head) * .3;
        col += vec3(.7, .9, 1.) * exp(-d * .5) * pk * 2.5 * alive;
      }
    }
    // The node itself.
    float dn = length(p - pa) / ppx;
    float rcv = 0.;
    if (!aDead && length(a - DEAD) < 1.6) rcv = exp(-max(fail - .5, 0.) * 1.2) * step(.5, fail);
    vec3 nc = vec3(.6, .85, 1.) * (exp(-dn * .35) * 1.4 + exp(-dn * .06) * .08) * (1. + 3. * rcv);
    if (aDead) {
      // Flare, then shatter: fragments fly outward and fade.
      float fl = exp(-pow((fail - .1) * 4., 2.)) * 6.;
      float lifeA = 1. - smoothstep(.0, .35, fail);
      nc = vec3(.6, .85, 1.) * (exp(-dn * .35) * 1.4 + exp(-dn * .06) * .08) * lifeA + vec3(1., .9, .8) * exp(-dn * .08) * fl * .2;
      if (fail > 0.) {
        for (int j = 0; j < 9; j++) {
          float fj = float(j);
          float ang = fj * 2.4 + hash11(fj) * .8;
          vec2 fpos = pa + vec2(cos(ang), sin(ang)) * (.04 + fail * (.1 + .08 * hash11(fj * 3.))) * (1. - exp(-fail * 2.)) * 3.;
          float dfr = length(p - fpos) / ppx;
          nc += vec3(1., .55, .3) * exp(-dfr * .9) * exp(-fail * .9) * .8;
        }
      }
    }
    col += nc;
  }
  // Shockwave ring from the failure.
  float rr = length(p - nodePos(DEAD)) - fail * .9;
  col += vec3(.5, .7, 1.) * exp(-abs(rr) / ppx * .25) * exp(-fail * 1.4) * step(0., fail) * .5;

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
