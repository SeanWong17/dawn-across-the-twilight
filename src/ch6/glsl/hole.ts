// Shared GLSL: a spinning black hole seen from slightly above its accretion disk, drawn
// in 2D with the familiar lensing look: the near side of the disk crosses in front of
// the shadow, the far side is bent up over the top (and faintly under the bottom), a
// thin photon ring hugs the shadow, and the approaching side (left) is Doppler-brightened.
// Distances are in units of the shadow radius R.
export const HOLE = `
// Disk emission at radius r (units of R) and disk angle a; "feed" scales the supply of
// gas, "starve" (0..1) thins it to sparse cooling clumps.
vec3 diskEm(float r, float a, float feed, float starve) {
  float inner = 1.32;
  float w = smoothstep(inner - .06, inner + .12, r) * smoothstep(6.2, 3.2 - 1.6 * starve, r);
  if (w <= 0.) return vec3(0.);
  // Keplerian shear: inner gas laps the outer.
  float ap = a - t * 1.1 * pow(r, -1.5);
  float n = fbm3(vec3(cos(ap) * 1.6, sin(ap) * 1.6, r * 3.2));
  float fine = vnoise3(vec3(cos(ap) * 5., sin(ap) * 5., r * 14.));
  float streak = .45 + .9 * n * (.7 + .5 * fine);
  // Starving: only the densest clumps remain.
  streak *= mix(1., smoothstep(.45 + .25 * starve, .75 + .1 * starve, n), smoothstep(0., .5, starve));
  float hot = pow(inner / r, 2.3);
  vec3 c = mix(vec3(1., .32, .08), vec3(1., .78, .5), smoothstep(.15, .7, hot));
  c = mix(c, vec3(1., .95, .88), smoothstep(.65, 1., hot));
  c = mix(c, vec3(.9, .16, .05), starve * .7);
  // Doppler beaming: gas on the left comes toward us.
  float dop = 1. + .75 * (-cos(a)) / sqrt(r);
  return c * hot * streak * w * dop * dop * feed * (1. - .9 * starve);
}

// Radiance of the hole at screen offset p from its centre, shadow radius R, view
// squash inc (sin of elevation). "shade" returns how much of the background it hides.
vec3 blackHole(vec2 p, float R, float inc, float feed, float starve, out float shade) {
  float rho = length(p) / R;
  float phi = atan(p.y, p.x);
  vec3 col = vec3(0.);
  // Far side of the disk, lensed into a near-circular arc over the top and under the bottom.
  if (rho > 1.) {
    float top = step(0., p.y);
    float rl = mix(1.25, 1.34, top) + (rho - 1.) * mix(6., 2.6, top);
    float side = smoothstep(.0, .55, abs(sin(phi)));
    col += diskEm(rl, phi, feed, starve) * (.35 + .65 * side) * mix(.4, 1.25, top);
  }
  // The near side of the disk crosses in front of everything.
  vec2 d = vec2(p.x, p.y / inc) / R;
  float r = length(d);
  float a = atan(d.y, d.x);
  float hidden = step(0., p.y) * step(rho, 1.02);
  vec3 em = diskEm(r, a, feed, starve) * (1. - hidden);
  // Disk opacity also hides the shadow where the near side passes over it.
  float cover = clamp(length(em) * 2.5, 0., 1.) * step(p.y, 0.);
  // Shadow, photon ring.
  float sh = smoothstep(1.01, .97, rho);
  shade = max(sh, smoothstep(1.6, 1., rho) * .5);
  col *= 1. - sh;
  float ring = exp(-abs(rho - 1.015) * 90.) * 1.6 + exp(-abs(rho - 1.03) * 18.) * .25;
  col += vec3(1., .72, .45) * ring * (1. + .6 * (-cos(phi))) * (.15 + .85 * feed) * (1. - .75 * starve);
  col = col * (1. - cover * .6) + em;
  return col;
}
`;
