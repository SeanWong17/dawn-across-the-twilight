import { PRELUDE } from '../../lib/glsl';

// A lone probe under a square light sail crossing interstellar space. Dust grains stream
// past; the destination star ahead (right) slowly grows from a point into a sun with a
// planet beside it as "arrive" goes 0..1. Time is compressed: the starfield wheels
// slowly as centuries pass.
export const VOYAGE = PRELUDE + `
uniform float expo;
uniform float arrive;

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  float px = 1.5 / res.y;
  vec3 col = vec3(.002, .003, .007);
  // A faint galactic band and background stars drifting with the slow parallax of ages.
  vec2 g = uv + vec2(t * .004, 0.);
  col += vec3(.05, .05, .08) * exp(-pow((g.y - .18 + .25 * g.x) / .22, 2.)) * fbm(g * 3. + 1.) * 1.2;
  col += starfield(g, 60., .14, .6) * .9;
  col += starfield(g * 2.1 + 5.3, 150., .3, 1.) * .3;

  // Destination star ahead.
  float ar = arrive * arrive;
  vec2 dst = vec2(.62, .1);
  float dd = length(uv - dst);
  float R = mix(.0, .055, ar);
  vec3 star = vec3(1., .85, .65);
  col += star * (exp(-dd * mix(140., 18., ar)) * mix(.6, 1.3, ar) + exp(-dd * 4.) * .08 * ar);
  // Diffraction spikes.
  vec2 dq = abs(uv - dst);
  col += star * (exp(-dq.y * 900.) + exp(-dq.x * 900.)) * exp(-dd * 9.) * mix(.15, .5, ar);
  col = mix(col, star * 2.2, smoothstep(R + px, R - px, dd) * step(.001, R));
  // A planet catching its light, appearing late.
  vec2 pl = dst + vec2(-.13, -.06) * mix(.3, 1., ar);
  float pr = .016 * ar;
  float pd = length(uv - pl);
  if (pd < pr) {
    vec2 n2 = (uv - pl) / pr;
    vec3 nrm = vec3(n2, sqrt(max(0., 1. - dot(n2, n2))));
    float lit = max(0., dot(nrm, normalize(vec3(1., .4, .3))));
    col = mix(col, vec3(.2, .4, .7) * lit * 1.2 + vec3(.01), smoothstep(.95, .9, length(n2)) * smoothstep(.2, .6, arrive));
  }

  // The probe: a square light sail on four diagonal booms, slowly spinning, seen in 3/4
  // view. Its mirrored face points back toward home (behind the camera) and carries a
  // reflection of the Sun left behind; the payload hangs on that side on four shrouds.
  vec3 rd = normalize(vec3(uv, 1.6));
  vec3 C = vec3(-.6 + .02 * sin(t * .1), -.02, 3.);
  vec3 n = normalize(vec3(-.62, .12, -1.) + .03 * vec3(sin(t * .23), cos(t * .19), 0.));
  vec3 tu = normalize(cross(n, vec3(0., 1., 0.)));
  vec3 tv = cross(tu, n);
  float spin = t * .045 + .3;
  vec3 eu = tu * cos(spin) + tv * sin(spin), ev = -tu * sin(spin) + tv * cos(spin);
  const float S = .42;
  vec3 homeDir = normalize(vec3(-.35, .12, -1.));
  float hitT = dot(C, n) / dot(rd, n);
  vec3 hp = rd * hitT - C;
  float sa = dot(hp, eu), sb = dot(hp, ev);
  // Edges sag inward between the corners, the way a tensioned membrane does.
  float edge = max(abs(sa) + .035 * (1. - pow(sb / S, 2.)), abs(sb) + .035 * (1. - pow(sa / S, 2.))) - S;
  float aa = fwidth(edge) * 1.2;
  float sm = smoothstep(aa, -aa, edge) * step(0., hitT);
  if (sm > 0.) {
    // Four panels meeting at the booms, each with fine radial wrinkles and a slight billow.
    float ang = atan(sb, sa);
    float wr = fbm(vec2(ang * 40., length(vec2(sa, sb)) * 6.)) - .5;
    float quad = floor((ang + PI / 4.) / (PI / 2.));
    vec3 nn = normalize(n + eu * (wr * .05 + .03 * sin(quad * 2.1)) + ev * (.04 * (fbm(vec2(sa, sb) * 9. + quad) - .5)));
    float spec = pow(max(dot(reflect(rd, nn), homeDir), 0.), 60.);
    float sheen = pow(max(dot(reflect(rd, nn), homeDir), 0.), 8.);
    // A mirror: mostly black, reflecting the dark sky, with a travelling glint of the home
    // Sun and soft bands where the wrinkles catch it.
    float band = pow(.5 + .5 * sin((sa * .8 + sb) * 9. + wr * 6. + t * .15), 6.);
    vec3 film = vec3(.012, .014, .02) * (.7 + .6 * fbm(vec2(sa, sb) * 30.));
    film += vec3(.35, .38, .5) * band * .06;
    film += vec3(1., .86, .7) * (spec * 2.2 + sheen * .05);
    // The destination star glowing through the thin membrane toward its leading edge.
    film += star * .06 * (.3 + ar) * smoothstep(-S, S, hp.x);
    // Booms along the diagonals and the tensioned rim.
    float boom = min(abs(sa - sb), abs(sa + sb)) * .7071;
    float bw = fwidth(sa) * 1.5;
    film = mix(film, vec3(.42, .42, .46), smoothstep(bw + .0018, .0018, boom) * .6);
    film += vec3(.7, .8, 1.) * smoothstep(aa * 2., 0., abs(edge + aa * 2.)) * .18;
    col = mix(col, film, sm);
  }
  // Corner tips catch the starlight.
  vec2 corner[4];
  for (int k = 0; k < 4; k++) {
    float sx = k == 0 || k == 3 ? 1. : -1., sy = k < 2 ? 1. : -1.;
    vec3 cw = C + (eu * sx + ev * sy) * S;
    corner[k] = cw.xy / cw.z * 1.6;
    col += vec3(.8, .9, 1.) * exp(-length(uv - corner[k]) * 1500.) * .8;
  }
  // Payload on the home side, joined to the corners by shroud lines.
  vec3 pw = C + n * .1;
  vec2 pay = pw.xy / pw.z * 1.6;
  float shroud = 1e3;
  for (int k = 0; k < 4; k++) {
    vec2 pa = uv - pay, ba = corner[k] - pay;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    shroud = min(shroud, length(pa - ba * h));
  }
  col += vec3(.55, .6, .7) * exp(-shroud * res.y * .9) * .22;
  // Bus: a small faceted body with a dish antenna turned back toward home.
  vec2 bq = (uv - pay) / 1.6;
  float bus = max(abs(bq.x) - .009, abs(bq.y) - .006);
  bus = min(bus, max(abs(bq.x + .004) - .003, abs(bq.y) - .011));
  float bm = smoothstep(1.5 / res.y, -1.5 / res.y, bus);
  col = mix(col, vec3(.07, .07, .08) + vec3(.5, .45, .4) * step(bq.y, -.002) * .15, bm);
  col += vec3(1., .9, .75) * smoothstep(3. / res.y, 0., abs(bus)) * step(bq.x, 0.) * .5;
  vec2 dsq = bq - vec2(-.014, .002);
  float dish = length(dsq / vec2(.0045, .011)) - 1.;
  col = mix(col, vec3(.25, .26, .3), smoothstep(.15, -.15, dish));
  col += vec3(1., .9, .75) * exp(-abs(dish) * 30.) * smoothstep(0., .01, -dsq.x + .003) * .25;
  // Beacon on the bus (its pulse is matched in the score).
  float beacon = .5 + .5 * sin(t * 2.);
  vec2 bc = (bq - vec2(.009, .006)) * 1.6;
  col += vec3(.4, .8, 1.) * (exp(-length(bc) * 900.) * 1.5 + exp(-length(bc) * 120.) * .06) * (.4 + 2. * pow(beacon, 20.));

  // Interstellar dust streaming past: short streaks moving leftward.
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float sc = 6. + fl * 5.;
    vec2 dp = uv * vec2(1., sc / 2.) * vec2(sc / 6., 1.) + vec2(t * (1.5 + fl), fl * 7.);
    vec2 id = floor(dp), f = fract(dp) - .5;
    float h = hash21(id + fl * 13.);
    if (h < .12) {
      float y = (hash11(h * 31.) - .5) * .7;
      float streak = exp(-pow((f.y - y) * 30., 2.)) * smoothstep(.1, -.4, f.x) * smoothstep(-.5, -.35, f.x);
      col += vec3(.5, .6, .8) * streak * (.025 + .03 * fl);
    }
  }

  outColor = finish(col * 1.2 * expo, gl_FragCoord.xy);
}`;
