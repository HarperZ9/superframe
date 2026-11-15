// The characters Glyph can set, and what any other character becomes. Pure (no DOM), so the test can
// check every string the game shows. The atlas draws CHARSET; glyphOf(ch) maps anything to a member of
// it: itself, a typographic substitute (an arrow to its ASCII shape, a minus to a hyphen, curly quotes to
// straight ones, an accented letter to its base letter), or the defined stand-in, a middle dot. Never "?".
// Original code.
export const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
export const EXTRA = "┌┐└┘─│├┤┬┴┼╱╲░▒▓█≈✶" +   // box drawing, shades, approx, star
  "←↑→↓↔↕−–—…‘’“”×·°£½•é";      // arrows, minus, dashes, ellipsis, quotes, times, dot, degree, pound, half, bullet, e-acute
export const STANDIN = "·";
// substitutes for characters outside the set (and for set members a font may lack, used by the atlas)
export const SUBST = {
  "←": "<", "↑": "^", "→": ">", "↓": "v", "↔": "-", "↕": "|", "−": "-", "–": "-", "—": "-", "…": ".", "‘": "'", "’": "'", "“": "\"", "”": "\"",
  "×": "x", "·": ".", "°": "o", "£": "L", "½": "%", "•": "*", "é": "e", " ": " ", " ": " ", " ": " ", " ": " ", "​": "",
  "┌": "+", "┐": "+", "└": "+", "┘": "+", "─": "-", "│": "|", "├": "+", "┤": "+", "┬": "+", "┴": "+", "┼": "+", "╱": "/", "╲": "\\", "░": ":", "▒": "%", "▓": "#", "█": "#", "≈": "=", "✶": "*",
};
const SET = new Set([...ASCII, ...EXTRA]);
export function glyphOf(ch, extra = null) {
  if (SET.has(ch) || (extra && extra.has(ch))) return ch;
  if (SUBST[ch] != null) return SUBST[ch] || " ";
  const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  if (base && base !== ch && [...base].every((c) => SET.has(c))) return base[0];
  return STANDIN;
}
