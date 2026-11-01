import { PRELUDE } from '../../lib/glsl';

// Self-replicating probes. A seed probe leaves an asteroid; every PERIOD seconds each
// probe builds a copy of itself and the pair splits apart, so the network of their
// paths branches out across the frame while the camera pulls back.
export const SWARM = PRELUDE + `
uniform float expo;
uniform float pull;

uniform vec4 seg[127];   // start.xy, pos.xy for each probe (see swarmTree.ts)
uniform vec4 age[32];    // seconds since each probe's birth, < 0 = not yet built

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float zoom = mix(.55, 1.9, pull);
  vec2 p = uv * zoom + vec2(.55, .05);

  vec3 col = vec3(.002, .003, .007);
  col += vec3(.03, .04, .07) * fbm(uv * 1.2 + 7.) * fbm(uv * 3. - 1.);
  col += starfield(uv * .8 + vec2(t * .003, 0.), 60., .12, .5) * .9;
  col += starfield(uv * 1.7 + 9., 130., .25, 1.) * .3;

  // The asteroid the seed probe was built from, lower left of the origin.
  vec2 ap = p - vec2(-.1, -.04);
  float ar = .07 + .012 * (fbm(vec2(atan(ap.y, ap.x) * 2., 3.)) - .5);
  float ad = length(ap) - ar;
  float am = smoothstep(.002 * zoom, -.002 * zoom, ad);
  float lit = clamp(dot(normalize(ap + 1e-4), normalize(vec2(.7, .4))), 0., 1.);
  vec3 rock = vec3(.09, .08, .075) * (.3 + 1.2 * lit) * (.6 + .6 * fbm(ap * 60.));
  col = mix(col, rock, am);
  // Mining scars glowing where the material for the first probe was taken.
  col += vec3(1., .5, .2) * am * smoothstep(.75, .9, fbm(ap * 30. + 2.)) * .6;

  for (int i = 0; i < 127; i++) {
    float ag = age[i / 4][i % 4];
    if (ag < 0.) continue;
    vec2 start = seg[i].xy, pos = seg[i].zw;
    float g = floor(log2(float(i + 1)) + .001);
    // Path from where this probe was born to where it is now.
    vec2 pa = p - start, ba = pos - start;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0., 1.);
    float dl = length(pa - ba * h) / zoom;
    col += vec3(.2, .55, 1.) * exp(-dl * 2600.) * (.12 + .25 * h) * pow(.9, g);
    // The probe itself: a bright point, flaring white at the moment it splits off.
    float dp = length(p - pos) / zoom;
    float flare = exp(-ag * 5.) * 2.5;
    col += vec3(.7, .9, 1.) * (exp(-dp * 1400.) * 1.4 + exp(-dp * 160.) * .06) * (1. + flare);
  }

  outColor = finish(col * 1.2 * expo, gl_FragCoord.xy);
}`;
