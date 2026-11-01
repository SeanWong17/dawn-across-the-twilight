import { PRELUDE } from '../../lib/glsl';

// The Sun in cutaway, as life comes to understand it: one octant removed to show the
// fusing core, the radiative zone and the churning convective zone. Orthographic, so
// the overlay can place annotations exactly. Object basis rows m0..m2 map world to
// object space; the sphere sits at screen uv "ctr" with radius "rad".
export const CUTAWAY = PRELUDE + `
uniform float expo;
uniform vec3 m0;
uniform vec3 m1;
uniform vec3 m2;
uniform vec2 ctr;
uniform float rad;
uniform float reveal;

vec3 toObj(vec3 w) { return vec3(dot(m0, w), dot(m1, w), dot(m2, w)); }

// Interior colour by fractional radius r, with the layer's own motion.
vec3 interior(vec3 o, float r) {
  float ang = atan(o.y, o.x) + atan(o.z, length(o.xy));
  vec3 core = vec3(1.6, 1.45, 1.1) * (1. + .25 * sin(t * 2.3)) * (1. - smoothstep(.0, .25, r) * .3);
  // Radiative zone: photons diffusing outward, fine grain drifting out.
  float rg = fbm(vec2(ang * 18., r * 60. - t * 1.2));
  vec3 radz = mix(vec3(1.2, .66, .24), vec3(.95, .4, .12), smoothstep(.25, .7, r)) * (.8 + .35 * rg);
  // Convective zone: rolling cells, rising hot and sinking cool.
  float cell = sin(ang * 22. + sin(r * 30. - t * .8) * 1.5);
  float cv = fbm(vec2(ang * 9. + t * .05, r * 14. - t * .4));
  vec3 conv = mix(vec3(.6, .17, .05), vec3(1.05, .4, .1), .5 + .5 * cell * cv);
  vec3 c = core;
  c = mix(c, radz, smoothstep(.235, .265, r));
  c = mix(c, conv, smoothstep(.69, .71, r));
  // Thin boundary lines between layers, like a diagram.
  float edge = exp(-abs(r - .25) * 300.) + exp(-abs(r - .7) * 300.);
  c += vec3(1., .9, .7) * edge * .35 * reveal;
  return c;
}

vec3 photosphere(vec3 n) {
  float g = .55 + .45 * smoothstep(.2, .8, vnoise3(n * 60. + vec3(0., 0., t * .4)));
  float sg = .8 + .2 * fbm3(n * 9. + t * .03);
  return vec3(1., .5, .17) * 1.55 * g * sg;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 q = (uv - ctr) / rad;          // world units: sphere radius 1
  vec3 col = starfield(uv, 60., .08, .5) * .7;
  float r2 = dot(q, q);
  vec3 ro = vec3(q, 3.);
  vec3 rd = vec3(0., 0., -1.);

  if (r2 < 1.) {
    float z0 = sqrt(1. - r2);
    vec3 p0 = vec3(q, z0);
    vec3 o0 = toObj(p0);
    bool cut = reveal > 0. && o0.x > 0. && o0.y > 0. && o0.z > 0.;
    if (!cut) {
      float mu = z0;
      col = photosphere(o0) * (.35 + .65 * pow(mu, .6));
    } else {
      // Find the first face of the removed octant along the ray.
      float best = 1e9;
      vec3 hitO = vec3(0.);
      vec3 rdo = toObj(rd), roo = toObj(ro);
      for (int i = 0; i < 3; i++) {
        float den = rdo[i];
        if (abs(den) < 1e-5) continue;
        float tt = -roo[i] / den;
        vec3 o = roo + rdo * tt;
        bool onFace = dot(o, o) < 1.;
        for (int j = 0; j < 3; j++) if (j != i && o[j] < 0.) onFace = false;
        if (onFace && tt < best) { best = tt; hitO = o; }
      }
      if (best < 1e8) {
        float r = length(hitO);
        col = interior(hitO, r);
        // Darken toward the face edges for depth.
        col *= .8 + .2 * smoothstep(1., .9, r);
      } else {
        col = vec3(0.);
      }
    }
  }
  float r = sqrt(r2);
  col += vec3(1., .55, .2) * exp(-max(r - 1., 0.) * 6.) * step(1., r) * .5;
  col += vec3(1., .6, .25) * exp(-r * 1.4) * .15;
  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
