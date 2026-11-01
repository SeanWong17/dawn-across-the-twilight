import { PRELUDE } from '../../lib/glsl';

// Summer of the home world: a meadow at golden hour, a lone broad tree backlit by a
// warm sun, tall grass swaying in the wind, pollen drifting through the light.
export const SUMMER = PRELUDE + `
uniform float expo;

// Field of grass blades rising from y0, most short, a few tall, each with its own lean
// and wind phase. "head" > 0 adds an oat-like seed head to the tips. Returns coverage;
// rim gets the backlight along blade edges.
float grass(vec2 uv, float y0, float h, float dens, float wid, float seed, float wind, float head, out float rim) {
  float x = uv.x * dens;
  float id0 = floor(x);
  float cov = 0.;
  rim = 0.;
  for (int k = -3; k <= 3; k++) {
    float id = id0 + float(k);
    for (int j = 0; j < 3; j++) {
      float hs = hash11(id * 1.37 + float(j) * 7.1 + seed);
      float hh = hash11(id * 3.1 + float(j) * 2.3 + seed * 2.);
      float bh = h * (.3 + 1. * hh * hh);
      float y = (uv.y - y0) / bh;
      if (y < 0. || y > 1.08) continue;
      float gust = sin(t * (1.1 + .5 * hs) + id * .3 - uv.x * 1.5);
      float lean = bh * ((hs - .5) * .5 + wind * (.25 + .2 * gust));
      float cx = id + fract(hs * 7.3) + lean * y * y * dens;
      float w = wid * (1. - y * .9) * (.6 + .8 * fract(hs * 3.7));
      float d = abs(x - cx);
      float a = y <= 1. ? smoothstep(w, w * .35, d) : 0.;
      if (head > 0. && hh > .55) {
        // Seed head: a small elongated cluster hanging at the tip.
        vec2 hp = vec2((x - cx - lean * dens * .15) / dens, uv.y - (y0 + bh * .95));
        float hd = length(hp / vec2(.0045, .028) * head) - 1.;
        a = max(a, smoothstep(.3, -.2, hd));
      }
      cov = max(cov, a);
      rim = max(rim, a * smoothstep(w * .2, w, d) * min(y, 1.));
    }
  }
  return cov;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 sun = vec2(-.2, .1);
  float sd = length(uv - sun);
  float horizon = -.13;

  vec3 col = mix(vec3(1., .58, .26), vec3(.22, .3, .5), smoothstep(-.05, .45, uv.y));
  col += vec3(1., .7, .38) * (exp(-sd * 4.) * .6 + exp(-sd * 22.) * 1. + exp(-sd * 90.) * 3.);
  // Soft cumulus banks.
  float cl = fbm(uv * vec2(2.2, 5.) + vec2(t * .01, 0.));
  col = mix(col, mix(vec3(1., .86, .7), vec3(.75, .62, .55), smoothstep(.15, .45, uv.y)), smoothstep(.55, .8, cl) * smoothstep(.0, .2, uv.y) * .6);

  // Distant tree line in haze.
  float tl = horizon + .03 + .025 * fbm(vec2(uv.x * 8., 2.)) + .015 * vnoise(vec2(uv.x * 40., 1.));
  if (uv.y < tl) col = mix(col, vec3(.45, .3, .2), .6);
  // Field.
  if (uv.y < horizon) {
    float dz = horizon - uv.y;
    vec3 f = mix(vec3(.8, .5, .22), vec3(.22, .16, .06), smoothstep(0., .3, dz));
    f *= .8 + .3 * fbm(vec2(uv.x / (dz + .05) * .5, 1. / (dz + .05)));
    col = mix(col, f, smoothstep(0., .01, dz));
  }

  // Lone tree on the left: trunk plus a wide, ragged crown with light leaking through.
  vec2 tp = uv - vec2(-.6, horizon);
  float trunk = abs(tp.x + .01 * sin(tp.y * 8.)) - mix(.022, .012, clamp(tp.y / .28, 0., 1.));
  trunk = max(trunk, tp.y - .28);
  trunk = max(trunk, -tp.y);
  vec2 cq = (tp - vec2(0., .33)) / vec2(.3, .16);
  float sway = .01 * sin(t * .9);
  float crown = length(cq + vec2(sway, 0.)) - 1. + .7 * (fbm(tp * 9. + vec2(t * .05, 0.)) - .5) + .35 * (fbm(tp * 26.) - .5);
  float gaps = smoothstep(.56, .7, fbm(tp * 34. + 3.)) * smoothstep(-.5, 0., crown);
  float tree = max(smoothstep(.004, -.002, trunk), smoothstep(.02, -.02, crown) * (1. - gaps));
  vec3 treeC = vec3(.035, .03, .02) + vec3(1., .62, .28) * smoothstep(-.07, .02, crown) * 1.2 * exp(-length(uv - sun) * 3.);
  col = mix(col, treeC, tree);

  // Grass layers: far (fine, hazy), mid, near (large silhouettes with golden rims).
  float r;
  float g = grass(uv, horizon - .12, .08, 220., .6, 1., .2, 0., r);
  col = mix(col, vec3(.36, .22, .1) + vec3(1., .7, .3) * r * .6, g * .8);
  g = grass(uv, -.45, .26, 70., .7, 7., .3, 1., r);
  col = mix(col, vec3(.14, .1, .04) + vec3(1., .72, .35) * r * 1.1, g);
  g = grass(uv, -.5, .5, 16., .35, 13., .4, .7, r);
  col = mix(col, vec3(.04, .03, .015) + vec3(1., .7, .32) * r * 1.4, g);

  // Pollen and seeds drifting through the light.
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    vec2 pp = vec2(fract(hash11(fi) + t * (.01 + .015 * hash11(fi * 3.))) * 2.6 - 1.3,
                   -.35 + .7 * hash11(fi * 7.) + .03 * sin(t * .7 + fi));
    float s = .002 + .006 * pow(hash11(fi * 5.), 3.);
    float d = length(uv - pp);
    col += vec3(1., .85, .55) * smoothstep(s, 0., d) * .9 * exp(-length(pp - sun) * 1.5);
  }

  outColor = finish(col * expo * .95, gl_FragCoord.xy);
}`;
