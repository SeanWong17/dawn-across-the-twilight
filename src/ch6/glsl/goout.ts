import { PRELUDE } from '../../lib/glsl';

// The stars go out. A galaxy seen face-on at an angle, its stars resolved, and as "out"
// (0..1) runs each goes dark at its own moment, the last few reddening first. Through the
// thinning dark, a small bright company of travellers keeps moving inward toward the core,
// leaving a short trail: the voyage is not over. "go" (0..1) is their progress.
export const GOOUT = PRELUDE + `
uniform float expo;
uniform float out_;
uniform float go;

const float INC = .45;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float px = 1. / res.y;
  vec3 col = vec3(.0015, .0015, .003);

  vec2 d = vec2(uv.x * .95 + uv.y * .3, (uv.y - uv.x * .12) / INC);
  float r = length(d);
  float a = atan(d.y, d.x) - t * .004;
  // Diffuse light of the disk fades with the stars.
  float arm = pow(.5 + .5 * cos(2. * (a - log(r + .02) / .3)), 3.);
  float disk = exp(-r * 2.6) * (.15 + arm * .9) * (.5 + fbm(vec2(cos(a), sin(a)) * r * 6.));
  col += vec3(.8, .62, .45) * disk * .32 * pow(1. - out_, 2.);
  col += vec3(1., .75, .5) * exp(-r * 12.) * .6 * (1. - smoothstep(.4, .95, out_));

  // Resolved stars on a grid in disk space, two scales.
  for (int L = 0; L < 2; L++) {
    float sc = L == 0 ? 60. : 140.;
    vec2 g = d * sc;
    vec2 id = floor(g), f = fract(g) - .5;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(x, y);
      vec2 cid = id + o + float(L) * 37.;
      float h = hash21(cid);
      vec2 cell = (id + o + .5) / sc;
      float rc = length(cell);
      float ac = atan(cell.y, cell.x);
      float armc = pow(.5 + .5 * cos(2. * (ac - log(rc + .02) / .3)), 2.);
      float dens = (.15 + .7 * armc) * exp(-rc * 1.8) * (L == 0 ? .9 : 1.2);
      if (h > dens) continue;
      vec2 pos = o + (hash22(cid) - .5) * .8 - f;
      float dd = length(pos / sc * vec2(1., INC)) * res.y;
      // Each star's moment of death; inner (older) stars a little earlier.
      float die = hash11(h * 91.3 + float(L)) * .92 + .03;
      float k = (out_ - die) / .05;
      float alive = 1. - smoothstep(0., 1., k);
      if (alive <= 0.) continue;
      float redden = smoothstep(-2.5, 0., k);
      float mag = pow(hash11(h * 13.7), 5.);
      vec3 tint = mix(vec3(1., .82, .65), vec3(.7, .82, 1.), hash11(h * 47.));
      tint = mix(tint, vec3(1., .3, .12), redden);
      // A brief last swell before going dark.
      float swell = 1. + 1.5 * exp(-pow((k + .6) / .35, 2.));
      col += tint * (exp(-dd * dd * 1.4) * (.12 + 2.2 * mag) + exp(-dd * .7) * mag * .2) * alive * swell * (L == 0 ? 1. : .55);
    }
  }

  // The travellers: a small cluster of lights crossing toward the core.
  vec2 A = vec2(-.5, -.2), B = vec2(-.08, -.02);
  vec2 head = mix(A, B, go);
  vec2 dir = normalize(B - A);
  vec2 q = uv - head;
  float along = dot(q, dir), across = dot(q, vec2(-dir.y, dir.x));
  float tl = .26;
  float trail = (exp(-across * across / (px * px * 3.)) + .25 * exp(-across * across / (px * px * 40.))) * smoothstep(-tl, 0., along) * step(along, 0.) * (1. + along / tl);
  float on = smoothstep(0., .05, go);
  col += vec3(.7, .86, 1.) * trail * 1.1 * on;
  // A soft halo so the company reads against the dying disk.
  col += vec3(.55, .75, 1.) * (exp(-length(q) / .018) * .35 + exp(-length(q) / .06) * .08) * on;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 o = (hash22(vec2(fi, 3.)) - .5) * vec2(.03, .018) - dir * fi * .009;
    float dd = length(q - o) * res.y;
    col += vec3(.85, .93, 1.) * (exp(-dd * dd * .35) * 2.2 + exp(-dd * .25) * .18) * (fi == 0. ? 1.4 : .75) * on;
  }

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
