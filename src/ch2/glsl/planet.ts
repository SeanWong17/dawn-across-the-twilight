import { PRELUDE } from '../../lib/glsl';

// The whole Earth from deep space, in time-lapse. "decline" (0..1) runs the planet's
// future: ice caps go, land browns, seas shrink to salt pans, the air turns to a pale
// scorched haze while the Sun's glare from the left grows. "push" dollies in, "spin"
// offsets the longitude so each shot shows a different face. Chapter 3 adds "night"
// (swings the Sun behind the planet), "lights" (cities) and "ring" (orbital rings).
export const PLANET = PRELUDE + `
uniform float expo;
uniform float decline;
uniform float push;
uniform float spin;
uniform float night;
uniform float lights;
uniform float ring;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }

vec2 sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float h = b * b - dot(ro, ro) + r * r;
  if (h < 0.) return vec2(-1.);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 surface(vec3 n, vec3 L, vec3 rd, out float cloud) {
  vec3 p = rotY(t * .05 + spin) * rotX(.4) * n;
  vec3 q = p * 3.2 + vec3(.55, 0., .3);
  float cont = fbm3(q + .6 * vec3(fbm3(q * 1.3 + 4.), fbm3(q * 1.3 + 9.), 0.));
  // Sea level falls as the oceans boil off.
  float lvl = .5 - .13 * smoothstep(.35, .9, decline);
  float landMask = smoothstep(lvl, lvl + .03, cont);
  float relief = fbm3(p * 16.);
  float lat = abs(p.y);
  float dry = smoothstep(.05, .7, decline);
  float scorch = smoothstep(.55, 1., decline);

  vec3 sea = mix(vec3(.004, .025, .08), vec3(.01, .07, .16), smoothstep(.4, .5, cont));
  sea = mix(sea, vec3(.03, .09, .12), dry * .6);
  vec3 green = mix(vec3(.04, .1, .03), vec3(.22, .19, .1), smoothstep(.6, .9, relief + lat * .3));
  vec3 desert = mix(vec3(.32, .22, .12), vec3(.42, .3, .18), relief);
  vec3 rust = mix(vec3(.3, .13, .07), vec3(.45, .26, .15), relief);
  vec3 land = mix(mix(green, desert, dry), rust, scorch);
  // Exposed seabed: pale salt flats.
  float seabed = smoothstep(.5, .5 - .02, cont) * landMask;
  land = mix(land, vec3(.55, .5, .42) * (.8 + .3 * relief), seabed * (1. - scorch * .5));
  // Polar ice retreats first.
  float ice = smoothstep(.78, .86, lat + relief * .1) * (1. - smoothstep(.0, .3, decline));
  land = mix(land, vec3(.75, .78, .8), ice);
  sea = mix(sea, vec3(.75, .78, .8), ice);

  vec3 col = mix(sea, land, landMask);
  float ndl = dot(n, L);
  float lit = smoothstep(-.08, .3, ndl);
  col *= lit * 2.4;

  vec3 h = normalize(L - rd);
  float spec = pow(max(dot(n, h), 0.), 160.) * (1. - landMask) * lit;
  col += vec3(1., .85, .65) * spec * 3. * (1. - dry);

  // Weather: normal clouds, then thick steam during the moist greenhouse, then thin haze.
  float cl = fbm3(p * 6. + vec3(t * .03, 0, 0) + 2. * vec3(fbm3(p * 1.6 + t * .01), 0., 0.));
  float steam = smoothstep(.3, .6, decline) * (1. - smoothstep(.75, .95, decline));
  cloud = smoothstep(.5 - steam * .12, .78, cl) * mix(.8, 1., steam) * (1. - scorch * .75);
  vec3 cc = mix(vec3(.95, .93, .9), vec3(.95, .85, .7), scorch);
  col = mix(col, cc * lit * 2.2, cloud);
  // Far-future cities: webs of light along coasts and across the land on the night side.
  float region = smoothstep(.5, .62, fbm3(p * 5. + 7.));
  float points = smoothstep(.82, .95, vnoise3(p * 260.)) + .5 * smoothstep(.8, .95, vnoise3(p * 110. + 3.));
  float roads = pow(1. - abs(fbm3(p * 14.) * 2. - 1.), 60.) * .35;
  float coast = exp(-abs(cont - lvl - .012) * 120.) * .5;
  float city = landMask * (points * (region + coast) + roads * region);
  col += vec3(1., .72, .42) * city * lights * (1. - lit) * (1. - cloud * .8) * .9;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float dist = mix(3.4, 2.75, smoothstep(0., 1., push));
  vec3 ro = vec3(0., 0., dist);
  // Frame the planet right of center.
  vec3 rd = normalize(vec3(uv - vec2(.28, -.02), -1.35));
  vec3 L = normalize(mix(vec3(-1., .25, .55), vec3(-.55, .3, -.8), night));

  vec3 col = starfield(uv + vec2(t * .002, 0.), 60., .1, .6);
  col += starfield(uv * 1.7 + 3.1, 140., .14, .9) * .35;

  vec2 hit = sphere(ro, rd, 1.);
  float b = dot(ro, rd);
  float hr = length(ro - rd * b);   // closest approach of the ray to the planet centre
  vec3 atm = mix(vec3(.3, .55, 1.), vec3(1., .82, .55), smoothstep(.3, 1., decline));
  if (hit.x > 0.) {
    vec3 n = normalize(ro + rd * hit.x);
    float cloud;
    col = surface(n, L, rd, cloud);
    float fres = pow(1. - max(dot(n, -rd), 0.), 3.);
    float day = smoothstep(-.2, .3, dot(n, L));
    col = mix(col, atm * day * .9, fres * .7);
  }
  // Atmosphere shell glow around the limb, brightest on the sunward side.
  vec3 cp = ro - rd * b;
  float side = smoothstep(-.6, .8, dot(normalize(cp), L));
  float shell = hit.x > 0. ? exp(-(1. - hr) / .02) : exp(-(hr - 1.) / mix(.018, .035, decline));
  col += atm * shell * side * 1.4;

  // Orbital rings: two thin bands in a tilted plane, lit by the Sun, with traffic.
  if (ring > 0.) {
    vec3 nrm = normalize(vec3(.12, 1., .28));
    float den = dot(rd, nrm);
    if (abs(den) > 1e-4) {
      float tp = -dot(ro, nrm) / den;
      vec3 rp = ro + rd * tp;
      float rr = length(rp);
      bool front = hit.x < 0. || tp < hit.x;
      float bands = exp(-abs(rr - 1.32) * 900.) + .7 * exp(-abs(rr - 1.52) * 1200.) + .25 * exp(-abs(rr - 1.18) * 1500.);
      // Light where the ring is out of the planet's shadow.
      float shadow = smoothstep(.95, 1.05, length(rp - L * dot(rp, L))) + step(0., dot(rp, L));
      float ang = atan(rp.z, rp.x);
      float traffic = pow(vnoise(vec2(ang * 120. - t * 3., rr * 30.)), 12.) * 8.;
      vec3 rc = vec3(.75, .82, 1.) * bands * (.3 + .9 * min(shadow, 1.)) + vec3(1., .8, .5) * traffic * bands;
      if (tp > 0. && front) col += rc * ring * 1.4;
    }
  }

  // Off-frame Sun: glare from the left that strengthens as it brightens.
  float glare = exp(-length(uv - vec2(-1.25, .32)) * 1.6);
  col += vec3(1., .9, .75) * glare * mix(.04, .7, decline * decline);

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
