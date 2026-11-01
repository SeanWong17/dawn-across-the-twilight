import { PRELUDE } from '../../lib/glsl';

// Recasting the Sun. A ring of collector stations circles the star; beams from the
// ring heat its poles and plasma is drawn off in two twisting jets ("lift" 0..1).
// "shrink" (0..1) turns the lightened Sun into a smaller, deep-red dwarf inside the
// same ring.
export const LIFT = PRELUDE + `
uniform float expo;
uniform float lift;
uniform float shrink;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 c = vec2(.02, 0.);
  float k = smoothstep(0., 1., shrink);
  float R = mix(.27, .13, k);
  vec2 p = (uv - c) / R;
  float r = length(p);

  vec3 hot = mix(vec3(1., .55, .2), vec3(1., .26, .07), k);
  vec3 col = starfield(uv, 60., .08, .5) * .6;

  if (r < 1.) {
    vec3 n = vec3(p, sqrt(1. - r * r));
    float a = t * .02;
    vec3 q = vec3(n.x * cos(a) - n.z * sin(a), n.y, n.x * sin(a) + n.z * cos(a));
    float g = .6 + .4 * smoothstep(.2, .8, vnoise3(q * mix(55., 30., k) + vec3(0., 0., t * .3)));
    float sg = .8 + .2 * fbm3(q * 7. + t * .03);
    float mu = n.z;
    col = hot * mix(1.55, 1.5, k) * g * sg * (.3 + .7 * pow(mu, .6));
    // Heated polar caps where the beams strike.
    col += vec3(1., .9, .75) * exp(-(1. - abs(n.y)) * 14.) * lift * (1. - k * .6) * 1.5;
  }
  float ang = atan(p.y, p.x);
  col += hot * exp(-max(r - 1., 0.) * mix(5., 8., k)) * step(1., r) * (.35 + .3 * fbm(vec2(ang * 3., t * .05))) * mix(1., .6, k);
  col += hot * exp(-length(uv - c) * mix(2.5, 4., k)) * .2;

  // Polar jets: plasma pulled off and spiralling away up and down the axis.
  for (int s = -1; s <= 1; s += 2) {
    float fs = float(s);
    float y = (uv.y - c.y) * fs - R * .9;
    if (y > 0.) {
      float w = R * (.18 + y * .9);
      float twist = sin(y * 22. - t * 3. * fs) * w * .35;
      float x = uv.x - c.x - twist;
      float core = exp(-pow(x / w, 2.) * 3.);
      float stream = .5 + .5 * fbm(vec2(x / w * 2., y * 14. - t * 2.2));
      col += mix(vec3(1., .75, .45), vec3(1., .45, .2), smoothstep(0., .5, y)) * core * stream * exp(-y * 2.6) * lift * 1.6;
    }
  }

  // The collector ring: a tilted ellipse of stations, front half over the star.
  vec2 rp = uv - c;
  rp = mat2(cos(.12), -sin(.12), sin(.12), cos(.12)) * rp;
  float RR = .46;
  vec2 e = rp / vec2(RR, RR * .22);
  float er = length(e);
  float band = exp(-abs(er - 1.) * 70.);
  bool front = rp.y < 0.;
  float behind = (!front && r < 1.) ? 0. : 1.;
  float stations = pow(.5 + .5 * sin(atan(e.y, e.x) * 36.), 30.);
  col += vec3(.75, .85, 1.) * band * (.35 + 1.2 * stations) * behind * smoothstep(0., .4, lift + k);
  // Beams from the ring stations to the poles.
  for (int i = 0; i < 8; i++) {
    float fa = float(i) / 8. * TAU + t * .05;
    vec2 st = c + mat2(cos(-.12), -sin(-.12), sin(-.12), cos(-.12)) * vec2(cos(fa) * RR, sin(fa) * RR * .22);
    vec2 pole = c + vec2(0., (sin(fa) > 0. ? 1. : -1.) * R * .95);
    vec2 ba = pole - st, pa = uv - st;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    float d = length(pa - ba * h);
    col += vec3(.7, .85, 1.) * exp(-d * 900.) * .45 * lift * (1. - k * .7);
  }

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
