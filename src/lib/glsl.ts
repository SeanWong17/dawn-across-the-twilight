// Shared GLSL prelude: hashing, noise, fbm, tonemapping and film finishing.
export const PRELUDE = `#version 300 es
precision highp float;
uniform float t;
uniform vec2 res;
out vec4 outColor;

#define PI 3.14159265
#define TAU 6.2831853

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3. - 2. * f);
  float n000 = hash21(i.xy + i.z * 17.17), n100 = hash21(i.xy + vec2(1, 0) + i.z * 17.17);
  float n010 = hash21(i.xy + vec2(0, 1) + i.z * 17.17), n110 = hash21(i.xy + vec2(1, 1) + i.z * 17.17);
  float n001 = hash21(i.xy + (i.z + 1.) * 17.17), n101 = hash21(i.xy + vec2(1, 0) + (i.z + 1.) * 17.17);
  float n011 = hash21(i.xy + vec2(0, 1) + (i.z + 1.) * 17.17), n111 = hash21(i.xy + vec2(1, 1) + (i.z + 1.) * 17.17);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm(vec2 p) {
  float a = .5, s = 0.;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= .5; }
  return s;
}
float fbm3(vec3 p) {
  float a = .5, s = 0.;
  for (int i = 0; i < 5; i++) { s += a * vnoise3(p); p = p * 2.02 + vec3(5.1, 1.3, 7.7); a *= .5; }
  return s;
}

// Point-like stars on a grid; density 0..1, returns radiance.
vec3 starfield(vec2 uv, float scale, float density, float twinkle) {
  vec2 g = uv * scale;
  vec2 id = floor(g), f = fract(g) - .5;
  vec3 col = vec3(0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y);
    vec2 cid = id + o;
    float h = hash21(cid);
    if (h > density) continue;
    vec2 pos = o + (hash22(cid) - .5) * .8 - f;
    float d = length(pos) / scale * res.y * .9;
    float mag = pow(hash11(h * 91.7), 6.);
    float tw = 1. + twinkle * sin(t * (2. + 4. * hash11(h * 13.)) + h * 50.) * .35;
    float temp = hash11(h * 47.3);
    vec3 tint = mix(vec3(1., .78, .6), vec3(.7, .82, 1.), temp);
    col += tint * (exp(-d * d * 1.6) * (.08 + 2.6 * mag) + exp(-d * .9) * mag * .2) * tw;
  }
  return col;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.);
}

// Tonemap, vignette, grain, dithering. Called last in every shot.
vec4 finish(vec3 c, vec2 frag) {
  vec2 q = frag / res;
  c = aces(c);
  float v = pow(16. * q.x * q.y * (1. - q.x) * (1. - q.y), .22);
  c *= mix(.55, 1., v);
  c = pow(c, vec3(1. / 2.2));
  float g = hash21(frag + fract(t * 7.13) * 431.) - .5;
  c += g * .035;
  return vec4(clamp(c, 0., 1.), 1.);
}
`;
