// The red flash rule as WCAG 2.2 words it (W3C Recommendation, 12 December 2024, "general flash and red flash
// thresholds", Note 3, read at https://www.w3.org/TR/WCAG22/ on 2026-10-23): "a pair of opposing transitions where,
// one transition is either to or from a state with a value R/(R + G + B) that is greater than or equal to 0.8, and
// the difference between states is more than 0.2 (unitless) in the CIE 1976 UCS chromaticity diagram" [ISO 9241-391].
// WCAG 2.0's Understanding note used "the change in the value of (R-G-B)x320 is > 20" instead; that page is no
// longer maintained, and E (cine/windows.mjs) keeps its count for the record only.
// A state here is one window's mean linear colour on one frame (the general flash uses the window's mean luminance
// the same way). Our choice, not WCAG's: a state darker than Y 0.0005 has no chromaticity and is skipped, because
// u'v' of near-black is noise. No imports, so the page can run it too. Original code.
//   chroma([r, g, b])       -> { u, v, red, Y }   linear sRGB in, u'v' (CIE 1976 UCS) out; red: R / (R + G + B) >= 0.8
//   redTransitions(states)  -> frame indices where a red transition completes
export const DARK = 0.0005, STEP = 0.2, RATIO = 0.8;
export function chroma([r, g, b]) {
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b, d = X + 15 * Y + 3 * Z;
  return { u: d > 0 ? (4 * X) / d : 0, v: d > 0 ? (9 * Y) / d : 0, red: r / Math.max(1e-9, r + g + b) >= RATIO, Y };
}
// from the last state a transition left, the next state more than 0.2 away in u'v' with either end saturated red
export function redTransitions(states) {
  const out = []; let a = null;
  for (let t = 0; t < states.length; t++) {
    const c = chroma(states[t]); if (c.Y < DARK) continue;
    if (!a) { a = c; continue; }
    if (Math.hypot(c.u - a.u, c.v - a.v) > STEP) { if (a.red || c.red) out.push(t); a = c; } // a colour change with no red in it moves the anchor only
    else if (!a.red && c.red) a = c; // a red state reached slowly becomes the anchor, so leaving it is measured from it
  }
  return out;
}
