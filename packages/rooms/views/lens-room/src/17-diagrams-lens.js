function drawLensDiagram(x, w, h, g) {
  const two = w > h * 1.2;
  const cw = two ? w / 2 : w,
    ch = two ? h : h / 2;
  panel(x, 2, 2, cw - 4, ch - 4, "Cross-section with traced rays");
  const t = document.createElement("canvas");
  const W2 = Math.round(cw - 12),
    H2 = Math.round(ch - 30);
  t.width = W2;
  t.height = H2;
  const save = S.view;
  const zc = S.two ? S.sp / 2 : 0,
    span = Math.max(4.4, (S.two ? S.sp : 0) + 3.8 * S.size);
  setLens(S, W2, H2, 2);
  sF("uSpan", span);
  sF("uZc", zc);
  const tt = getT(W2, H2, gl.RGBA8, gl.UNSIGNED_BYTE);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, tt.f);
  gl.viewport(0, 0, W2, H2);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const sp = new Uint8ClampedArray(W2 * H2 * 4);
  gl.readPixels(0, 0, W2, H2, gl.RGBA, gl.UNSIGNED_BYTE, sp);
  const row = W2 * 4,
    fl = new Uint8ClampedArray(sp.length);
  for (let y = 0; y < H2; y++) fl.set(sp.subarray((H2 - 1 - y) * row, (H2 - y) * row), y * row);
  t.getContext("2d").putImageData(new ImageData(fl, W2, H2), 0, 0);
  x.drawImage(t, 6, 24);
  const X = (z) => 6 + ((z - zc) / span) * H2 + W2 / 2,
    Y = (yy) => 24 + H2 / 2 - (yy / span) * H2;
  x.strokeStyle = "rgba(255,214,120,.5)";
  for (let k = 0; k < 12; k++)
    for (const sg of [1, -1]) {
      const e = g(k, 0),
        q = g(k, 1),
        d = g(k, 2),
        w1 = g(k, 5),
        w2 = g(k, 6);
      if (e[3] <= 0) continue;
      const hh = ((k + 0.5) / 12) * 1.1 * S.size;
      x.beginPath();
      x.moveTo(6, Y(sg * hh));
      x.lineTo(X(e[2]), Y(sg * e[1]));
      if (w1[2] || w1[1]) x.lineTo(X(w1[2]), Y(sg * w1[1]));
      if (w2[2] || w2[1]) x.lineTo(X(w2[2]), Y(sg * w2[1]));
      x.lineTo(X(q[2]), Y(sg * q[1]));
      if (d[3] >= 0) x.lineTo(X(q[2] + d[2] * span * 3), Y(sg * (q[1] + d[1] * span * 3)));
      x.stroke();
    }
  // Longitudinal aberration from the same rays: focus position against ray height.
  const PX = two ? cw : 0,
    PY = two ? 0 : ch;
  panel(x, PX + 2, PY + 2, cw - 4, ch - 4, "Focus against ray height (spherical aberration)");
  const xs = [],
    ys = [];
  for (let k = 0; k < 12; k++) {
    const q = g(k, 1),
      d = g(k, 2),
      e = g(k, 0);
    if (e[3] <= 0 || q[3] < 0 || d[2] <= 0) continue;
    const ty = d[1] / d[2];
    if (Math.abs(ty) < 1e-4) continue;
    xs.push(((k + 0.5) / 12) * 1.1 * S.size);
    ys.push(q[2] - q[1] / ty);
  }
  if (xs.length > 1)
    plot(x, PX + 2, PY + 2, cw - 4, ch - 4, xs, ys, "#7fd6a4", "ray height, axis focus z", "z");
}
