import { PRELUDE } from '../../lib/glsl';

// Humpback whales passing overhead, seen from below as silhouettes against the bright
// window of the surface. Caustic rays fall from above, marine snow drifts, and when the lead whale
// sings ("song" = seconds since its last phrase began) faint rings of sound spread out.
export const WHALES = PRELUDE + `
uniform float expo;
uniform float song;

float sdSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float smin(float a, float b, float k) {
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

// A humpback seen from below, head toward -x, unit length: a spindle body, the long
// pale pectoral fins spread like wings, and broad notched flukes. ph drives the slow
// stroke of fins and tail. fin = 1 where the point lies on a pectoral fin.
float whale(vec2 p, float ph, out float fin) {
  float u = clamp(p.x + .5, 0., 1.);
  float thick = .105 * pow(sin(PI * pow(u, .62)), 1.1) + .006;
  float body = length(vec2(max(abs(p.x) - .5, 0.), p.y)) - thick;
  // Pectoral fins: about a third of the body length, swept back, flapping slowly.
  vec2 fq = vec2(p.x, abs(p.y));
  float fa = .9 + .08 * sin(ph);
  vec2 f0 = vec2(-.27, .06), f1 = f0 + .36 * vec2(cos(fa), sin(fa)) * vec2(1., 1.);
  vec2 fm = mix(f0, f1, .5) + vec2(-.02, .0);
  float pf = min(sdSeg(fq, f0, fm, .032, .03), sdSeg(fq, fm, f1, .03, .008));
  // Knobbly leading edge.
  pf -= .0015 * sin(length(fq - f0) * 80.);
  // Flukes: a broad blade with a central notch, foreshortened with the stroke.
  float fl = .9 + .15 * sin(ph - .8);
  vec2 tq = vec2((p.x - .5) / fl, abs(p.y));
  float fk = sdSeg(tq, vec2(.0, .0), vec2(.07, .17), .03, .01);
  fk = max(fk, -(length(tq - vec2(.13, .0)) - .06));
  float d = smin(body, pf, .02);
  d = smin(d, fk, .025);
  fin = smoothstep(.01, -.01, pf - body + .01);
  return d;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float px = 1. / res.y;

  // Water seen looking up: the bright window of the surface, falling off into blue.
  vec2 sw = vec2(.05, .55);
  float dw = length((uv - sw) * vec2(.7, 1.));
  vec3 col = mix(vec3(.0, .02, .05), vec3(.06, .3, .42), smoothstep(1.3, .1, dw));
  col += vec3(.5, .8, .85) * exp(-dw * 3.2) * .6;
  // The rippling surface itself inside the window.
  float rip = fbm((uv - sw) * vec2(6., 10.) + vec2(t * .15, t * .1));
  col += vec3(.6, .85, .9) * smoothstep(.5, .75, rip) * exp(-dw * 3.) * .35;
  // Light shafts fanning down from the window.
  float a = atan(uv.x - sw.x, sw.y - uv.y);
  float rays = pow(fbm(vec2(a * 9. + t * .05, t * .04)), 3.) * 1.6 + .5 * pow(fbm(vec2(a * 22. - t * .07, 2.)), 4.);
  col += vec3(.4, .7, .8) * rays * smoothstep(1.4, .2, dw) * .2;

  // Song: rings spreading from the lead whale.
  vec2 lead = vec2(-.08 + t * .018, .02 - t * .004);
  if (song > 0.) {
    float rr = length(uv - lead);
    for (int k = 0; k < 3; k++) {
      float s = song - float(k) * .45;
      if (s <= 0.) continue;
      float ring = exp(-pow((rr - .1 - s * .3) / .025, 2.)) * exp(-s * 1.);
      col += vec3(.35, .6, .75) * ring * .08;
    }
  }

  // Three whales overhead at different depths: farther = smaller, bluer, softer.
  for (int k = 2; k >= 0; k--) {
    float fk = float(k);
    float scale = k == 0 ? .78 : k == 1 ? .36 : .22;
    vec2 pos = k == 0 ? lead : k == 1 ? vec2(.5 + t * .022, .3 - t * .003) : vec2(-.62 + t * .016, .28);
    float tilt = k == 0 ? .18 : k == 1 ? .1 : .05;
    vec2 q = (uv - pos) / scale;
    q = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * q;
    q.x = -q.x;   // swimming right, head toward +x on screen
    float fin;
    float d = whale(q, t * (.9 - fk * .15) + fk * 2., fin) * scale;
    float soft = px * (1.3 + fk * 2.5);
    float m = smoothstep(soft, -soft, d);
    vec3 sk = vec3(.008, .025, .04);
    // Pale undersides of the fins and throat grooves catching light scattered from below.
    sk = mix(sk, vec3(.07, .12, .15), fin * .6);
    float throat = smoothstep(.0, -.3, q.x) * step(-.5, q.x) * pow(.5 + .5 * sin(q.y * 140.), 6.) * smoothstep(.09, .0, abs(q.y));
    sk += vec3(.015, .025, .03) * throat;
    // Rim where light from the surface wraps the edges.
    sk += vec3(.15, .3, .35) * smoothstep(-.012 * scale, 0., d) * .4;
    col = mix(col, mix(sk, col, fk * .3), m);
  }

  // Marine snow drifting slowly upward through the light.
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    vec2 sp = uv * (14. + fl * 12.) + vec2(t * .05, -t * (.08 + fl * .05)) + fl * 9.;
    vec2 si = floor(sp), sf = fract(sp) - .5;
    float h = hash21(si + fl * 3.);
    if (h < .25) col += vec3(.5, .7, .8) * exp(-length(sf - (hash22(si) - .5) * .7) * (40. - fl * 10.)) * .12;
  }

  outColor = finish(col * 1.1 * expo, gl_FragCoord.xy);
}`;
