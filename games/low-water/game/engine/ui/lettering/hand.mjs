// Lettering at run time (the UI art lead's, 2026-10-21): text set from the baked atlases
// (tools/letterbake.mjs) into a canvas, a variant chosen per letter so a word never repeats a stamp:
// the same letter twice in a row takes two different variants, and each letter sits a hair off the
// line and leans its own way. The ink is laid over the letters' cover (source-in), so one atlas serves
// every era's ink.
//   await loadHand("brush") -> hand      layout(hand, text, { px, max, seed }) -> { lines, w, h }
//   drawLettering(canvas, hand, text, { px, max, seed, ink, align, dpr }) -> { w, h }   (CSS pixels)
import { U, hash4 } from "../../paint/strokes.mjs";

const hands = new Map();
export function loadHand(tool) {
  if (!hands.has(tool)) hands.set(tool, (async () => {
    const base = new URL(`./atlas/${tool}`, import.meta.url);
    const [meta, img] = await Promise.all([fetch(`${base}.json`).then((r) => { if (!r.ok) throw new Error(`lettering: no ${tool}.json (${r.status})`); return r.json(); }), loadImage(`${base}.png`)]);
    // grey cover to white ink with that cover as alpha, once per hand
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i]; d[i] = d[i + 1] = d[i + 2] = 255; }
    g.putImageData(im, 0, 0);
    return { ...meta, sheet: c };
  })());
  return hands.get(tool);
}
function loadImage(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(`lettering: could not load ${src}`)); i.src = src; }); }

const ALIAS = { "’": "'", "‘": "'", "“": "\"", "”": "\"", "–": "-", "—": "-", "−": "-", "é": "e", "×": "x", "…": "." };
const glyphKey = (H, ch) => (H.glyphs[ch] ? ch : H.glyphs[ALIAS[ch]] ? ALIAS[ch] : H.glyphs[ch.normalize("NFKD")[0]] ? ch.normalize("NFKD")[0] : H.glyphs[ch.toUpperCase()] ? ch.toUpperCase() : "-");

// words into lines no wider than max (CSS px); each letter with its variant and its small offsets
export function layout(H, text, { px = 24, max = Infinity, seed = 1, track = 1.02 } = {}) {
  const k = px / H.unitsPerEm, words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let line = [], x = 0, lastV = new Map(), n = 0;
  // a word's letters: a ligature where the hand has one (st, ct), else each letter; round letters that bite
  // their neighbour come closer (H.kern), and the same letter twice never takes the same variant
  const wordOf = (w) => {
    const chars = [...w], out = [];
    for (let i = 0; i < chars.length; i++) {
      const two = chars[i] + (chars[i + 1] || ""), lig = two.length === 2 && H.glyphs[two], key = lig ? two : glyphKey(H, chars[i]); if (lig) i++;
      const vs = H.glyphs[key], h = hash4(seed, n++, key.codePointAt(0) + key.length * 977, 5);
      let v = Math.floor(U(h, 1) * vs.length); if (vs.length > 1 && lastV.get(key) === v) v = (v + 1) % vs.length; lastV.set(key, v);
      const prev = out[out.length - 1], kern = prev && H.kern ? (H.kern[prev.key.slice(-1) + key[0]] || 0) * k : 0;
      if (prev) prev.adv += kern;
      out.push({ key, v, adv: (H.adv[key] || 40) * k * track, dy: (U(h, 2) - 0.5) * 0.03 * px, alpha: 0.88 + U(h, 3) * 0.12 });
    }
    return out;
  };
  const space = (H.adv[" "] || 26) * k;
  for (const w of words) {
    const gl = wordOf(w), ww = gl.reduce((a, g) => a + g.adv, 0);
    if (line.length && x + space + ww > max) { lines.push({ glyphs: line, w: x }); line = []; x = 0; }
    if (line.length) x += space;
    for (const g of gl) { line.push({ ...g, x }); x += g.adv; }
  }
  if (line.length) lines.push({ glyphs: line, w: x });
  const lh = px * 1.12, padX = (H.pad || 12) * k;
  return { lines, w: Math.ceil(Math.max(0, ...lines.map((l) => l.w)) + padX * 2), h: Math.ceil(lh * lines.length + px * 0.3), lh, k, padX };
}

export function drawLettering(canvas, H, text, { px = 24, max = Infinity, seed = 1, ink = "#1d1418", align = "left", dpr = devicePixelRatio || 1, fit = 0 } = {}) {
  const L = layout(H, text, { px, max, seed }), W = Math.max(1, fit && align !== "left" ? Math.max(fit, L.w) : L.w), Hh = Math.max(1, L.h);
  canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(Hh * dpr); canvas.style.width = `${W}px`; canvas.style.height = `${Hh}px`;
  const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  const s = px / H.em, top = (H.ascent - 76) * (px / H.unitsPerEm);   // the cell's top sits a little over the ascender
  L.lines.forEach((ln, i) => {
    const off = align === "center" ? (W - ln.w) / 2 - L.padX : align === "right" ? W - ln.w - 2 * L.padX : 0;
    for (const gl of ln.glyphs) {
      const [sx, sy, sw, sh] = H.glyphs[gl.key][gl.v];
      g.globalAlpha = gl.alpha;
      g.drawImage(H.sheet, sx, sy, sw, sh, off + gl.x, i * L.lh + gl.dy - top, sw * s, sh * s);
    }
  });
  g.globalAlpha = 1; g.globalCompositeOperation = "source-in"; g.fillStyle = ink; g.fillRect(0, 0, W, Hh); g.globalCompositeOperation = "source-over";
  return { w: W, h: Hh, lines: L.lines.length };
}
