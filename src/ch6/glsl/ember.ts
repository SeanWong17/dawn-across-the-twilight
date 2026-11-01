import { PRELUDE } from '../../lib/glsl';

// One of the last stars: a red dwarf burning down, seen close beside the dark limb of a
// cold planet. "cool" (0..1) runs out its fuel: the convection slows and coarsens, the
// disc reddens and dims, the corona shrinks, and it is left a dull ember fading to black.
// The few other stars behind it go out in the same span.
export const EMBER = PRELUDE + `
uniform float expo;
uniform float cool;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 S = vec2(.12, .1);
  float SR = .2;
  vec2 p = uv - S;
  float r = length(p);
  float lum = mix(1., .015, pow(cool, 1.3));

  vec3 col = vec3(.0015, .001, .0015);
  // Background stars, each going out at its own moment.
  vec2 g = uv * 55.;
  vec2 id = floor(g), f = fract(g) - .5;
  float h = hash21(id);
  if (h < .07) {
    vec2 o = (hash22(id) - .5) * .7;
    float d = length(f - o) * res.y / 55.;
    float off = hash11(h * 77.);
    float alive = 1. - smoothstep(off * .9, off * .9 + .06, cool);
    vec3 tint = mix(vec3(1., .5, .3), vec3(1., .8, .6), hash11(h * 31.));
    col += tint * exp(-d * d * 1.5) * (.2 + 1.5 * pow(hash11(h * 13.), 5.)) * alive;
  }

  // The red dwarf.
  float mu = sqrt(max(0., 1. - r * r / (SR * SR)));
  vec2 sp = p / SR;
  float a = atan(sp.y, sp.x);
  vec3 sph = vec3(sp, mu);
  float slow = mix(1., .15, cool);
  // Convection cells: big boiling granules that coarsen and slow as it cools.
  float cs = mix(7., 3.5, cool);
  float c1 = fbm3(vec3(sph.xy / (.6 + .4 * mu) * cs, t * .08 * slow));
  float c2 = vnoise3(vec3(sph.xy * cs * 3.5, t * .2 * slow));
  float cells = .65 + .5 * c1 + .15 * c2;
  float dark = mix(.45, .9, cool);
  vec3 hot = mix(vec3(1., .42, .14), vec3(.7, .1, .03), cool);
  vec3 dim = mix(vec3(.55, .1, .03), vec3(.18, .02, .01), cool);
  vec3 disc = mix(dim, hot, pow(mu, dark)) * cells * 2.4;
  // Starspots that spread as it fades.
  float spots = smoothstep(.62 - .12 * cool, .72 - .1 * cool, fbm3(vec3(sph.xy * 2.2, 9. + t * .01)));
  disc *= 1. - .7 * spots;
  col = mix(col, disc * lum, step(r, SR) * smoothstep(SR, SR - .002, r));
  // Corona and flares, collapsing inward with cool.
  float cr = mix(.07, .015, cool);
  float rays = .6 + .6 * fbm(vec2(a * 4., r * 3. - t * .05));
  col += vec3(1., .3, .1) * (exp(-(r - SR) / cr) * rays * .9 + exp(-r / (SR * 2.2)) * .25) * step(SR, r) * lum;
  // A final flare as the fuel runs out.
  float fl = exp(-pow((cool - .55) / .06, 2.));
  col += vec3(1., .45, .2) * exp(-length(p - SR * vec2(cos(2.4), sin(2.4))) / .03) * fl * .9;
  // Dying ember glow, hanging on after the light is gone.
  col += vec3(.3, .03, .01) * smoothstep(SR, SR * .2, r) * smoothstep(.75, 1., cool) * (1. - smoothstep(.95, 1., cool) * .6) * .12;

  // The planet keeps a faint rim from the ember and the last starlight after the star dies.
  float rimL = max(lum, .1 * (1. - .5 * smoothstep(.96, 1., cool)));
  // Dark limb of a cold planet in the foreground, lit along its edge by the star.
  vec2 P = vec2(-.62, -.95);
  float PR = .78;
  float pd = length(uv - P) - PR;
  vec2 nrm = normalize(uv - P);
  float facing = max(0., dot(nrm, normalize(S - P)));
  float rim = exp(min(pd, 0.) / .006) * pow(facing, 3.) * step(pd, 0.);
  vec3 surf = vec3(.004, .002, .002) + vec3(.4, .08, .03) * rim * rimL * 1.6;
  surf += vec3(.06, .015, .008) * pow(facing, 6.) * smoothstep(-.12, 0., pd) * fbm(uv * 14.) * rimL;
  col = mix(col, surf, smoothstep(.0015, -.0015, pd));
  // Thin atmosphere glow.
  col += vec3(.5, .12, .05) * exp(-max(pd, 0.) / .008) * step(0., pd) * pow(facing, 4.) * .35 * rimL;

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
