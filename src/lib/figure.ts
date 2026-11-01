// The stargazer from chapter 1: a person in profile facing left, unit height, feet on
// y = 0. k (0..1) raises the near arm toward the sky.
export const FIGURE = `
float sdSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float smin(float a, float b, float k) {
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

// A person in profile facing left, standing with feet apart, head tipped back toward
// the sky. Unit height, feet on y = 0.
float figure(vec2 p, float k) {
  // Legs in trousers: front leg forward, back leg behind, sky visible between them.
  float lf = min(sdSeg(p, vec2(-.005, .5), vec2(-.06, .27), .057, .042), sdSeg(p, vec2(-.06, .27), vec2(-.1, .04), .038, .029));
  float lb = min(sdSeg(p, vec2(.015, .5), vec2(.06, .27), .057, .042), sdSeg(p, vec2(.06, .27), vec2(.1, .04), .038, .029));
  float feet = min(sdSeg(p, vec2(-.095, .022), vec2(-.155, .014), .024, .016), sdSeg(p, vec2(.105, .022), vec2(.05, .014), .024, .016));
  float d = min(min(lf, lb), feet);
  // Short jacket over the torso, slightly arched back as the person looks up.
  float torso = sdSeg(p, vec2(.008, .52), vec2(.012, .76), .07, .084);
  float chest = (length((p - vec2(.006, .72)) / vec2(.09, .085)) - 1.) * .085;
  d = smin(d, min(torso, chest), .02);
  // Far arm hangs at the side, mostly hidden by the torso.
  float armB = min(sdSeg(p, vec2(.02, .77), vec2(.045, .62), .029, .024), sdSeg(p, vec2(.045, .62), vec2(.035, .49), .024, .02));
  d = smin(d, armB, .01);
  // Near arm rises forward from the side and points up at the galaxy.
  vec2 sh = vec2(.008, .775);
  float a1 = radians(mix(-95., -219., k)), a2 = radians(mix(-100., -238., k));
  vec2 el = sh + .17 * vec2(cos(a1), sin(a1));
  vec2 hd = el + .16 * vec2(cos(a2), sin(a2));
  float armF = min(sdSeg(p, sh, el, .032, .026), sdSeg(p, el, hd, .026, .019));
  armF = min(armF, length(p - hd - .014 * vec2(cos(a2), sin(a2))) - .021);
  d = smin(d, armF, .012);
  // Neck leaning back, head tilted so the face points up and forward.
  d = smin(d, sdSeg(p, vec2(.012, .8), vec2(.03, .87), .03, .028), .015);
  vec2 hc = p - vec2(.035, .925);
  float ang = .7;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = R * hc;
  float head = (length(q / vec2(.063, .054)) - 1.) * .054;
  d = smin(d, head, .008);
  return d;
}
`;
