import { PRELUDE } from '../../lib/glsl';

// Ediacaran shallow sea, seen from the seabed looking up toward the light.
// Frond organisms (Charnia) stand as backlit silhouettes against shafts and a rippled surface.
export const SEA = PRELUDE + `
uniform float expo;

float caustic(vec2 p) {
  vec2 q = p;
  float c = 0.;
  for (int i = 0; i < 4; i++) {
    q += vec2(sin(q.y * 1.3 + t * .35 + float(i)), cos(q.x * 1.1 - t * .3)) * .45;
    c += .02 / abs(sin(q.x) * sin(q.y) + .02);
  }
  return c * .25;
}

// Charnia-like frond: thin stalk, then a long tapered blade made of alternating
// leaflets; returns signed distance (scene units) and leaflet shading.
float frond(vec2 p, float h, float sway, float seed, out float rib) {
  float y = clamp(p.y / h, 0., 1.);
  p.x -= sway * y * y * h;
  float blade = smoothstep(.08, .22, y);
  float prof = pow(sin(clamp((y - .1) / .9, 0., 1.) * PI * .92 + .1), .9);
  float w = mix(h * .01, h * .085 * prof, blade);
  // Leaflet serration along the edge.
  float seg = fract(p.y / h * 34. + sign(p.x) * .5 + seed);
  w *= 1. - .22 * blade * smoothstep(.6, 1., seg);
  float d = max(abs(p.x) - w, max(-p.y, p.y - h));
  rib = blade * (1. - abs(p.x) / max(w, 1e-4)) * (.6 + .4 * seg);
  return d;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float cx = t * .015;

  // Looking up: bright surface at the top, falling off into dark depths.
  float up = uv.y;
  vec3 deep = vec3(.004, .016, .02);
  vec3 mid = vec3(.02, .09, .09);
  vec3 col = mix(deep, mid, smoothstep(-.45, .45, up));

  // Snell's window: surface ripples, brightest overhead.
  float sw = smoothstep(.15, .5, up);
  vec2 sp = vec2(uv.x / (1.1 - up) + cx * 2., 1. / (1.05 - up) + t * .05) * 3.;
  float c = caustic(sp);
  col += vec3(.35, .7, .62) * (.15 + .25 * min(c, 2.)) * sw * smoothstep(.3, .55, up) * .4;
  col += vec3(.7, .95, .85) * exp(-pow((up - .55) * 5., 2.)) * exp(-uv.x * uv.x * 2.) * .35;

  // God rays converging toward an off-frame sun above.
  vec2 o = vec2(.25, 1.1);
  vec2 dv = uv - o;
  float a = atan(dv.x, -dv.y);
  float rays = 0.;
  rays += pow(vnoise(vec2(a * 22. + t * .08, 1.)), 4.);
  rays += .6 * pow(vnoise(vec2(a * 41. - t * .05, 7.)), 5.);
  rays *= smoothstep(-.5, .4, up) * (1. - sw * .5);
  col += vec3(.25, .6, .52) * rays * .38;

  // Fronds at three depths. Far ones dissolve into the water colour.
  float bed = -.36;
  for (int L = 2; L >= 0; L--) {
    float fl = float(L);
    float par = 1. - fl * .35;
    vec2 q = vec2(uv.x + cx * par * 1.5 + fl * 4.3, uv.y);
    float base = bed + fl * .07 + .02 * fbm(vec2(q.x * 3., fl));
    float cell = .11 - fl * .025;
    float id = floor(q.x / cell);
    float cover = 0.;
    float shade = 0.;
    for (int k = -2; k <= 2; k++) {
      float cid = id + float(k);
      float r = hash11(cid * 7.3 + fl * 31.);
      if (r < .3) continue;
      float x0 = (cid + .5 + (hash11(cid * 3.1) - .5) * .8) * cell;
      float h = (.22 + .42 * pow(hash11(cid * 5.7 + fl), 1.5)) * (1. - fl * .28);
      float sway = .08 * sin(t * .45 + cid * 1.3) + .03 * sin(t * 1.1 + cid * 2.);
      float rib;
      float d = frond(vec2(q.x - x0, q.y - base), h, sway, cid, rib);
      float px = 1.2 / res.y;
      float m = smoothstep(px, -px, d);
      // Light leaking through thin tissue near the edges.
      float edge = smoothstep(-.006, 0., d) * m;
      shade = mix(shade, rib, m * (1. - cover));
      cover = max(cover, m);
      shade += edge * .8;
    }
    vec3 sil = mix(vec3(.006, .012, .012), vec3(.05, .09, .07), shade * (.3 + .7 * smoothstep(-.3, .4, uv.y)));
    sil += vec3(.25, .5, .4) * shade * smoothstep(.0, .5, uv.y) * .15;
    float fog = fl * .32;
    sil = mix(sil, col * .9, fog);
    col = mix(col, sil, cover);

    // Seabed silhouette for this layer: microbial mats, slightly lumpy.
    float g = smoothstep(.002, -.002, q.y - base + .01 * fbm(q * 14.));
    vec3 mat = mix(vec3(.006, .012, .012), col * .6, fog);
    col = mix(col, mat, g);
  }

  // Marine snow drifting through the light.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sc = 14. + fi * 18.;
    vec2 g = (uv + vec2(t * .006 * (1. + fi), t * .004 + fi)) * sc;
    vec2 id = floor(g), f = fract(g) - .5;
    float h = hash21(id + fi * 9.);
    vec2 off = (hash22(id) - .5) * .7;
    float d = length(f - off) * 30. / sc;
    col += vec3(.55, .8, .7) * exp(-d * d * 60.) * step(.93, h) * (.18 - fi * .05) * smoothstep(-.4, .3, uv.y);
  }

  outColor = finish(col * 1.35 * expo, gl_FragCoord.xy);
}`;
