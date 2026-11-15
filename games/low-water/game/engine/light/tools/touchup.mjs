// The two figure terms the character renderer has no slot for yet, laid over its output for the proofs: the
// eye catch-light from the key (figure.mjs catch) and the cold warmth of ears, nose and fingers (figure.mjs
// sss: thin skin at the silhouette and at the nose's edge reddens; with a light behind, it glows through).
// The painter and the glyph renderer take the same terms from the rig; this is the reference, not theirs.
//   touchUp({ G, rgba }, R, { FACE, EYE })   R = figureRig(...)
export function touchUp(fig, R, { FACE, EYE }) {
  const { G, rgba } = fig, w = G.w, h = G.h;
  // cold warmth: skin pixels within 2 px of the silhouette or of a non-skin pixel
  if (R.sss && R.sss.k > 0.02) {
    const k = R.sss.k * 0.25, c = R.sss.rgb, t = R.sss.through;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      const i = y * w + x; if (!FACE.has(G.id[i])) continue; let edge = false;
      for (const j of [i - 2, i + 2, i - 2 * w, i + 2 * w]) if (!FACE.has(G.id[j])) { edge = true; break; }
      if (!edge) continue;
      for (let q = 0; q < 3; q++) rgba[i * 4 + q] = rgba[i * 4 + q] * (1 - k) + rgba[i * 4 + q] * c[q] * 1.25 * k + t[q] * 0.03 * k;
    }
  }
  // catch-light: in each eye, one bright point offset toward the key
  if (R.catch && R.catch.k > 0.02) {
    const blobs = eyeBlobs(G, EYE), k = R.catch.k;
    for (const b of blobs) {
      const x = Math.round(b.x + R.catch.offset2[0] * b.r), y = Math.round(b.y + R.catch.offset2[1] * b.r), s = b.r > 4 ? 1 : 0;
      for (let dy = -s; dy <= s; dy++) for (let dx = -s; dx <= s; dx++) { const i = (y + dy) * w + (x + dx); if (i < 0 || i >= w * h || G.id[i] !== EYE) continue; for (let q = 0; q < 3; q++) rgba[i * 4 + q] = rgba[i * 4 + q] * (1 - k) + (0.55 + 0.45 * R.catch.rgb[q]) * k; }
    }
  }
}
function eyeBlobs(G, EYE) {
  const seen = new Uint8Array(G.w * G.h), out = [];
  for (let i = 0; i < G.w * G.h; i++) {
    if (seen[i] || G.id[i] !== EYE) continue; const st = [i]; seen[i] = 1; let sx = 0, sy = 0, n = 0;
    while (st.length) { const j = st.pop(), x = j % G.w, y = (j / G.w) | 0; sx += x; sy += y; n++; for (const q of [j - 1, j + 1, j - G.w, j + G.w]) if (q >= 0 && q < G.w * G.h && !seen[q] && G.id[q] === EYE) { seen[q] = 1; st.push(q); } }
    if (n >= 2) out.push({ x: sx / n, y: sy / n, r: Math.sqrt(n / Math.PI) });
  }
  return out;
}
