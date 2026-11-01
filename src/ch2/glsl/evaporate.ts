import { PRELUDE } from '../../lib/glsl';

// The oceans boil away: a low view over a hot sea under a swollen white sun. Steam
// columns rise off the water; as "evap" (0..1) grows the waterline retreats toward the
// horizon and leaves a cracked salt floor in the foreground.
export const EVAP = PRELUDE + `
uniform float expo;
uniform float evap;

// Distance to the nearest Voronoi cell edge (salt-crust cracks).
float cracks(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y);
    vec2 r = o + hash22(i + o) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float horizon = .02;
  vec2 sun = vec2(-.32, .2);
  float sd = length(uv - sun);

  // Bleached, overheated sky.
  vec3 col = mix(vec3(.85, .62, .42), vec3(.36, .33, .34), smoothstep(.0, .5, uv.y));
  col += vec3(1., .9, .75) * (exp(-sd * 4.) * .5 + exp(-sd * 16.) * 1.2);
  col = mix(col, vec3(1.5, 1.4, 1.25) * (.85 + .15 * smoothstep(.15, .0, sd)), smoothstep(.15, .145, sd));
  col += vec3(1., .85, .65) * exp(-sd * 7.) * .6;

  if (uv.y < horizon) {
    float dz = horizon - uv.y;
    float z = .25 / dz;                       // distance along the ground
    vec2 gp = vec2(uv.x * z, z);
    // Shoreline: the sea pulls back toward the horizon.
    float shore = mix(.25, 5., pow(evap, 1.8)) + .4 * fbm(vec2(gp.x * .3, 3.));
    float isSea = smoothstep(shore - .25, shore + .25, z);

    // Sea: dull hot water, waves, a broad glittering sun path.
    float w = fbm(gp * vec2(1.2, .6) + vec2(t * .15, -t * .3));
    float w2 = vnoise(gp * vec2(5., 2.) + vec2(-t * .6, t * .2));
    vec3 sea = mix(vec3(.04, .06, .07), vec3(.2, .2, .19), w * .6);
    float path = exp(-abs(uv.x - sun.x) * mix(5., 1.5, smoothstep(0., .3, dz)));
    sea += vec3(1., .92, .78) * path * pow(w2, 4.) * 2.5;
    sea = mix(sea, col * .85, exp(-dz * 30.));

    // Exposed floor: salt crust broken into polygons, dark mud in the cracks.
    float cr = cracks(gp * 5.);
    vec3 salt = mix(vec3(.82, .76, .66), vec3(.95, .9, .8), fbm(gp * 3.));
    salt = mix(vec3(.18, .13, .1), salt, smoothstep(.0, .05 * (1. + z * .5), cr));
    salt *= .5 + .3 * exp(-abs(uv.x - sun.x) * 2.);
    salt = mix(salt, col * .8, smoothstep(3., 20., z) * .6);
    // Wet margin just behind the retreating waterline.
    float wet = smoothstep(shore * .6, shore, z) * (1. - isSea);
    salt = mix(salt, vec3(.3, .28, .24), wet * .6);
    col = mix(salt, sea, isSea);
  }

  // Steam: billowing columns that rise from the water and smear into the sky.
  float steamAmt = .35 + .65 * evap;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 sp = vec2(uv.x * (1.3 + fi * .5) + fi * 3.7, uv.y * 1.5 - t * (.06 + fi * .02));
    float plume = fbm(sp * 2.2 + vec2(fbm(sp * 1.1 + fi), 0.) * 1.4);
    float base = smoothstep(.35, -.05, uv.y - horizon) * smoothstep(-.3, horizon, uv.y);
    float rise = smoothstep(.75, .0, uv.y - horizon);
    float s = smoothstep(.5, .78, plume) * mix(base, rise, .5) * steamAmt;
    col = mix(col, vec3(1., .96, .9) * (.85 + .25 * exp(-sd * 3.)), s * .42);
  }
  // Heat shimmer haze at the horizon.
  col = mix(col, vec3(1., .93, .82), exp(-abs(uv.y - horizon) * 22.) * .45);

  outColor = finish(col * expo * .8, gl_FragCoord.xy);
}`;
