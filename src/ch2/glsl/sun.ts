import { PRELUDE } from '../../lib/glsl';

// The Sun up close: granulated photosphere with limb darkening, sunspots, prominences
// and a streamered corona. "bright" (0..1) swells and whitens it until the frame
// burns out.
export const SUN = PRELUDE + `
uniform float expo;
uniform float bright;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float R = mix(.34, .4, bright);
  vec2 c = vec2(.05, 0.);
  vec2 p = (uv - c) / R;
  float r = length(p);
  vec3 col = vec3(0.);

  vec3 hot = mix(vec3(1., .55, .2), vec3(1., .92, .8), bright);
  if (r < 1.) {
    vec3 n = vec3(p, sqrt(1. - r * r));
    float a = t * .02;
    vec3 q = vec3(n.x * cos(a) - n.z * sin(a), n.y, n.x * sin(a) + n.z * cos(a));
    // Granulation: bright cells with dark lanes, plus larger supergranule mottling.
    float g = vnoise3(q * 60. + vec3(0., 0., t * .4));
    g = .55 + .45 * smoothstep(.2, .8, g);
    float sg = .8 + .2 * fbm3(q * 9. + t * .03);
    float spots = smoothstep(.62, .7, fbm3(q * 4. + 11.)) * smoothstep(.3, .2, abs(q.y - .15));
    float mu = n.z;
    float limb = .35 + .65 * pow(mu, .6);
    col = hot * 2.4 * g * sg * limb;
    col *= 1. - .85 * spots * (1. - bright * .6);
    col = mix(col, vec3(1., .6, .25) * 1.6, (1. - mu) * .3 * (1. - bright));
  }
  // Corona and streamers.
  float ang = atan(p.y, p.x);
  float str = .5 + .5 * fbm(vec2(ang * 3., t * .03));
  float cor = exp(-(r - 1.) * mix(5.5, 3., bright)) * step(1., r);
  col += hot * cor * (.25 + .55 * str) * mix(1., 2.2, bright);
  // Prominences: thin loops of plasma above the limb.
  float pr = smoothstep(.62, .78, fbm(vec2(ang * 9., r * 14. - t * .15))) * exp(-(r - 1.) * 18.) * step(1., r);
  col += vec3(1., .35, .12) * pr * 1.6 * (1. - bright * .7);
  col += hot * exp(-r * 1.2) * .25;

  // Overexposure as the Sun brightens: the frame burns toward white.
  float burn = smoothstep(.82, 1., bright);
  col *= mix(1., 3.5, burn);
  col += vec3(1., .95, .88) * burn * burn * 1.5;
  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
