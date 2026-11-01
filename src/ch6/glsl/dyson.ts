import { PRELUDE } from '../../lib/glsl';

// What thought runs on: a star wrapped in a swarm of collectors. Several tilted orbital
// rings of panels circle the star; each panel is dark on its back and catches the light
// on its face, and those in front occult the disc. Thin threads of power run from the
// rings out to a lattice of compute nodes in the foreground. "wrap" (0..1) fills in the
// swarm; "pull" slowly widens the view.
export const DYSON = PRELUDE + `
uniform float expo;
uniform float wrap;
uniform float pull;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  uv *= 1. + .25 * pull;
  vec2 S = vec2(-.12, .03);
  float SR = .085;
  vec2 p = uv - S;
  float r = length(p);
  float px = 1. / res.y;

  vec3 col = vec3(.002, .002, .004) + starfield(uv * .9 + 2., 80., .18, .4) * .4;
  // The star: limb-darkened disc, granulation, corona.
  float mu = sqrt(max(0., 1. - r * r / (SR * SR)));
  float gran = .85 + .3 * fbm(p / SR * 6. + t * .05);
  vec3 star = vec3(1., .88, .66) * (.35 + .65 * pow(mu, .6)) * gran * 3.2 * step(r, SR);
  vec3 glow = vec3(1., .7, .4) * (exp(-(r - SR) / .03) * .6 + exp(-r / .22) * .25) * step(SR, r);
  col += star + glow;

  // Rings of collectors: inclined ellipses around the star.
  vec3 sw = vec3(0.);
  float occl = 0.;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float rad = SR * (1.45 + .32 * fk);
    float inc = .16 + .5 * hash11(fk * 3.7);
    float rot = (hash11(fk * 9.1) - .5) * 1.8;
    // Each ring fills in over wrap, inner rings first.
    float shown = smoothstep(fk / 7., fk / 7. + .2, wrap);
    if (shown <= 0.) continue;
    vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
    // Nearest point on the ring by angle.
    float a = atan(q.y / inc, q.x);
    vec2 e = vec2(cos(a), sin(a) * inc) * rad;
    float d = length(q - e);
    float front = step(0., -sin(a)); // lower half is nearer to us
    // Panels: segments along the ring with gaps.
    float n = 90. + 30. * fk;
    float ca = a - t * (.06 / (1. + fk * .4)) * (mod(fk, 2.) * 2. - 1.);
    float cell = fract(ca / TAU * n);
    float panel = step(.18, cell) * step(cell, .82) * step(hash21(vec2(floor(ca / TAU * n), fk)), shown);
    float w = (.0028 + .0012 * fk) * (.5 + .5 * abs(cos(a)) + .25);
    float on = smoothstep(w, w - px * 1.2, d) * panel;
    // Face toward the star lit, otherwise dark; edge-on glints.
    float lit = .2 + .8 * pow(abs(sin(ca * 7. + fk)), 4.);
    vec3 pc = mix(vec3(.05, .045, .05), vec3(1., .78, .5) * 1.6, lit * (1. - front * .55));
    sw = mix(sw, pc, on);
    occl = max(occl, on * front * step(r, SR * 1.2));
    // The ring plane glows faintly with reflected light.
    sw += vec3(1., .7, .4) * exp(-d / .004) * .04 * shown;
  }
  col = col * (1. - occl * .92) + sw;

  // Power threads from the swarm to compute nodes in the foreground at right.
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 node = vec2(.38 + .32 * hash11(fi * 2.1), -.32 + .55 * hash11(fi * 5.3)) * (1. + .1 * pull);
    vec2 src = S + SR * 2.6 * normalize(node - S + vec2(0., .2 * (hash11(fi) - .5)));
    vec2 ba = node - src, pa = uv - src;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    float bow = .04 * sin(h * PI) * (hash11(fi * 8.) - .5);
    vec2 nrm = normalize(vec2(-ba.y, ba.x));
    float d = length(pa - ba * h - nrm * bow);
    float vis = smoothstep(.25 + fi * .07, .4 + fi * .07, wrap);
    float pulse = pow(.5 + .5 * sin(h * 26. - t * 5. + fi * 3.), 10.);
    col += vec3(.95, .7, .4) * (exp(-d / (px * 1.2)) * (.08 + .9 * pulse)) * vis * smoothstep(0., .05, h);
    // The node: a small lattice cube of light.
    vec2 nd = uv - node;
    float sz = .012 + .01 * hash11(fi * 4.4);
    vec2 g = abs(nd) / sz;
    float box = max(g.x, g.y);
    float grid = smoothstep(.12, 0., abs(fract(nd.x / sz * 2.) - .5) * 2. - .85) + smoothstep(.12, 0., abs(fract(nd.y / sz * 2.) - .5) * 2. - .85);
    col = mix(col, vec3(.01, .012, .02), step(box, 1.) * vis);
    col += vec3(.5, .8, 1.) * (grid * .25 * step(box, 1.) + exp(-abs(box - 1.) * 40.) * .6 + exp(-box * 1.2) * .08) * vis * (.75 + .25 * sin(t * 2. + fi));
  }

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
