// Oil and Ink on a figure (design/ART-DIRECTION.md direction A, the author's pick 2026-10-18): the
// figure's shadow planes turn violet on one side of a form and teal on the other, as the plates' own
// shadows do; skin gets an olive halftone in its middle values; the silhouette is inked in the plates'
// violet-brown (LOOK-UNIFIED R3), never a pale halo (R4: no figure outlined to stand out).
//   const T = oilInk({ yawDeg })   T.shade([r, g, b] bytes, normal [x, y, z], skin, ceil) -> bytes
//   INK_RGB, inkWidth(ppm)
const LIN = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const ENC = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
const Y = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const norm = (c) => { const y = Y(...c); return c.map((v) => v / y); };

export const INK_RGB = [26, 17, 24];   // the plates' ink (render/v2/post2.mjs), display values
// about 2.2 px on the silhouette at 1080p for a 132 px quay figure: scale with the figure
export const inkWidth = (ppm) => Math.max(1, Math.min(2, Math.round(ppm / 90)));   // 2 px at most: a shadow ring would read wider

// tints of equal luminance: what a shadow plane's colour is multiplied toward
const VIOLET = norm([0.46, 0.32, 0.86]), TEAL = norm([0.2, 0.56, 0.56]), OLIVE = norm([0.62, 0.62, 0.34]);
export const SHADOW_MIX = 0.5, SKIN_MIX = 0.22;

export function oilInk({ yawDeg = 34 } = {}) {
  const y = (yawDeg * Math.PI) / 180, right = [Math.cos(y), 0, -Math.sin(y)];
  return {
    shade(c, n, skin, ceil = 1) {
      let r = LIN(c[0]), g = LIN(c[1]), b = LIN(c[2]);
      const l = Y(r, g, b), ref = Math.max(0.02, 0.45 * ceil);
      // how far into shadow: 0 at half the figure's ceiling, 1 at black
      const s = Math.max(0, Math.min(1, 1 - l / ref));
      if (s > 0 && n) {
        const side = n[0] * right[0] + n[2] * right[2], t = side >= 0 ? TEAL : VIOLET, k = SHADOW_MIX * s * Math.min(1, 0.4 + Math.abs(side));
        r = r * (1 - k) + l * t[0] * k; g = g * (1 - k) + l * t[1] * k; b = b * (1 - k) + l * t[2] * k;
      }
      if (skin) { const m = SKIN_MIX * Math.max(0, 1 - Math.abs(l / ref - 1)); r = r * (1 - m) + l * OLIVE[0] * m; g = g * (1 - m) + l * OLIVE[1] * m; b = b * (1 - m) + l * OLIVE[2] * m; }
      const mx = Math.max(r, g, b); if (mx > 1) { r /= mx; g /= mx; b /= mx; }
      return [ENC(r), ENC(g), ENC(b)];
    },
  };
}
