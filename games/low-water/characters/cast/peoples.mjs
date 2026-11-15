// The Quota's peoples and classes (design/quota/01-WORLD.md; the author's direction of 2026-10-22: more
// differentiating features, so the player can read the racism, the classism and the conflicts).
//
// A people is a RANGE, not a face: each trait has a low and a high end, and every person sits somewhere
// inside it, seeded by their id, so two Hesh look related and not cloned. The ranges draw on ordinary
// human variation and are mixed on purpose so no people maps onto one real group as a package.
// Hard line: no feature from real-world racist caricature (no hooked nose, no exaggerated lips, no
// slanted-eye shorthand, no heavy simian brow). Caricature belongs to the in-world posters only; the
// people the player meets stay specific and dignified. Nose hook is capped low for everyone.
//
// A class is a separate set of marks laid over any people: teeth, weather in the skin, a scar, the
// famine winter's hollows (by who eats), posture, hands, and the wear of the clothes.

// ---- seeded variation ----
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
export function rng(seed) { let a = hash(seed) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t, mix3 = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// ---- the peoples: [low, high] for every face trait, then colour, hair and build ----
// Face trait names are cast/parts.mjs head() options; nose is [length, width, droop, hook].
export const PEOPLES = {
  // The plain's majority: long faces, deep-set eyes under a firm brow, a long straight or high-bridged
  // nose, thin to middling lips, a long jaw; fair skin that burns and reddens in the field; mouse,
  // sandy, red-brown to dark hair, straight to a little wavy; tall and raw-boned. Age reddens the cheeks,
  // greys early, and brings jowls.
  tarn: { name: "Tarn",
    face: { faceLen: [1.02, 1.15], skullX: [0.9, 1.0], skullY: [1.0, 1.06], skullZ: [0.94, 1.0], jaw: [0.95, 1.2], jawCorners: [0.3, 0.9], chin: [1.0, 1.2],
      cheekbones: [0, 0.35], cheekR: [0.8, 1.0], eyes: [0.88, 0.98], eyeX: [0.95, 1.0], socket: [1.1, 1.5], lids: [0.35, 0.55], browT: [0.8, 1.15], browW: [1.0, 1.15],
      noseL: [0.058, 0.07], noseW: [0.018, 0.023], noseD: [0.15, 0.3], noseH: [0, 0.1], bridge: [0, 0.2], bulb: [0.95, 1.15], lips: [0.7, 0.9], mouth: [0.85, 1.0] },
    skin: [[0.9, 0.73, 0.63], [0.8, 0.58, 0.47]], weather: [0.05, 0.17, 0.21], flush: [0.06, -0.07, -0.07],
    hair: [[0.55, 0.42, 0.28], [0.4, 0.31, 0.22], [0.3, 0.2, 0.13], [0.44, 0.23, 0.13], [0.16, 0.12, 0.09]], hairTex: [0, 0.2], greyAt: 45,
    build: { h: [1.72, 1.86], shoulder: [0.19, 0.23] }, age: { lines: 0.5, jowls: 0.6, flush: 0.5 } },
  // Hill herders: a broader, shorter face, high wide cheekbones, large wide-set eyes under thick straight
  // brows, a straight nose with a lower, wider bridge and a rounded tip, fuller lips; olive-tan to warm
  // brown skin that darkens in the wind and reddens over the cheekbones; black to very dark brown hair,
  // thick and wavy, always braided (men down the back, women over the shoulder); compact and strong.
  // Age carves deep lines from squinting at weather and greys the braid early.
  hesh: { name: "Hesh",
    face: { faceLen: [0.94, 1.04], skullX: [1.0, 1.08], skullY: [0.96, 1.02], skullZ: [0.96, 1.02], jaw: [0.95, 1.1], jawCorners: [0.2, 0.6], chin: [0.9, 1.05],
      cheekbones: [0.6, 1.0], cheekR: [0.9, 1.1], eyes: [1.0, 1.12], eyeX: [1.04, 1.1], socket: [0.6, 0.9], lids: [0.25, 0.4], browT: [1.0, 1.25], browW: [1.0, 1.12],
      noseL: [0.045, 0.056], noseW: [0.022, 0.027], noseD: [0.1, 0.2], noseH: [0, 0.04], bridge: [0.3, 0.6], bulb: [1.0, 1.15], lips: [0.95, 1.1], mouth: [0.95, 1.05] },
    skin: [[0.79, 0.61, 0.47], [0.63, 0.45, 0.33]], weather: [0.12, 0.15, 0.18], flush: [0.07, -0.02, -0.04],
    hair: [[0.07, 0.06, 0.05], [0.12, 0.09, 0.07], [0.18, 0.12, 0.08]], hairTex: [0.35, 0.65], greyAt: 38,
    build: { h: [1.66, 1.78], shoulder: [0.19, 0.22] }, age: { lines: 0.9, jowls: 0.2, flush: 0.2 } },
  // Refugees from the Vellmark (era 4): an oval face with a narrower jaw and a defined chin, almond eyes
  // set level under arched brows, a long straight nose with a narrow high bridge, middling lips; skin a
  // shade darker, warm brown to deep brown; black hair in tight curls, the men cropped and bearded, the
  // women under the Deep Well's scarf; slender. Age greys the temples and the beard first.
  vell: { name: "Vell",
    face: { faceLen: [1.04, 1.12], skullX: [0.92, 0.98], skullY: [1.02, 1.08], skullZ: [0.96, 1.0], jaw: [0.85, 0.98], jawCorners: [0, 0.3], chin: [1.0, 1.12],
      cheekbones: [0.3, 0.6], cheekR: [0.85, 0.95], eyes: [0.98, 1.08], eyeX: [0.98, 1.03], socket: [1.0, 1.2], lids: [0.35, 0.5], browT: [0.9, 1.15], browW: [0.95, 1.05],
      noseL: [0.06, 0.07], noseW: [0.018, 0.022], noseD: [0.1, 0.25], noseH: [0, 0.08], bridge: [0, 0.15], bulb: [0.9, 1.05], lips: [0.9, 1.05], mouth: [0.9, 1.0] },
    skin: [[0.66, 0.48, 0.36], [0.45, 0.31, 0.22]], weather: [0.1, 0.11, 0.1], flush: [0.04, -0.01, -0.02],
    hair: [[0.05, 0.045, 0.045], [0.09, 0.07, 0.06]], hairTex: [0.75, 1.0], greyAt: 42,
    build: { h: [1.72, 1.84], shoulder: [0.17, 0.2] }, age: { lines: 0.7, jowls: 0.2, flush: 0.1 } },
};
const TRAITS = Object.keys(PEOPLES.tarn.face);

// Sample one person's place in a people's range (seeded), or blend two people for a mixed person: each
// trait leans toward one side or the other around w, so a Haldane child carries some of each.
export function sample(people, seed, pin = {}) {
  const P = typeof people === "string" ? PEOPLES[people] : people, r = rng(seed), f = {};
  for (const k of TRAITS) { const [lo, hi] = P.face[k], t = pin[k] ?? r(); f[k] = lerp(lo, hi, t); }
  return { f, skinT: pin.skin ?? r(), hairI: pin.hair ?? Math.floor(r() * P.hair.length), texT: r(), hT: r(), sT: r(), people: P };
}
// A child of two sampled parents: per trait a weight near w (0 all A, 1 all B), seeded by the child.
export function inherit(A, B, seed, w = 0.5) {
  const r = rng(seed), f = {};
  for (const k of TRAITS) f[k] = lerp(A.f[k], B.f[k], clamp(w + (r() - 0.5) * 0.8));
  const ws = clamp(w + (r() - 0.5) * 0.4), dark = r() < 0.7 ? (luma(hairOf(A)) < luma(hairOf(B)) ? A : B) : (r() < 0.5 ? A : B);
  return { f, skin: mix3(skinOf(A), skinOf(B), ws), hairC: hairOf(dark), tex: lerp(texOf(A), texOf(B), ws), hT: lerp(A.hT, B.hT, ws), sT: lerp(A.sT, B.sT, ws),
    people: { ...A.people, weather: mix3(A.people.weather, B.people.weather, ws), flush: mix3(A.people.flush, B.people.flush, ws), greyAt: lerp(A.people.greyAt, B.people.greyAt, ws), age: A.people.age, build: A.people.build } };
}
const luma = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const skinOf = (S) => S.skin || mix3(S.people.skin[0], S.people.skin[1], S.skinT);
const hairOf = (S) => S.hairC || S.people.hair[S.hairI % S.people.hair.length];
const texOf = (S) => S.tex ?? lerp(S.people.hairTex[0], S.people.hairTex[1], S.texT);

// ---- the classes: marks over any people ----
// teeth: good | fair | bad (+ gaps); weather 0..1 (skin, lines); hunger 0..1 (the famine winter's
// hollows: who eats); stoop added (labour bends the back, a desk bends the neck, an officer stands
// straight); hands: chapped | worked | soft; wear: patched | handdown | worn | good.
export const CLASSES = {
  cottar:  { name: "cottar", teeth: "bad", gaps: 1, weather: 0.9, hunger: 0.6, stoop: 6, hands: "chapped", wear: "patched" },
  hand:    { name: "hill hand", teeth: "fair", gaps: 0, weather: 1.0, hunger: 0.55, stoop: 3, hands: "chapped", wear: "patched" },
  smith:   { name: "tradesman", teeth: "fair", gaps: 0, weather: 0.6, hunger: 0.35, stoop: 4, hands: "worked", wear: "worn" },
  militia: { name: "militia", teeth: "bad", gaps: 1, weather: 0.7, hunger: 0.1, stoop: 2, hands: "worked", wear: "worn", scar: true },
  clerk:   { name: "clerk", teeth: "fair", gaps: 0, weather: 0.15, hunger: 0.3, stoop: 10, hands: "soft", wear: "worn" },
  officer: { name: "official", teeth: "good", gaps: 0, weather: 0.35, hunger: 0.2, stoop: 1, hands: "soft", wear: "good" },
  arlen:   { name: "Directorate", teeth: "good", gaps: 0, weather: 0.05, hunger: 0, stoop: -2, hands: "soft", wear: "good" },
};
const TEETH = { good: [0.9, 0.87, 0.79], fair: [0.82, 0.75, 0.6], bad: [0.6, 0.5, 0.34] };

// ---- resolve: a sampled (or inherited) person, a class, a sex and an age to the maker's spec parts ----
// Returns { face, palette, P (height and shoulders), hairTex, wear, handMat }. The caller's own face
// overrides (the character's one idea) are laid on after and must stay inside human variation.
export function resolve(S, cls, { sex = "m", age = 40 } = {}) {
  const C = typeof cls === "string" ? CLASSES[cls] : cls, f = S.f, pp = S.people, child = age < 16;
  const weather = clamp((child ? 0.4 : 1) * C.weather + (age > 40 ? (age - 40) / 80 : 0));
  const base = skinOf(S), sk = base.map((x, i) => clamp(x * (1 - pp.weather[i] * weather))), fl = 0.5 + 0.5 * weather + (age > 50 ? pp.age.flush * 0.5 : 0);
  const cheek = sk.map((x, i) => clamp(x + pp.flush[i] * fl)), grey = clamp((age - pp.greyAt) / 30), hc = mix3(hairOf(S), [0.74, 0.72, 0.68], grey);
  const hands = C.hands === "chapped" ? sk.map((x, i) => clamp(x * [1.0, 0.86, 0.82][i])) : C.hands === "worked" ? sk.map((x, i) => clamp(x * [0.98, 0.92, 0.9][i])) : sk;
  const col = (c, k = 0.9) => ({ c, v: +(luma(c) * k).toFixed(3) });
  const woman = sex === "f", hunger = clamp(C.hunger * (child ? 1.1 : 1)), lines = (age > 30 ? Math.min(1, (age - 30) / 40) * pp.age.lines : 0) + weather * 0.25;
  const face = { faceLen: f.faceLen, skull: [f.skullX, f.skullY, f.skullZ], jaw: f.jaw * (woman ? 0.88 : 1), jawCorners: f.jawCorners * (woman ? 0.5 : 1), chin: f.chin * (woman ? 0.95 : 1),
    cheekbones: clamp(f.cheekbones + hunger * 0.4, 0, 1.2), cheekR: f.cheekR * (1 - hunger * 0.15), eyes: f.eyes * (woman ? 1.04 : 1), eyeX: f.eyeX, socket: f.socket + hunger * 0.3, lids: f.lids,
    browT: f.browT * (woman ? 0.75 : 1), browW: f.browW * (woman ? 0.9 : 1), ...(woman ? { browShape: "arch" } : {}),
    nose: [f.noseL * (woman ? 0.92 : 1), f.noseW * (woman ? 0.92 : 1), f.noseD, Math.min(0.12, f.noseH)], bridge: f.bridge, bulb: f.bulb, lips: f.lips * (woman ? 1.05 : 1), mouth: f.mouth,
    lines: +lines.toFixed(2), ...(age > 45 && pp.age.jowls ? { jowls: +(pp.age.jowls * (age - 45) / 40).toFixed(2) } : {}),
    hunger: +hunger.toFixed(2), teeth: "teeth", gaps: child ? 0 : C.gaps || 0, hairTex: +(S.tex ?? texOf(S)).toFixed(2) };
  const palette = { skin: col(sk, 0.82), cheek: col(cheek, 0.82), jawcool: col(sk.map((x, i) => x * [0.9, 0.93, 0.98][i]), 0.8), hatline: col(sk.map((x) => clamp(x * 1.07)), 0.85),
    lip: col(sk.map((x, i) => x * [0.82, 0.6, 0.6][i]), 0.75), hair: col(hc, 0.8), brow: col(woman || child ? hc.map((x) => clamp(x * 1.15)) : hc, 0.8),
    hands: col(hands, 0.82), teeth: col(TEETH[C.teeth] || TEETH.fair, 0.9), scar: col(sk.map((x) => clamp(x * 1.12)), 0.85) };
  const b = pp.build, h = lerp(b.h[0], b.h[1], S.hT) * (woman ? 0.92 : 1), shoulder = lerp(b.shoulder[0], b.shoulder[1], S.sT) * (woman ? 0.82 : 1);
  return { face, palette, h: +h.toFixed(3), shoulder: +shoulder.toFixed(3), stoop: C.stoop, wear: C.wear, cls: C.name, people: pp.name };
}
