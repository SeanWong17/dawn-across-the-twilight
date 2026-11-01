import { PRELUDE } from '../../lib/glsl';

// Our own two hands, seen as if by their owner, palms up and cupped together around a
// small light on a cold snowy night. They shake. The light warms the palms and shines
// red through the edges of the fingers. With "rise" (0..1) the light lifts out of the
// hands and the camera tilts up after it into the night sky, where it settles as one
// more star; "dim" (0..1) lets everything but that star fall away.
export const HANDS = PRELUDE + `
uniform float expo;
uniform float rise;
uniform float dim;

// Capsule from a to b: x = signed distance, y = dome height above its axis plane,
// z = position along it (0..1).
vec3 cap(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  float r = mix(ra, rb, h);
  float l = length(pa - ba * h);
  return vec3(l - r, sqrt(max(r * r - l * l, 0.)), h);
}
float smin(float a, float b, float k) {
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
// Circular cross-section of depth R inside a silhouette of signed distance d: zero at the
// edge, flat (no ridge) once more than R inside.
float dome(float d, float R) { float u = 1. + clamp(d, -R, 0.) / R; return R * sqrt(max(1. - u * u, 0.)); }


// A right hand seen from above, palm up, little finger along x = 0, fingers pointing up
// the screen. Palm, fingers and thumb are one smooth silhouette (smooth union), and the
// height is a single rounded dome over it, so the skin runs unbroken from the wrist to
// the fingertips; creases, pads and mounts are shallow detail on that surface.
// Returns (silhouette distance, height, crease depth 0..1, fingertip weight 0..1).
vec4 hand(vec2 q, float curl) {
  // Palm: a rounded quad, wider across the knuckles than at the heel.
  vec2 pc = q - vec2(.145, -.125);
  float wpx = mix(.062, .074, smoothstep(-.09, .07, pc.y));
  vec2 bq = abs(pc) - vec2(wpx, .062);
  float d = length(max(bq, 0.)) + min(max(bq.x, bq.y), 0.) - .05;

  float lift = 0., crease = 0., tip = 0., pads = 0.;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 b0 = vec2(.083 + fi * .041, -.035 + .012 * sin(fi * 1.25 + .2));
    float ang = -.12 + fi * .07;
    float len = (fi == 0. ? .137 : fi == 1. ? .171 : fi == 2. ? .183 : .166) * (1. - .14 * curl);
    float r0 = fi == 0. ? .0185 : .021;
    vec2 dir = vec2(sin(ang), cos(ang));
    vec3 c = cap(q, b0 - dir * .03, b0 + dir * len, r0 * 1.08, r0 * .84);
    d = smin(d, c.x, .011);
    // Distance along the finger from its knuckle line, and how central across it.
    float s = dot(q - b0, dir) / len;
    float across = clamp(-c.x / (r0 * .9), 0., 1.);
    float on = smoothstep(.004, -.004, c.x);
    // Curling toward the tip lifts the far phalanges off the palm plane; the lift has a
    // rounded cross-section, so it meets the palm and the finger's sides without a step.
    float soft = dome(c.x, r0 * .9) / (r0 * .9);
    lift = max(lift, soft * (.04 + .035 * curl) * pow(smoothstep(.22, 1., s), 1.6));
    // Flexion creases: across the finger base, and at the two joints.
    float g = exp(-pow((s - .02) / .022, 2.)) * 1.1 + exp(-pow((s - .48) / .016, 2.)) + exp(-pow((s - .76) / .014, 2.)) * .8;
    crease = max(crease, g * on * smoothstep(0., .45, across));
    // Pads between the creases, the fullest at the tip.
    pads += on * (.0022 * exp(-pow((s - .9) / .07, 2.)) + .0014 * exp(-pow((s - .62) / .08, 2.)) + .0012 * exp(-pow((s - .26) / .1, 2.)));
    tip = max(tip, on * smoothstep(.7, .98, s));
  }
  // Thumb, lying along the side and lifting toward its tip.
  vec3 t1 = cap(q, vec2(.2, -.2), vec2(.272, -.13), .034, .029);
  vec3 t2 = cap(q, vec2(.272, -.13), vec2(.302, -.06), .029, .022);
  float dt = smin(t1.x, t2.x, .01);
  d = smin(d, dt, .028);
  float ton = smoothstep(.004, -.004, dt);
  float tu = clamp(dot(q - vec2(.2, -.2), vec2(.102, .14)) / dot(vec2(.102, .14), vec2(.102, .14)), 0., 1.);
  lift = max(lift, dome(dt, .026) / .026 * .04 * smoothstep(.3, 1., tu));
  crease = max(crease, exp(-pow(length(q - vec2(.272, -.13)) / .012, 2.)) * ton * .8);
  tip = max(tip, smoothstep(.55, .95, t2.z) * smoothstep(.004, -.004, t2.x));
  // Wrist, tapering into the sleeve.
  vec3 w = cap(q, vec2(.145, -.2), vec2(.155, -.55), .072, .066);
  d = smin(d, w.x, .045);

  // One rounded dome over the whole silhouette, cupped toward the palm's rim.
  float h = dome(d, .017) + lift;
  h += .55 * dot(pc, pc) * smoothstep(-.3, -.14, q.y) * smoothstep(0., -.01, d);
  // Mounts of the palm: the thumb's ball, the heel, and pads under the finger roots.
  vec2 th = (q - vec2(.2, -.16)) / vec2(.055, .07);
  vec2 hy = (q - vec2(.092, -.16)) / vec2(.042, .075);
  vec2 ip = (q - vec2(.145, -.052)) / vec2(.085, .022);
  h += .016 * exp(-dot(th, th) * 1.4) + .008 * exp(-dot(hy, hy) * 1.4) + .005 * exp(-dot(ip, ip)) + pads;
  // Palm lines, soft and fading out before the edges.
  float heart = abs(pc.y - .042 + 1.4 * pc.x * pc.x + .12 * pc.x);
  float head = abs(pc.y - .002 + .8 * pc.x * pc.x - .15 * pc.x);
  float life = abs(length((pc - vec2(.1, .02)) / vec2(1., 1.5)) - .085) + max(pc.x - .07, 0.) * 2.;
  float pl = exp(-pow(min(min(heart, head), life) / .0035, 2.)) * smoothstep(.1, .05, abs(pc.x)) * smoothstep(.11, .06, abs(pc.y));
  crease = max(crease, pl * .45);
  h -= .0016 * crease;
  float inside = smoothstep(.0, -.002, d);
  return vec4(d, max(h, 0.) * inside, crease * inside, tip * inside);
}

// Both hands, cupped together with the little fingers touching.
vec4 hands2(vec2 p) {
  vec4 r = hand(mat2(cos(.05), -sin(.05), sin(.05), cos(.05)) * (p + vec2(.012, 0.)), .25);
  vec4 l = hand(mat2(cos(-.03), -sin(-.03), sin(-.03), cos(-.03)) * (vec2(-p.x, p.y) + vec2(.012, -.006)), .35);
  return r.x < l.x ? r : l;
}

// Knitted sleeves, drawn over the forearms.
float sleeve(vec2 p, out float rnd) {
  vec2 q = vec2(abs(p.x), p.y);
  vec3 c = cap(q, vec2(.155, -.43), vec2(.21, -1.1), .108, .14);
  rnd = c.y / .12;
  return c.x;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float px = 1. / res.y;
  float rr = smoothstep(0., 1., rise);
  float cam = .9 * smoothstep(.06, 1., rise);
  vec2 w = uv + vec2(0., cam);

  // Background: the snowy ground far below, a treeline at the horizon, the night above.
  const float HZ = .62;
  vec3 col;
  if (w.y < HZ) {
    float depth = 1. / (HZ - w.y + .15);
    vec2 g = vec2(w.x * depth, depth);
    col = vec3(.012, .016, .026) * (.6 + .6 * fbm(g * 4.)) * smoothstep(-1., .4, w.y) + vec3(.004, .006, .011);
  } else {
    col = mix(vec3(.02, .03, .055), vec3(.004, .006, .015), smoothstep(HZ, HZ + .7, w.y));
    col += starfield(w * .9 + 1.7, 60., .12, .7) * .7;
    col += starfield(w * 1.8 + 6.1, 130., .25, 1.) * .25;
  }
  float tree = smoothstep(.002, -.002, w.y - HZ - .035 * fbm(vec2(w.x * 6., 2.)) - .02 * pow(fbm(vec2(w.x * 30., 5.)), 2.));
  col = mix(col, vec3(.006, .008, .014), tree * step(HZ - .05, w.y));

  // The light: resting in the cup, then rising to its place in the sky.
  float shake = 1. - rr * .8;
  vec2 jit = .0032 * shake * vec2(sin(t * 23.) + .6 * sin(t * 37. + 1.), sin(t * 29.) + .5 * sin(t * 41.));
  vec2 L0 = vec2(0., -.075);
  vec2 L = mix(L0 + jit, vec2(.04, 1.15), rr) + vec2(.025 * sin(rr * 7.) * rr * (1. - rr) * 4., 0.);
  float flick = .92 + .08 * sin(t * 13.) * sin(t * 7.3) + .04 * sin(t * 31.);

  // Hands, shaking with cold. p is the hands' own space.
  const vec2 HC = vec2(0., -.1);
  const float HS = 1.15;
  vec2 p = (w - jit - HC) / HS + HC;
  vec2 Lh = (L - jit - HC) / HS + HC;
  float pxh = px / HS;
  if (abs(p.x) < .45 && p.y < .24) {
    vec4 dh = hands2(p);
    float m = smoothstep(pxh * 1.2, -pxh * 1.2, dh.x);
    if (m > 0.) {
      float e = pxh * 1.5;
      float hx = hands2(p + vec2(e, 0.)).y - hands2(p - vec2(e, 0.)).y;
      float hy = hands2(p + vec2(0., e)).y - hands2(p - vec2(0., e)).y;
      vec3 n = normalize(vec3(-hx / (2. * e), -hy / (2. * e), 1.));
      // Fine skin grain.
      n = normalize(n + .04 * vec3(vnoise(p * 900.) - .5, vnoise(p * 900. + 7.) - .5, 0.));
      vec3 P = vec3(p, dh.y);
      vec3 Lp = vec3(Lh, .05 + (L.y - L0.y) * 1.4);
      vec3 v = Lp - P;
      float d2 = dot(v, v);
      vec3 l = v * inversesqrt(d2);
      float E = .0011 / pow(d2 + .0008, 1.25) * flick;
      float ndl = dot(n, l);
      // Skin, not a glove: the palm paler, fingertips and creases flushed with blood,
      // with a faint uneven mottling.
      float mot = fbm(p * 45.);
      vec3 albedo = mix(vec3(.86, .5, .38), vec3(.8, .34, .27), .55 * dh.w + .2 * smoothstep(.4, .7, mot));
      albedo = mix(albedo, vec3(.62, .24, .19), .3 * dh.z);
      albedo *= .92 + .16 * fbm(p * 140.);
      vec3 c = albedo * max(ndl, 0.) * E;
      // Subsurface: light wraps round and glows red where the skin is thin, at the edges
      // of the fingers and in the fingertips.
      float wrap = clamp((ndl + .6) / 1.6, 0., 1.);
      float thin = 1. - n.z;
      c += vec3(1., .22, .08) * wrap * (pow(thin, .7) * .75 + .18 * dh.w) * E;
      c += vec3(.9, .32, .16) * wrap * E * .06;
      // Skin's soft, broad sheen, broken up by the pores.
      vec3 hv = normalize(l + vec3(0., 0., 1.));
      c += vec3(1., .86, .72) * pow(max(dot(n, hv), 0.), 18.) * E * .07 * (.6 + .8 * vnoise(p * 600.)) * (1. - .6 * dh.z);
      // Cold sky light, very faint.
      c += vec3(.0025, .0032, .006) * (.4 + .6 * n.z);
      col = mix(col, c, m);
    }
    float srnd;
    float sd = sleeve(p, srnd);
    float sm = smoothstep(pxh * 1.2, -pxh * 1.2, sd);
    if (sm > 0.) {
      float rib = .75 + .25 * sin(abs(p.x) * 900. + p.y * 40.) * smoothstep(-.5, -.45, p.y);
      vec3 cc = vec3(.012, .013, .019) * (.4 + .6 * srnd) * rib * (.8 + .4 * fbm(p * vec2(40., 120.)));
      cc += vec3(.5, .3, .18) * .03 * smoothstep(.12, .0, length(Lh - p) - .3) * srnd;
      col = mix(col, cc, sm);
    }
  }

  // The light itself, with bloom; in the sky it settles into a star.
  float dl = length(uv - (L - vec2(0., cam)));
  float star = smoothstep(.85, 1., rise);
  vec3 lc = mix(vec3(1., .8, .55), vec3(.85, .9, 1.), star);
  float core = exp(-dl / px * mix(.16, .5, star)) * mix(2.2, 1.6, star);
  float bloom = exp(-dl * mix(20., 40., star)) * mix(.32, .12, star) + exp(-dl * 4.) * .05 * (1. - star);
  vec2 sq = abs(uv - (L - vec2(0., cam)));
  float spikes = (exp(-sq.y / px * .7) * exp(-sq.x * 30.) + exp(-sq.x / px * .7) * exp(-sq.y * 30.)) * .25 * star;
  vec3 light = lc * (core + bloom + spikes) * flick;

  // Snow falling between us and the ground; flakes near the light catch it.
  vec3 snow = vec3(0.);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float sc = 6. + fk * 6.;
    vec2 drift = vec2(t * (.12 + fk * .05) + sin(t * .4 + fk) * .2, t * (.5 + fk * .25) + cam * (1. + fk * .5));
    vec2 sp = uv * sc + drift;
    vec2 id = floor(sp), f = fract(sp) - .5;
    float h = hash21(id + fk * 7.);
    if (h < .2) {
      vec2 o = (hash22(id) - .5) * .7;
      float r = mix(.1, .035, fk / 2.);
      float fl = smoothstep(r, r * (k == 0 ? .15 : .6), length(f - o));
      vec2 wp = (id + .5 + o - drift) / sc;
      float lit = exp(-length(wp - (L - vec2(0., cam))) * 6.);
      snow += (vec3(.2, .25, .35) * .2 + vec3(1., .75, .5) * lit) * fl * (k == 0 ? .3 : .55);
    }
  }

  col = (col + snow) * (1. - dim) + light * (1. - dim * .3);
  outColor = finish(col * 1.2 * expo, gl_FragCoord.xy);
}`;
