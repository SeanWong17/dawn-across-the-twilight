import { PRELUDE } from '../../lib/glsl';

// Towing the Earth to a gentler orbit. The inner solar system seen from above the
// ecliptic: the old orbit, the wider target orbit, and the Earth working its way out
// between them ("move" 0..1). Three asteroids fly by in turn: each crosses the whole
// frame, bends round the Earth's leading side, and at its closest pass the Earth steps
// outward. (gen_music.py build_ch3 places a whoosh at each closest pass, FLY below.)
export const ORBIT = PRELUDE + `
uniform float expo;
uniform float move;

const float A1 = 1.0, A2 = 1.42;
// move at each closest approach, and half the length of one flyby.
const vec3 FLY = vec3(.2, .5, .8);
const float FW = .2;

// How far out the Earth has come: a step at each closest approach.
float outward(float m) {
  vec3 s = smoothstep(FLY - .05, FLY + .07, vec3(m));
  return (s.x + s.y + s.z) / 3.;
}
float earthAng(float m) { return 2.4 + 4.2 * m; }
vec2 earthAt(float m) { float a = earthAng(m); return vec2(cos(a), sin(a)) * mix(A1, A2, outward(m)); }

// Asteroid k at move m, in the ecliptic plane. It travels along the screen's horizontal
// (A), fastest at closest approach, and its path bends round the Earth's leading side.
vec2 rockAt(int k, float m, vec2 A) {
  float u = clamp((m - FLY[k]) / FW, -1.2, 1.2);
  float x = 2.8 * asinh(3.5 * u) / asinh(3.5) * (k == 1 ? -1. : 1.);
  float a = earthAng(FLY[k]);
  vec2 N = vec2(-A.y, A.x);
  N *= sign(dot(N, vec2(-sin(a), cos(a))));
  return earthAt(m) + A * x + N * (.1 + sqrt(.0225 + .16 * x * x) - .15);
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0., 1.));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * res) / res.y;
  // Camera above the ecliptic, slowly circling.
  float el = .42;
  float yaw = .35 + t * .03;
  vec3 ro = vec3(0., sin(el), cos(el)) * 3.6;
  ro.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * ro.xz;
  vec3 fw = normalize(-ro + vec3(.45, 0., 0.));
  vec3 rt = normalize(cross(fw, vec3(0., 1., 0.)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.6 + rt * uv.x + up * uv.y);
  // The screen's horizontal on the ecliptic, at mid-shot (fixed, so the paths don't drift).
  float yaw0 = .44;
  vec2 f0 = normalize(-vec2(sin(yaw0), cos(yaw0)) * cos(el) * 3.6 + vec2(.45, 0.));
  vec2 A = normalize(vec2(-f0.y, f0.x));

  vec3 col = starfield(uv, 60., .1, .5) * .8;
  col += vec3(.02, .025, .04) * fbm(uv * 2.);

  // Point on the ecliptic plane under this pixel.
  float tp = -ro.y / rd.y;
  vec3 gp = ro + rd * tp;
  float r = length(gp.xz);
  float px = .0022 * tp;               // line width scales with distance
  float ang = atan(gp.z, gp.x);

  // Orbits: Venus (faint), the old orbit (dashed), the target orbit (glowing).
  col += vec3(.6, .6, .7) * .2 * exp(-abs(r - .72) / px);
  float dash = step(.5, fract(ang * 18. / TAU * 4.));
  col += vec3(.55, .7, 1.) * .55 * exp(-abs(r - A1) / px) * (.35 + .65 * dash);
  col += vec3(1., .8, .5) * (.4 + .5 * move) * exp(-abs(r - A2) / (px * 1.4));

  // The Earth's path so far, as connected segments.
  vec2 E = earthAt(move);
  float trail = 0.;
  vec2 Pp = E;
  for (int i = 1; i < 48; i++) {
    float f = float(i) / 47.;
    vec2 P = earthAt(move * (1. - f));
    trail = max(trail, exp(-segDist(gp.xz, Pp, P) / (px * 1.2)) * mix(1., .2, f));
    Pp = P;
  }
  col += vec3(.5, .85, 1.) * trail * .9 * step(.001, move);

  // Sun at the origin, projected.
  vec3 sc = -ro;
  float sdist = length(cross(rd, sc));
  col += vec3(1., .82, .55) * (exp(-sdist * 60.) * 3. + exp(-sdist * 9.) * .5 + exp(-sdist * 2.) * .1);

  // The asteroids, each with a fading trail along the stretch of path just flown.
  for (int k = 0; k < 3; k++) {
    if (abs(move - FLY[k]) > FW * 1.15) continue;
    vec2 R = rockAt(k, move, A);
    float tr = 0.;
    vec2 Rp = R;
    for (int j = 1; j < 20; j++) {
      float mm = move - float(j) * .004;
      if (mm < FLY[k] - FW * 1.2) break;
      vec2 P = rockAt(k, mm, A);
      tr = max(tr, exp(-segDist(gp.xz, Rp, P) / (px * .9)) * (1. - float(j) / 20.));
      Rp = P;
    }
    col += vec3(1., .88, .72) * tr * .6;
    vec3 Rw = vec3(R.x, 0., R.y);
    vec3 dR = Rw - ro;
    float dd = length(cross(rd, dR)) / length(dR);
    float rr = .0075;
    if (dd < rr) {
      vec3 n = (rd * dot(dR, rd) - dR) / (rr * length(dR));
      float lit = clamp(dot(normalize(-Rw), n) * .9 + .2, 0., 1.);
      col = mix(col, vec3(.62, .55, .48) * (.1 + 1.6 * lit) * (.8 + .4 * vnoise(n.xy * 6. + float(k))), smoothstep(rr, rr * .7, dd));
    }
    col += vec3(1., .9, .8) * exp(-dd * 320.) * .45;
  }

  // The Earth, as a small lit sphere.
  vec3 Ew = vec3(E.x, 0., E.y);
  vec3 dE = Ew - ro;
  float de = length(cross(rd, dE)) / length(dE);
  float er = .016;
  if (de < er) {
    vec3 n = (rd * dot(dE, rd) - dE) / (er * length(dE));   // offset from centre across the disc
    float lit = clamp(dot(normalize(-Ew), n) * .9 + .25, 0., 1.);
    col = mix(col, vec3(.1, .35, .9) * (.15 + 1.4 * lit), smoothstep(er, er * .8, de));
  }
  col += vec3(.4, .7, 1.) * exp(-de * 120.) * .7;
  // The pull at each closest approach: a brief brightening around the Earth.
  vec3 pk = (vec3(move) - FLY) / .03;
  col += vec3(.6, .8, 1.) * exp(-de * 40.) * dot(exp(-pk * pk), vec3(1.)) * .35;

  outColor = finish(col * expo, gl_FragCoord.xy);
}`;
