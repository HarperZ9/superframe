// Hand lettering as SVG, from the game's stroke skeletons: the sign painter's capitals
// (ui/lettering/skeleton.mjs) and the round insular hand for names and titles
// (ui/lettering/insular.mjs). Each letter sits a hair off the line and leans its own way, by a
// hash of the seed, so a word never repeats a stamp and the same sheet is drawn the same twice.
//   letter(text, x, y, size, { hand, ink, opacity, track, seed, weight }) -> an SVG path string
//   textWidth(text, size, hand, track) -> width in the sheet's units
// size is the capital height; x, y is the left end of the baseline.
import { GLYPHS, glyphFor } from "../../game/engine/ui/lettering/skeleton.mjs";
import { INSULAR_ROUND, INSULAR_KERN } from "../../game/engine/ui/lettering/insular.mjs";

const EM = 70;   // the skeleton's capital height
const glyph = (ch, hand) => (hand === "caps" ? GLYPHS[ch] || glyphFor(ch) : INSULAR_ROUND[ch] || GLYPHS[ch] || glyphFor(ch));
function rnd(a, b) { let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return (h >>> 0) / 4294967296; }

export function textWidth(text, size, hand = "insular", track = 0) {
  const k = size / EM; let w = 0;
  for (let i = 0; i < text.length; i++) { w += glyph(text[i], hand).w * k + track; if (hand !== "caps") w += (INSULAR_KERN[text.slice(i, i + 2)] || 0) * k; }
  return w - track;
}

// a stroke through its points: straight for two, a Catmull-Rom curve as cubic Beziers for more
function strokePath(pts) {
  const f = (v) => v.toFixed(1);
  if (pts.length === 2) return `M${f(pts[0][0])},${f(pts[0][1])}L${f(pts[1][0])},${f(pts[1][1])}`;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

export function letter(text, x, y, size, { hand = "insular", ink = "#1f1a15", opacity = 1, track = 0, seed = 1, weight = 1 } = {}) {
  const k = size / EM; let pen = x, body = "", hair = "";
  for (let i = 0; i < text.length; i++) {
    const g = glyph(text[i], hand), lean = (rnd(seed * 31 + i, 1) - 0.5) * 0.05, lift = (rnd(seed * 17 + i, 2) - 0.5) * size * 0.05, c = Math.cos(lean), s = Math.sin(lean);
    for (const st of g.s) {
      // skeleton units have y up; the sheet has y down
      const pts = st.map(([px, py]) => { const lx = px * k, ly = -py * k; return [pen + lx * c - ly * s, y + lift + lx * s + ly * c]; });
      if (st.hair) hair += strokePath(pts); else body += strokePath(pts);
    }
    pen += g.w * k + track;
    if (hand !== "caps") pen += (INSULAR_KERN[text.slice(i, i + 2)] || 0) * k;
  }
  const sw = size * (hand === "caps" ? 0.105 : 0.115) * weight;
  return `<path d="${body}" fill="none" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    (hair ? `<path d="${hair}" fill="none" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="${(sw * 0.4).toFixed(2)}" stroke-linecap="round"/>` : "");
}
