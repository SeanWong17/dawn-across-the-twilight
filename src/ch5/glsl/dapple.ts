import { PRELUDE } from '../../lib/glsl';

// Looking up through a forest canopy into the late-morning sun (komorebi). Three layers
// of leaves at different depths sway in the wind; light passes green-gold through them
// and pours white through the gaps. When a gap crosses the sun it bursts into a glint.
export const DAPPLE = PRELUDE + `
uniform float expo;

const vec2 SUN = vec2(.32, .2);

// Transmittance (rgb) of one leaf layer at p; blur widens edges for out-of-focus layers.
vec3 leaves(vec2 p, float sc, float seed, float blur, float sway) {
  vec2 g = p * sc;
  vec2 id = floor(g);
  float cover = 0.;
  float vein = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = id + vec2(x, y);
    for (int k = 0; k < 2; k++) {
      vec2 hh = hash22(c * 1.31 + float(k) * 7.7 + seed);
      if (hh.x > .9) continue;
      vec2 ctr = c + hash22(c + float(k) * 3.1 + seed + 1.);
      float ang = hh.y * TAU + .25 * sin(t * (.6 + hh.x) + hh.y * 20.) * sway;
      ctr += .06 * sway * vec2(sin(t * .8 + hh.x * 30.), cos(t * .7 + hh.y * 30.));
      vec2 q = g - ctr;
      q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
      float L = .45 + .3 * hh.x;
      // A pointed leaf: intersection of two offset circles (a vesica), tip at +x.
      float w = L * .42;
      float R = (L * L + w * w) / (2. * w);
      float dv = max(length(q - vec2(0., w - R)), length(q + vec2(0., w - R))) - R;
      float e = smoothstep(blur, -blur, dv / sc * res.y);
      cover = max(cover, e);
      vein = max(vein, e * exp(-abs(q.y) * 60.) * step(abs(q.x), L * .9));
    }
  }
  // Leaves pass about a fifth of the light, tinted green-gold; veins a little less.
  vec3 leafT = vec3(.2, .3, .03) * (1. - .4 * vein) * (.6 + .5 * hash21(id + seed));
  return mix(vec3(1.), leafT, cover);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float rot = t * .006;
  vec2 p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * uv;

  // Sky: hazy white-gold, brightest around the sun.
  float ds = length(uv - SUN);
  vec3 sky = vec3(.62, .6, .42) * (.6 + .5 * smoothstep(1.2, 0., ds)) + vec3(1.6, 1.4, .9) * exp(-ds * 5.) + vec3(6., 5., 3.5) * exp(-ds * 40.);

  // Far canopy (sharp, dense, small), middle, near (large and soft).
  vec3 T = leaves(p + vec2(.0, .0), 9., 1., 1.2, .4);
  T *= leaves(p * 1.02 + vec2(.3, .1), 5.5, 7., 2., .7);
  vec3 Tn = leaves(p * 1.05 + vec2(-.2, .4), 2.6, 13., 9., 1.);
  T *= mix(vec3(1.), Tn * .5, .95);
  // Dark branches across the far layer.
  float br = abs(p.y + .25 * p.x - .1 + .08 * fbm(vec2(p.x * 2., 1.))) - .012 * (1.2 - p.x * .5);
  br = min(br, abs(p.x * .7 - p.y - .35 + .06 * fbm(vec2(p.y * 3., 5.))) - .007 * (1. - p.y));
  T *= mix(vec3(.04, .04, .03), vec3(1.), smoothstep(-.001, .002, br));

  vec3 col = sky * T;

  // The sun's own glint, as strong as the gap in front of it is open.
  vec3 Ts = leaves(SUN, 9., 1., 1.2, .4) * leaves(SUN * 1.02 + vec2(.3, .1), 5.5, 7., 2., .7);
  float open = dot(Ts, vec3(.33));
  vec2 q = uv - SUN;
  float a = atan(q.y, q.x);
  float spikes = pow(abs(cos(a * 3.)), 60.) + pow(abs(cos(a * 3. + .5)), 120.) * .6;
  col += vec3(1., .9, .7) * open * (exp(-ds * 18.) * 1.5 + spikes * exp(-ds * 7.) * .7 + exp(-ds * 3.) * .2);
  // Soft rays radiating from the sun through the humid air.
  float ray = fbm(vec2(a * 6. + .2 * sin(t * .1), t * .05)) * fbm(vec2(a * 14., 3.));
  col += vec3(1., .85, .55) * pow(ray, 2.) * exp(-ds * 1.3) * .35 * (.5 + .5 * open);
  // Lens bloom: a slight green-gold veil over everything.
  col = col * .9 + vec3(.03, .035, .01);

  outColor = finish(col * .9 * expo, gl_FragCoord.xy);
}`;
