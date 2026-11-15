// The insular hand (the UI art lead's, 2026-10-22): a half-uncial drawn from first principles of the script, not
// from any font. Round, heavy bowls; stems that start with a wedge (the pen set down on its corner, then pulled);
// the insular forms of g (a flat top with a hanging tail), r and s (both falling below the line), f (arms at the
// waist and the line) and t (a flat roof over a curled stem); no dot on i. Unicase, as the script was: the
// capitals are the same letters drawn larger with a doubled stem and a hairline flourish. Units as
// lettering/skeleton.mjs (100 to the em, y up, baseline 0); the body is 50 high, ascenders 74, descenders -24.
//   INSULAR[ch] -> { w, s }     INSULAR_KERN["ab"] -> units (letters that touch)
import { arc } from "./skeleton.mjs";
import { GLYPHS as PRINT } from "./skeleton.mjs";

const wedge = (x, top) => [[x - 6, top - 1], [x - 1, top + 2], [x, top]];   // the entry wedge before a stem
const stem = (x, top, bot, foot = 4) => [...wedge(x, top), [x, bot + 4], [x + foot, bot]];
const L = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]];

const LOWER = {
  a: { w: 54, s: [arc(23, 24, 19, 24, 70, 430), [[44, 50], [44, 8], [51, 0]]] },
  b: { w: 54, s: [stem(9, 74, 0, 0), arc(28, 24, 19, 24, 150, -170)] },
  c: { w: 46, s: [arc(25, 25, 21, 25, 60, 300), [[38, 44], [43, 49]]] },
  d: { w: 54, s: [arc(23, 24, 19, 24, 10, 370), [[42, 22], [44, 50], [36, 66], [16, 75]]] },
  e: { w: 48, s: [arc(25, 25, 21, 25, 20, 320), L(6, 27, 42, 27)] },
  f: { w: 40, s: [stem(12, 52, -22, 0), [[12, 50], [24, 54], [36, 50]], L(12, 26, 32, 26)] },
  g: { w: 50, s: [L(2, 50, 46, 51), [[25, 50], [22, 30], [32, 14], [38, -6], [28, -21], [9, -18]]] },
  h: { w: 54, s: [stem(9, 74, 0, 0), [[9, 30], [20, 48], [36, 50], [44, 38], [44, 12], [38, 0], [30, 2]]] },
  i: { w: 18, s: [stem(9, 50, 0)] },
  j: { w: 20, s: [[...wedge(10, 50), [10, -12], [4, -22]]] },
  k: { w: 50, s: [stem(9, 74, 0, 0), [[40, 50], [24, 34], [10, 22]], [[18, 28], [32, 10], [44, 0]]] },
  l: { w: 20, s: [stem(9, 74, 0, 6)] },
  m: { w: 78, s: [stem(8, 50, 0, 0), [[8, 34], [17, 49], [28, 49], [34, 38], [34, 0]], [[34, 34], [44, 49], [56, 49], [62, 38], [62, 8], [70, 0]]] },
  n: { w: 54, s: [stem(8, 50, 0, 0), [[8, 34], [19, 49], [33, 49], [42, 38], [42, 8], [49, 0]]] },
  o: { w: 52, s: [arc(26, 25, 22, 25, 95, 460)] },
  p: { w: 54, s: [stem(9, 50, -24, 0), arc(28, 25, 19, 25, 150, -170)] },
  q: { w: 52, s: [arc(23, 25, 19, 25, 10, 370), [[42, 50], [42, -24]]] },
  r: { w: 42, s: [stem(9, 50, -18, 0), [[9, 38], [20, 51], [33, 48], [37, 38]]] },
  s: { w: 44, s: [stem(10, 48, -14, 0), [[10, 42], [20, 54], [34, 52], [38, 42], [28, 35]]] },
  t: { w: 46, s: [L(2, 50, 42, 51), [[22, 50], [16, 26], [19, 8], [30, 0], [42, 7]]] },
  u: { w: 54, s: [[...wedge(8, 50), [8, 14], [16, 2], [30, 0], [42, 10]], [...wedge(43, 50), [43, 6], [50, 0]]] },
  v: { w: 48, s: [[...wedge(6, 50), [8, 22], [22, 0], [36, 18], [44, 50]]] },
  w: { w: 70, s: [[...wedge(6, 50), [8, 20], [20, 0], [33, 26], [46, 0], [58, 22], [66, 50]]] },
  x: { w: 48, s: [L(4, 50, 44, 0), L(44, 50, 4, 0)] },
  y: { w: 48, s: [[...wedge(6, 50), [10, 22], [24, 6]], [[44, 50], [24, 6], [12, -16], [2, -23]]] },
  z: { w: 48, s: [[[4, 49], [42, 50], [6, 1], [46, 0]]] },
};
// ligatures: s and t on one stroke, and the tall-backed ct
LOWER.st = { w: 84, s: [stem(10, 48, -14, 0), [[10, 42], [20, 54], [34, 54], [44, 52], [80, 52]], [[62, 52], [56, 26], [59, 8], [70, 0], [82, 7]]] };
LOWER.ct = { w: 90, s: [arc(25, 25, 21, 25, 60, 300), [[38, 44], [46, 62], [60, 70], [66, 60], [62, 50]], L(44, 50, 86, 51), [[64, 50], [58, 26], [61, 8], [72, 0], [84, 7]]] };

// a capital: the letter drawn a third larger, its first stroke doubled a hairline inside, a flourish to its left
function capital(g) {
  const top = Math.max(...g.s.flat().map((p) => p[1])), k = top > 60 ? 1.12 : 1.38, s = g.s.map((st) => st.map(([x, y]) => [x * k + 6, y * k]));   // an ascender stays inside the em
  const first = s[0].map(([x, y]) => [x + 4, y]);
  const swash = [[2, 6], [-2, 34], [4, 62], [12, 70]]; first.hair = true; swash.hair = true;
  return { w: Math.round(g.w * k + 10), s: [...s, first, swash] };
}

// the majuscules: the uncial forms of a, d, e, g, m, t are the small letters drawn large; the rest are
// the print capitals given the wedge, rounded, and the flourish
const UNCIAL = new Set(["a", "d", "e", "g", "m", "t"]);
function majuscule(ch, g) {
  if (UNCIAL.has(ch)) return capital(g);
  const P = PRINT[ch.toUpperCase()]; if (!P) return capital(g);
  const s = P.s.map((st) => st.map(([x, y]) => [x + 6, y]));
  const head = s[0][0], swash = [[2, 6], [-2, 34], [4, 62], [12, 70]]; swash.hair = true;
  s[0] = [[head[0] - 7, head[1] - 2], [head[0] - 1, head[1] + 2], ...s[0]];   // the wedge
  return { w: P.w + 10, s: [...s, swash] };
}
export const INSULAR = { " ": { w: 28, s: [] } };
for (const [ch, g] of Object.entries(LOWER)) { INSULAR[ch] = g; if (ch.length === 1) INSULAR[ch.toUpperCase()] = majuscule(ch, g); }
for (const ch of "0123456789.,'\":;-!?()&/") INSULAR[ch] = PRINT[ch];
// round letters touching their neighbours, as a scribe's bowls do
export const INSULAR_KERN = { bo: -6, oc: -6, oe: -5, oo: -7, do: -5, de: -5, po: -6, pe: -5, eo: -5, ec: -5, co: -5, ce: -5 };

// The same hand with rounder r, s, t, g and f for place names and titles (coordinator, 2026-10-22: the historical
// forms stay in old documents, where a reader expects to work at them; a title has to be read at a glance)
const ROUND = {
  r: { w: 42, s: [stem(9, 50, 0, 0), [[9, 38], [20, 51], [33, 48], [37, 38]]] },
  s: { w: 44, s: [[[38, 42], [30, 51], [16, 51], [8, 42], [12, 32], [32, 22], [40, 12], [32, 2], [16, -1], [4, 6]]] },
  t: { w: 42, s: [[[12, 60], [18, 64], [18, 8], [26, 0], [38, 6]], L(4, 46, 36, 47)] },
  g: { w: 50, s: [arc(23, 25, 19, 25, 10, 370), [[42, 50], [42, -12], [34, -22], [18, -24], [6, -18]]] },
  f: { w: 36, s: [[[34, 70], [26, 76], [18, 72], [14, 60], [14, 0]], L(3, 46, 30, 46)] },
};
export const INSULAR_ROUND = { ...INSULAR, ...ROUND };
delete INSULAR_ROUND.st;
INSULAR_ROUND.G = capital(ROUND.g);   // the round g drawn large; T keeps the uncial roof, which reads as a capital
