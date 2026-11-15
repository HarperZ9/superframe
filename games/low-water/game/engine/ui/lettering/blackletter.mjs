// The blackletter hand (the UI art lead's, 2026-10-22): textura's broken strokes from first principles: every
// curve broken into straight pulls of a broad nib at 40 degrees, minims that start with a short diagonal head
// and end in a diagonal foot (the nib's angle makes both a diamond), bowls as six-sided boxes, the round d, a
// round s, and bows that bite (b, d, o, p and e touch their round neighbours). The same skeleton written with
// the looser bastarda tool slants and rounds into an everyday hand. The capitals are cadels: the letter drawn
// larger with a doubled main stroke and hairline flourishes. Units as lettering/skeleton.mjs; body 48 high.
//   BLACKLETTER[ch] -> { w, s }     BLACK_KERN["bo"] -> units
import { GLYPHS as PRINT } from "./skeleton.mjs";

const minim = (x, top = 48, bot = 0, foot = true) => [[x - 4, top - 6], [x, top], [x, bot + (foot ? 6 : 0)], ...(foot ? [[x + 6, bot]] : [])];
const tall = (x, bot = 0) => [[x - 4, 68], [x, 74], [x, bot + 6], [x + 6, bot]];
const L = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]];
const box = (x0, x1, top = 48, bot = 0) => [[x1 - 2, top - 4], [x1 - 8, top], [x0 + 4, top - 2], [x0, top - 10], [x0, bot + 8], [x0 + 6, bot], [x1 - 6, bot + 1], [x1, bot + 8]];

const LOWER = {
  a: { w: 40, s: [[[6, 40], [14, 48], [28, 48], [32, 42], [32, 6], [38, 0]], [[32, 28], [12, 24], [6, 14], [8, 4], [16, 0], [32, 8]]] },
  b: { w: 40, s: [tall(8, 2), [[8, 38], [18, 48], [30, 46], [34, 38], [34, 8], [26, 0], [8, 4]]] },
  c: { w: 34, s: [[[30, 42], [24, 48], [10, 46], [6, 38], [6, 8], [12, 0], [26, 2], [31, 8]]] },
  d: { w: 40, s: [[[32, 36], [22, 46], [10, 44], [6, 36], [6, 8], [12, 0], [26, 0], [32, 8]], [[32, 14], [34, 52], [28, 66], [14, 74]]] },
  e: { w: 36, s: [[[6, 26], [30, 34], [28, 44], [18, 48], [8, 44], [6, 36], [6, 8], [12, 0], [24, 0], [31, 8]]] },
  f: { w: 32, s: [[[10, 0], [10, 62], [16, 72], [28, 74], [33, 68]], L(2, 46, 26, 46)] },
  g: { w: 40, s: [[[32, 42], [22, 48], [10, 46], [6, 36], [6, 18], [12, 10], [26, 10], [32, 16]], [[32, 48], [32, -12], [24, -22], [10, -20], [4, -14]]] },
  h: { w: 40, s: [tall(8, -2), [[8, 38], [18, 48], [30, 46], [33, 36], [33, -6], [24, -20]]] },
  i: { w: 18, s: [minim(9), L(7, 60, 12, 66)] },
  j: { w: 20, s: [[[5, 42], [9, 48], [9, -12], [2, -22]], L(7, 60, 12, 66)] },
  k: { w: 38, s: [tall(8, -2), [[8, 26], [24, 40], [28, 48], [20, 48]], [[14, 28], [28, 6], [35, 0]]] },
  l: { w: 18, s: [tall(9)] },
  m: { w: 58, s: [minim(9, 48, 0, false), [[9, 42], [17, 48], [24, 44], [24, 0]], [[24, 42], [32, 48], [40, 44], [40, 6], [46, 0]]] },
  n: { w: 42, s: [minim(9, 48, 0, false), [[9, 42], [17, 48], [26, 44], [26, 6], [32, 0]]] },
  o: { w: 38, s: [[[18, 48], [8, 44], [6, 36], [6, 10], [10, 2], [18, 0], [28, 4], [32, 12], [32, 38], [27, 46], [17, 48]]] },
  p: { w: 40, s: [[[5, 42], [9, 48], [9, -22], [3, -24]], [[9, 40], [18, 48], [30, 46], [33, 38], [33, 10], [26, 2], [16, 0], [9, 4]]] },
  q: { w: 40, s: [box(6, 32), [[32, 48], [32, -22], [38, -24]]] },
  r: { w: 32, s: [minim(9), [[9, 40], [16, 48], [27, 47], [30, 42]]] },
  s: { w: 34, s: [[[29, 44], [20, 48], [9, 44], [8, 34], [28, 18], [30, 8], [22, 0], [10, 0], [4, 6]]] },
  t: { w: 30, s: [[[10, 62], [10, 6], [16, 0], [26, 4]], L(2, 46, 24, 46)] },
  u: { w: 42, s: [[[5, 42], [9, 48], [9, 8], [15, 0], [26, 4]], [[22, 42], [27, 48], [27, 6], [33, 0]]] },
  v: { w: 38, s: [[[5, 42], [9, 48], [10, 14], [19, 0], [30, 18], [30, 44], [25, 48]]] },
  w: { w: 56, s: [[[5, 42], [9, 48], [10, 14], [18, 0], [27, 18], [27, 44]], [[27, 18], [36, 0], [46, 18], [46, 44], [41, 48]]] },
  x: { w: 36, s: [L(4, 48, 32, 0), L(32, 48, 4, 0)] },
  y: { w: 40, s: [[[5, 42], [9, 48], [9, 10], [16, 4], [28, 10]], [[28, 48], [28, -12], [20, -22], [6, -18]]] },
  z: { w: 36, s: [[[4, 46], [30, 48], [6, 2], [32, 0]]] },
};
LOWER.st = { w: 62, s: [[[29, 44], [20, 48], [9, 44], [8, 34], [28, 18], [30, 8], [22, 0], [10, 0], [4, 6]], [[29, 44], [38, 62], [44, 60]], [[44, 62], [44, 6], [50, 0], [60, 4]], L(36, 46, 58, 46)] };
LOWER.ct = { w: 64, s: [[[30, 42], [24, 48], [10, 46], [6, 38], [6, 8], [12, 0], [26, 2], [31, 8]], [[30, 42], [38, 62], [46, 60]], [[46, 62], [46, 6], [52, 0], [62, 4]], L(38, 46, 60, 46)] };

// a cadel capital: larger, its main stroke doubled a hairline inside, a swash before it
function cadel(g) {
  const k = 1.45, s = g.s.map((st) => st.map(([x, y]) => [x * k + 10, y * k]));
  const main = s[0].map(([x, y]) => [x + 5, y]);
  const swash = [[0, 10], [-4, 40], [4, 66], [16, 72], [24, 66]]; swash.hair = true; main.hair = true;
  return { w: Math.round(g.w * k + 14), s: [swash, ...s, main] };
}

// the capitals: the print capital broken into straight pulls (every curve cut to a few facets), its first stroke
// doubled a hairline inside, a swash before it: a cadel that still reads as its letter
function broken(st) { if (st.length <= 6) return st; const out = st.filter((p, i) => i % 2 === 0); if (out[out.length - 1] !== st[st.length - 1]) out.push(st[st.length - 1]); return out; }
function cadelCap(ch) {
  const P = PRINT[ch]; if (!P) return null;
  const s = P.s.map((st) => broken(st).map(([x, y]) => [x * 1.05 + 10, y]));
  const main = s[0].map(([x, y]) => [x + 5, y]), swash = [[0, 10], [-4, 40], [4, 66], [16, 72], [24, 66]]; main.hair = true; swash.hair = true;
  return { w: Math.round(P.w * 1.05 + 14), s: [swash, ...s, main] };
}
export const BLACKLETTER = { " ": { w: 24, s: [] } };
for (const [ch, g] of Object.entries(LOWER)) { BLACKLETTER[ch] = g; if (ch.length === 1) BLACKLETTER[ch.toUpperCase()] = cadelCap(ch.toUpperCase()) || cadel(g); }
for (const ch of "0123456789.,'\":;-!?()&/") BLACKLETTER[ch] = PRINT[ch];
// biting bows: round letters share a stroke with the next
export const BLACK_KERN = { bo: -8, be: -7, bd: -6, do: -8, de: -8, dd: -6, oo: -8, oe: -7, oc: -7, od: -6, po: -8, pe: -7, pp: -6, ho: -5, he: -5, ha: -4 };
