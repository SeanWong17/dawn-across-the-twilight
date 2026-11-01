import { PRELUDE } from '../../lib/glsl';

// A sunshade raised between the Sun and the Earth. We look past the Earth's dark
// limb toward the Sun; the shade is a vast lattice of hexagonal panels that unfolds
// from its hub ("deploy" 0..1) and eclipses part of the Sun, light leaking through
// the seams and streaming round its rim.
export const SHIELD = PRELUDE + `
uniform float expo;
uniform float deploy;

// Hex grid: returns (distance to cell edge, cell id hash) for point p.
vec2 hex(vec2 p, out vec2 cid) {
  const vec2 s = vec2(1., 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + .5) * s);
  vec2 g = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  cid = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? hc.xy : hc.zw + .5;
  vec2 a = abs(g);
  float e = .5 - max(dot(a, s * .5), a.x);
  return vec2(e, hash21(cid));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  vec2 sun = vec2(-.12, .1);
  float sd = length(uv - sun);

  vec3 col = starfield(uv, 60., .08, .5) * .5;
  vec3 sunC = vec3(1.4, 1.2, .95);
  float disc = smoothstep(.205, .2, sd);
  col += sunC * disc * 2.2 + sunC * (exp(-sd * 9.) * .7 + exp(-sd * 3.) * .2);

  // The shade: a slightly foreshortened disc in front of the Sun.
  vec2 sp = (uv - vec2(-.08, .08)) * mat2(cos(.25), -sin(.25), sin(.25), cos(.25));
  sp.x /= .82;
  float R = .36;
  float rr = length(sp) / R;
  vec2 cid;
  vec2 hx = hex(sp * 26., cid);
  float cr = length(cid * vec2(1., 1.7320508) / 26.) / R;
  // Panels lock into place in a ring sweeping outward from the hub.
  float front = deploy * 1.15;
  float placed = step(cr + hx.y * .08, front) * step(rr, 1.);
  float fresh = exp(-max(front - cr, 0.) * 18.) * placed;
  float seam = smoothstep(.06, .0, hx.x);
  if (placed > 0.) {
    vec3 panel = vec3(.012, .013, .018) + vec3(.025, .03, .04) * hx.y + vec3(.05, .05, .06) * smoothstep(.6, -.6, sp.x + sp.y);
    // Light leaking through the seams, strongest where the Sun is behind.
    vec3 behind = sunC * (disc * 2.2 + exp(-sd * 9.) * .7);
    panel += behind * seam * .6;
    panel += vec3(.9, .95, 1.) * fresh * (.6 + seam);
    col = mix(col, panel, .97);
  }
  // Light streaming round the shade's rim once it covers the Sun.
  float outside = smoothstep(.98, 1.02, rr) * smoothstep(.0, .2, deploy - .7);
  float rays = .5 + .5 * fbm(vec2(atan(sp.y, sp.x) * 8., t * .05));
  col += sunC * exp(-(rr - 1.) * 7.) * outside * rays * .5;
  // Rim of the finished shade and its spokes.
  float rim = exp(-abs(rr - 1.) * 120.) * smoothstep(.9, 1., deploy);
  col += vec3(1., .85, .65) * rim * 1.2;
  float spokes = exp(-abs(sin(atan(sp.y, sp.x) * 3.)) * 120.) * step(rr, min(front, 1.)) * .25;
  col += vec3(.8, .85, 1.) * spokes;
  col += vec3(1., .9, .7) * exp(-length(sp) * 60.) * .8;   // hub

  // Earth's night side in the foreground, its atmosphere backlit.
  vec2 ep = uv - vec2(.78, -.86);
  float er = length(ep);
  float ER = .62;
  float edge = er - ER;
  float body = smoothstep(.002, -.002, edge);
  vec3 earth = vec3(.006, .008, .014);
  float lightsN = smoothstep(.72, .85, fbm(ep * 30.)) * smoothstep(-.02, -.12, edge);
  earth += vec3(1., .7, .38) * lightsN * .25;
  col = mix(col, earth, body);
  vec2 toSun = normalize(sun - vec2(.78, -.86));
  float facing = .4 + .6 * max(dot(normalize(ep), toSun), 0.);
  col += vec3(.35, .6, 1.) * exp(-abs(edge) * 160.) * facing * 1.6;
  col += vec3(.5, .7, 1.) * exp(-max(edge, 0.) * 40.) * facing * .2 * (1. - body);

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
