// The interface in glyph mode as the era's typed and printed matter (the UI art lead's, 2026-10-21).
// The glyph renderer sets every panel in the character grid (paint/glyph/ui.mjs); this gives it, for a
// story with an era, the stock and ink, the frame, and how each character was struck:
//   era 1  letterpress on the ledger: even impression, red-ruled frame
//   era 2  a typewriter on the ration form: ribbon wear across the line, some keys struck light or hard
//   era 3  a spirit duplicator: violet, fading down the sheet as the master wore
//   era 4  a dot-matrix printer on tractor-feed forms: the sprocket holes down each side, banded passes
//   era 5  a teleprinter copy, photocopied: toner specks in the ground, a few characters dropped light
// The plain-text setting keeps the stock and ink and strikes every character evenly.
//   installTyped() -> { stop }   (sets globalThis.__lwTyped while a story's era is set)
import { U, hash4 } from "../paint/strokes.mjs";

const h = (X, Y, k) => U(hash4(X, Y, k, 41), 0);
const PLAIN = { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" };
export const MATTER = {
  1: { ground: [236, 226, 199], ink: [42, 28, 18], box: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" }, strike: (X, Y) => 0.94 + h(X, Y, 1) * 0.06 },
  2: { ground: [214, 211, 200], ink: [28, 26, 32], box: PLAIN,
    strike: (X, Y, c) => { const wear = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(X * 0.23 + Y * 0.07)), r = h(X, Y, 2); return wear * (r < 0.05 ? 0.74 : r > 0.95 || /[oe.,]/.test(c) ? 1.08 : 1); } },
  3: { ground: [231, 227, 214], ink: [58, 26, 96], box: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
    strike: (X, Y, c, b) => (1 - 0.38 * Math.max(0, (Y - b.y0) / Math.max(1, b.y1 - b.y0))) * (0.88 + h(X, Y, 3) * 0.12) },
  4: { ground: [234, 236, 226], ink: [32, 34, 33], box: { tl: ".", tr: ".", bl: "'", br: "'", h: "-", v: ":" },
    side: (Y, b) => ((Y - b.y0) % 2 ? "o" : ":"), strike: (X, Y) => (Y % 2 ? 0.84 : 1) * (0.93 + h(X, Y, 4) * 0.07) },
  5: { ground: [238, 238, 234], ink: [30, 30, 30], box: PLAIN, strike: (X, Y) => (h(X, Y, 5) < 0.03 ? 0.45 : 0.86 + h(X, Y, 6) * 0.14),
    fill: (X, Y) => (h(X, Y, 7) < 0.012 ? { c: "·", col: [120, 120, 118] } : null) },
};

export function installTyped() {
  const era = () => +document.body.dataset.uiEra || 0;
  globalThis.__lwTyped = () => {
    const M = MATTER[era()]; if (!M) return null;
    if (document.documentElement.classList.contains("plaintext")) return { ground: M.ground, ink: M.ink, box: M.box, strike: () => 1 };
    return M;
  };
  return { stop() { delete globalThis.__lwTyped; } };
}
