// Each writer's own hand (the UI art lead's, 2026-10-22, round two). A hand is a set of parameters from the
// voice cast (design/voice/quota-cast.json, `hand`; mirrored for the game in lettering/hands.json by
// tools/handsync.mjs): the pen (a pointed dip pen, a clerk's small broad nib, a pencil), slant, pressure,
// letter width and size, loops on ascenders and descenders, how often letters join, tremor, variance,
// a baseline that climbs or sinks or wanders, each letter's own lean, pressure that varies, hard stops, strokes
// gone over again, speed, print or joined, how large the capitals stand, spelling,
// how tallies are drawn, and the script (Tarnish, or Hesh with Tarnish as a learned second hand). From these
// a line of text becomes words of strokes, each word written as one glyph by lettering/brush.mjs. Pure: no DOM.
//   handWords(text, hand, { mood, seed }) -> [{ word, glyph: { w, s }, tool }]    toolFor(hand, id) -> tool
//   spell(text, hand) -> the words as the writer spells them       tallyGlyph(n, style) -> { w, s }
import { GLYPHS as PRINT } from "./skeleton.mjs";
import { HESH } from "./hesh.mjs";
import { CURSIVE } from "./cursive.mjs";
import { TOOLS } from "./brush.mjs";
import { U, hash4 } from "../../paint/strokes.mjs";

const PHONETIC = { would: "wud", could: "cud", because: "becos", said: "sed", there: "thair", their: "thair", was: "wos", night: "nite", right: "rite", enough: "enuf", tomorrow: "tomoro", quota: "kwota", sacks: "saks", nineteen: "ninteen", through: "thru", know: "no", knows: "nos", what: "wot", who: "hoo", the: "th", district: "distrik", inspector: "inspekter", barley: "barly", winter: "wintr" };
export function spell(text, hand) {
  if (hand.spelling !== "phonetic") return text;
  return text.replace(/[A-Za-z]+/g, (w) => { const r = PHONETIC[w.toLowerCase()]; return r ? (w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r) : w; });
}

// a tally of n in fives: "gate" (four strokes and one across) or "square" (a box and its diagonal, as Anni draws them)
export function tallyGlyph(n, style = "gate") {
  const s = []; let x = 4;
  for (let left = n; left > 0; left -= 5) {
    const k = Math.min(5, left);
    if (style === "square") { const sides = [[[x, 40], [x + 22, 40]], [[x + 22, 40], [x + 22, 4]], [[x + 22, 4], [x, 4]], [[x, 4], [x, 40]]]; s.push(...sides.slice(0, Math.min(4, k))); if (k === 5) s.push([[x, 40], [x + 22, 4]]); x += 32; }
    else { for (let i = 0; i < Math.min(4, k); i++) s.push([[x + i * 7, 42], [x + i * 7 + 1, 2]]); if (k === 5) s.push([[x - 4, 10], [x + 26, 34]]); x += 38; }
  }
  return { w: x * 1.4 + 2, s: s.map((st) => st.map(([a, b]) => [a * 1.4, b * 1.4])) };   // drawn a little larger than the letters beside it
}

// a pen as the hand holds it
export function toolFor(hand, id = 1) {
  const v = hand.variance ?? 0.2, base = hand.tool === "pencil" ? TOOLS.pencil : hand.tool === "clerk" ? { ...TOOLS.bastarda, nib: 5.5, edge: 0.5, catch: 0.15 } : TOOLS.pen, p = hand.pressure ?? 1;
  const T = { ...base, id: 100 + id, shear: hand.slant ?? 0.1, jit: 0.5 + v * 2.6, rot: 0.4 + v * 2.2, wobble: (hand.tremor ?? 0) * 1.6 + 0.15, blot: (hand.blots ?? 0.01), weightVar: hand.pressureVar ?? 0.16 };
  if (hand.grain != null) T.grain = hand.grain;
  if (hand.stops) { T.taper = [1.15, 1.15 + 0.35 * hand.stops]; T.load = 0.85; }   // the pencil dug in where each stroke stops
  if (base.hair != null) { T.shade = base.shade * p; T.hair = base.hair * (0.8 + 0.2 * p); }
  else if (base.kind === "nib") T.nib = base.nib * p;
  else T.r = base.r * p;
  return T;
}

// ascenders that loop (a stem from the top becomes a loop up and back down), descenders that loop back up
function loopify(g, loops) {
  if (!loops) return g;
  const s = g.s.map((st) => {
    let out = st;
    const [a, b] = st; if (st.length >= 2 && a[1] >= 68 && b && Math.abs(b[0] - a[0]) < 3 && b[1] < a[1]) out = [[a[0] + 9 * loops, 40], [a[0] + 10 * loops, 62], [a[0] + 4, 76], [a[0] - 1, 66], ...st.slice(1)];
    const z = out[out.length - 1]; if (z[1] <= -16) out = [...out, [z[0] - 6 * loops, -12], [z[0] + 4, 2]];
    return out;
  });
  return { ...g, s };
}
// hurried: dots dashed, forms opened a little (every other inner point dropped)
function hurry(g, speed) {
  if (!speed) return g;
  return { ...g, s: g.s.map((st) => (st.length === 2 && Math.hypot(st[1][0] - st[0][0], st[1][1] - st[0][1]) < 5 ? [[st[0][0] - 3, st[0][1]], [st[0][0] + 7, st[0][1] + 3]] : st.length > 5 && speed > 0.5 ? st.filter((p, i) => i % 2 === 0 || i === st.length - 1) : st)) };
}

// the hand a line is written in: the writer's own, or a mood of it (Ned's "lie"), or a learned second hand
// (a Hesh writer's Tarnish, { script: "tarn" })
// strokes as a hand draws them, not as a ruler does: a straight line bows a little and runs past its end, a
// curve wanders off its circle; amount from the hand's variance
function handmade(st, V, rnd) {
  if (st.length === 2) {
    const [[x0, y0], [x1, y1]] = st, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, bow = (rnd(0) - 0.5) * V * 7, o0 = rnd(1) * V * 3, o1 = rnd(2) * V * 4;
    return [[x0 - ux * o0, y0 - uy * o0], [(x0 + x1) / 2 - uy * bow, (y0 + y1) / 2 + ux * bow], [x1 + ux * o1, y1 + uy * o1]];
  }
  const a = (rnd(3) - 0.5) * V * 6, b = (rnd(4) - 0.5) * V * 6, ph = rnd(5) * 6.28;
  return st.map(([x, y], i) => [x + a * Math.sin(i * 0.7 + ph), y + b * Math.cos(i * 0.6 + ph)]);
}

export function handFor(hand0, { mood = null, script = null } = {}) {
  let hand = hand0;
  if (script === "tarn" && hand.second) hand = { ...hand, ...hand.second, script: "tarn" };
  if (mood && hand0[mood]) hand = { ...hand, ...hand0[mood] };
  return hand;
}

const C1 = (ch) => /[a-z]/.test(ch);

export function handWords(text, hand0, { mood = null, script = null, seed = 1 } = {}) {
  const hand = handFor(hand0, { mood, script }), R = hand.rough ?? 1, hesh = hand.script === "hesh", set = hesh ? HESH : hand.print ? PRINT : CURSIVE, joined = set === CURSIVE, V = hand.variance ?? 0.2;
  const words = spell(String(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-").replace(/…/g, "..."), hand).split(/\s+/).filter(Boolean), total = Math.max(1, words.join("").length);
  let n = 0;
  return words.map((word) => {
    const tally = /^\[tally:(\d+)\]$/.exec(word);
    if (tally) return { word, glyph: tallyGlyph(+tally[1], hand.tally || "gate") };
    const strokes = []; let x = 0, prevExit = null, prevLower = false, walk = 0;
    for (const ch of word) {
      const r = (k) => U(hash4(seed, n, ch.codePointAt(0), k), 0), lower = /[a-z]/.test(ch);
      let g = set[ch] || set[ch.toLowerCase()] || PRINT[ch] || PRINT["-"];
      g = hurry(loopify(g, hesh || joined ? 0 : hand.loops || 0), hand.speed || 0);
      // a joined hand lifts the pen now and then: the letter loses its entry stroke and sits a little apart
      const lift = joined && C1(ch) && (!prevLower || r(4) >= (hand.joins ?? 0.8));
      if (lift && g.s.length && g.s[0].length > 2) { g = { ...g, s: [g.s[0].slice(1), ...g.s.slice(1)] }; if (prevLower) x += 4 * (hand.width ?? 1); }
      const size = (hand.size ?? 1) * (1 + V * R * (r(2) - 0.5) * 0.55) * (/[A-Z]/.test(ch) ? hand.caps ?? 1 : 1), sx = size * (hand.width ?? 1);
      walk += (r(5) - 0.5) * (hand.walk ?? V) * 9 * R;   // the line wanders: each letter sits where the last one left it, give or take
      const dy = (hand.drift ?? 0) * (n / total) * 12 + (r(3) - 0.5) * V * 6 + walk, th = (r(6) - 0.5) * (hand.lean ?? V * 0.5), ct = Math.cos(th), st0 = Math.sin(th), mx = g.w / 2;
      // each letter turned a little on its own (a letter built one at a time), then set on its place
      const placed = g.s.map((st, si) => Object.assign(handmade(st, (hesh ? V * 0.5 : V) * R, (k) => r(20 + si * 7 + k)).map(([px, py]) => { const X = (px - mx) * ct - (py - 22) * st0 + mx, Y = (px - mx) * st0 + (py - 22) * ct + 22; return [x + X * sx, Y * size + dy]; }), { hair: !!st.hair }));
      // a stroke gone over again where the pen hesitated (Bet): the same stroke a little off itself
      if (hand.retrace) for (const p of placed.slice()) if (p.length > 1 && r(7 + placed.indexOf(p)) < hand.retrace) placed.push(Object.assign(p.map(([a, b], i) => [a + 0.9 + Math.sin(i) * 0.4, b - 0.7]), { hair: true }));
      // a join: from the last letter's exit to this one's first point, when both are small letters

      strokes.push(...placed);
      const last = placed[placed.length - 1]; prevExit = last ? last[last.length - 1] : prevExit; prevLower = lower;
      x += g.w * sx * (hand.spacing ?? 1) * (hesh || joined ? 1 : 0.92); n++;
    }
    if (hand.headline && !hesh) strokes.push([[-2, 55], [x, 56]]);   // a Hesh writer's headline kept over a Tarnish word
    return { word, glyph: { w: Math.max(10, x), s: strokes } };
  });
}
