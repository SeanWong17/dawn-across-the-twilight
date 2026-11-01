import { PRELUDE } from '../../lib/glsl';

// Earth from orbit. The sun rises over the limb ("sunrise" uniform, seconds) and
// the surface ages from a dark volcanic world to a living blue planet ("age" 0..1).
export const EARTH = PRELUDE + `
uniform float sunrise;
uniform float age;
uniform float expo;

const vec3 C = vec3(0., -1.06, 0.);
const float R = 1.0;
const float ATM = 0.022;
const float PITCH = -0.25;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }

vec2 sphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + r * r;
  if (h < 0.) return vec2(-1.);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 surface(vec3 n, vec3 L, vec3 rd) {
  vec3 p = rotY(t * .006 + 2.1) * rotX(.35) * n;
  // Continents drift as the planet ages.
  vec3 q = p * 3.2 + vec3(age * .55, 0., age * .3);
  float cont = fbm3(q + .6 * vec3(fbm3(q * 1.3 + 4.), fbm3(q * 1.3 + 9.), 0.));
  float landMask = smoothstep(.53 - .03 * age, .56 - .03 * age, cont);
  float relief = fbm3(p * 16.);
  float lat = abs(p.y);

  // Young world: basalt, steaming seas, glowing fissures.
  vec3 youngSea = mix(vec3(.035, .045, .04), vec3(.06, .07, .05), relief);
  vec3 youngLand = mix(vec3(.09, .07, .06), vec3(.16, .12, .09), relief);
  // Living world: deep ocean, greens and ochres, polar ice.
  vec3 sea = mix(vec3(.004, .025, .08), vec3(.01, .07, .16), smoothstep(.45, .55, cont));
  vec3 land = mix(vec3(.05, .11, .035), vec3(.26, .2, .11), smoothstep(.35, .7, relief + lat * .4));
  land = mix(land, vec3(.75, .78, .8), smoothstep(.78, .86, lat + relief * .1));

  float g = smoothstep(.0, 1., age);
  vec3 col = mix(mix(youngSea, youngLand, landMask), mix(sea, land, landMask), g);

  float ndl = dot(n, L);
  float lit = smoothstep(-.06, .25, ndl);
  col *= lit * 2.4;

  // Specular glint on the water.
  vec3 h = normalize(L - rd);
  float spec = pow(max(dot(n, h), 0.), 180.) * (1. - landMask) * lit;
  col += vec3(1., .85, .65) * spec * mix(.6, 3.5, g);

  // Clouds thicken with the atmosphere.
  float cl = fbm3(p * 7. + vec3(t * .004, 0, 0) + 2. * vec3(fbm3(p * 1.6), 0., 0.));
  cl = smoothstep(.5, .78, cl) * mix(.35, .85, g);
  col = mix(col, vec3(.95, .93, .9) * lit * 2.2, cl);

  // Volcanic light on the night side of the young world.
  float fiss = pow(1. - abs(fbm3(p * 14.) * 2. - 1.), 60.) * (1. - g);
  fiss *= smoothstep(.45, .7, fbm3(p * 5. + 3.));
  col += vec3(1., .32, .06) * fiss * (1. - lit * .8) * .7;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec3 ro = vec3(0.);
  // Low orbit, looking along the limb; a slow push and drift.
  float pitch = PITCH + .0012 * t;
  mat3 cam = rotY(.004 * t) * rotX(pitch);
  vec3 rd = cam * normalize(vec3(uv, -1.35 - .004 * t));

  // Sun climbs from below the horizon (dip ~ -0.339 rad) at "sunrise".
  float k = smoothstep(0., 1., clamp((t - sunrise + 1.2) / 6., 0., 1.));
  float el = mix(-.352, -.305, k) + .0009 * max(0., t - sunrise - 5.);
  float az = .3;
  vec3 S = normalize(vec3(-sin(az) * cos(el) * -1., sin(el), -cos(az) * cos(el)));

  // Sun occlusion by the limb, softened by the atmosphere.
  vec3 sc = ro + S * dot(C - ro, S);
  float sunVis = smoothstep(R - .0004, R + .0035, length(sc - C));
  float pre = smoothstep(-2.5, 0., t - sunrise);

  vec3 col = vec3(0.);
  vec2 hit = sphere(ro, rd, C, R);
  vec3 cp = ro + rd * max(dot(C - ro, rd), 0.);
  float hr = length(cp - C);
  float toSun = max(dot(rd, S), 0.);

  if (hit.x > 0.) {
    vec3 n = normalize(ro + rd * hit.x - C);
    col = surface(n, S, rd);
    float fres = pow(1. - max(dot(n, -rd), 0.), 5.);
    float day = smoothstep(-.15, .2, dot(n, S));
    col += vec3(.2, .45, 1.) * fres * day * mix(.3, 1.2, age);
    // Haze along the grazing distance.
    col = mix(col, vec3(.3, .5, .9) * day * .6, fres * .6);
  } else {
    float sky = 1. - sunVis * .85 * pre;
    col = starfield(uv + vec2(t * .0012, 0.), 60., .10, .6) * sky;
    col += starfield(uv * 1.7 + 3.1, 140., .14, .9) * .35 * sky;
    col += vec3(.02, .03, .05) * fbm(uv * 3. + 1.) * sky;
  }

  // Atmospheric limb: thin bright band, warm towards the sun, blue away from it.
  float shell = (hr - R) / ATM;
  float band = hit.x > 0. ? exp(-(R - hr) / .0015) : exp(-max(shell, 0.) * 3.);
  float fwd = pow(toSun, 60.) * 6. + pow(toSun, 8.) * 1.2 + .08;
  vec3 rimCol = mix(vec3(1., .5, .2), vec3(.35, .6, 1.), smoothstep(.0, .8, shell) * .8 + (1. - pow(toSun, 20.)) * .4);
  col += rimCol * band * fwd * (.25 + .75 * pre) * mix(.6, 1., age);

  // Sun disc, bloom and a restrained anamorphic streak.
  float sd = acos(clamp(dot(rd, S), -1., 1.));
  vec3 sunC = vec3(1., .92, .8);
  float occl = hit.x > 0. ? 0. : 1.;
  float glow = exp(-sd * 900.) * 30. * occl + exp(-sd * 90.) * 1.4 + exp(-sd * 14.) * .22;
  vec3 Sc = transpose(cam) * S;
  vec2 sp = Sc.xy / -Sc.z * 1.35;
  vec2 dv = uv - sp;
  float streak = exp(-abs(dv.y) * 700.) * exp(-abs(dv.x) * 3.) * .45;
  col += sunC * (glow + streak) * sunVis;
  // Before the sun clears the limb, a growing bead of light where it will rise.
  col += vec3(1., .6, .3) * exp(-sd * 60.) * band * 3. * (1. - sunVis) * pre;

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
