// Writing a line in a writer's own hand at run time (the UI art lead's, 2026-10-22). Each word is one glyph
// of strokes (lettering/hands.mjs) written by the hand's pen (lettering/brush.mjs), cached, and set on the
// line with the writer's spacing; the ink is laid over the cover. The hands come from lettering/hands.json
// (from the voice cast). The clean words always stay in the page beside the canvas (ui/letterer.mjs).
//   await loadHands() -> { id: hand }      handOf(hands, "Walter Mott") -> hand | null
//   writeHand(canvas, text, hand, { px, max, ink, mood, script, seed }) -> { w, h, lines }
import { handWords, handFor, toolFor } from "./hands.mjs";
import { rasterGlyph, ASCENT, PAD } from "./brush.mjs";

let HANDS = null;
export function loadHands() {
  if (!HANDS) HANDS = fetch(new URL("./hands.json", import.meta.url)).then((r) => { if (!r.ok) throw new Error(`hands.json ${r.status}`); return r.json(); }).then((j) => j.hands || {}).catch((e) => { console.warn(`handwrite: no hands (${e.message})`); HANDS = null; return {}; });
  return HANDS;
}
// the hand for a speaker as the script names them: id, full name, last word, first word
export function handOf(hands, who) {
  if (!who || !hands) return null;
  const s = String(who).trim().toLowerCase(), words = s.split(/\s+/);
  if (hands[s]) return { id: s, ...hands[s] };
  for (const [id, h] of Object.entries(hands)) if (String(h.name || "").toLowerCase() === s) return { id, ...h };
  for (const w of [words[words.length - 1], words[0]]) if (hands[w]) return { id: w, ...hands[w] };
  return null;
}

const strHash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const cache = new Map();
// one word written, white with its cover as alpha, cached by hand, word, size and seed
function wordCanvas(glyph, tool, em, key) {
  if (cache.has(key)) return cache.get(key);
  const R = rasterGlyph(glyph, tool, { ch: key, variant: 0, emPx: em }), c = document.createElement("canvas"); c.width = R.w; c.height = R.h;
  const g = c.getContext("2d"), im = g.createImageData(R.w, R.h); for (let i = 0; i < R.data.length; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = R.data[i]; }
  g.putImageData(im, 0, 0); if (cache.size > 600) cache.delete(cache.keys().next().value); cache.set(key, c); return c;
}

export function writeHand(canvas, text, hand, { px = 20, max = Infinity, ink = null, mood = null, script = null, seed = 1, dpr = devicePixelRatio || 1 } = {}) {
  const H = handFor(hand, { mood, script }), tool = toolFor(H, strHash(hand.id || hand.name || "hand") % 997), em = px * 1.3, s = em / 100, words = handWords(text, hand, { mood, script, seed });
  const space = 24 * s * (H.spacing ?? 1), lh = px * 1.75, placed = []; let x = 0, line = 0;
  for (const w of words) { const ww = w.glyph.w * s; if (x && x + ww > max) { x = 0; line++; } placed.push({ w, x, line }); x += ww + space; }
  const W = Math.max(1, Math.ceil(Math.min(max, Math.max(...placed.map((p) => p.x + p.w.glyph.w * s), 1)) + 2 * PAD * s)), Hh = Math.ceil((line + 1) * lh + px * 0.6);
  canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(Hh * dpr); canvas.style.width = `${W}px`; canvas.style.height = `${Hh}px`;
  const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  for (const p of placed) { const c = wordCanvas(p.w.glyph, tool, em * dpr, `${hand.id}|${mood}|${script}|${p.w.word}|${Math.round(em * dpr)}|${seed + p.line}`); g.drawImage(c, p.x, p.line * lh + px * 1.15 - ASCENT * s, c.width / dpr, c.height / dpr); }
  g.globalCompositeOperation = "source-in"; g.fillStyle = ink || H.ink || "#2a2622"; g.fillRect(0, 0, W, Hh); g.globalCompositeOperation = "source-over";
  return { w: W, h: Hh, lines: line + 1 };
}
