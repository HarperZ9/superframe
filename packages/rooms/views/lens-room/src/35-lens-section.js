function drawSection(g) {
  const big = S.view == "side",
    cvs = big ? $("over") : $("sec");
  let w, h;
  if (big) {
    const r = $("view").getBoundingClientRect();
    w = Math.min(1600, Math.round(r.width));
    h = Math.min(1200, Math.round(r.height));
    cvs.width = w;
    cvs.height = h;
  } else {
    w = h = 300;
  }
  const zc = S.two ? S.sp / 2 : 0,
    span =
      Math.max(4.4, (S.two ? S.sp : 0) + 3.8 * S.size) *
      (big && w > h ? 1 : 1) *
      (big ? Math.max(1, (h / w) * 1.2) : 1);
  setLens(S, w, h, 2);
  sF("uSpan", span);
  sF("uZc", zc);
  const t = getT(w, h, gl.RGBA8, gl.UNSIGNED_BYTE);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const sp = new Uint8ClampedArray(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, sp);
  const c2 = cvs.getContext("2d");
  const rowB = w * 4,
    tmp = new Uint8ClampedArray(sp.length);
  for (let y = 0; y < h; y++) tmp.set(sp.subarray((h - 1 - y) * rowB, (h - y) * rowB), y * rowB);
  c2.putImageData(new ImageData(tmp, w, h), 0, 0);
  const X = (z) => ((z - zc) / span) * h + w / 2,
    Y = (y) => h / 2 - (y / span) * h;
  c2.lineWidth = big ? 1.4 : 1;
  const far = span * 3;
  for (let k = 0; k < 12; k++)
    for (const sgn of [1, -1]) {
      const e = g(k, 0),
        x = g(k, 1),
        d = g(k, 2),
        w1 = g(k, 5),
        w2 = g(k, 6);
      const hh = ((k + 0.5) / 12) * 1.1 * S.size;
      c2.strokeStyle = k % 2 ? "rgba(143,211,255,.45)" : "rgba(255,214,120,.65)";
      c2.beginPath();
      c2.moveTo(0, Y(sgn * hh));
      if (e[3] > 0) {
        c2.lineTo(X(e[2]), Y(sgn * e[1]));
        if (w1[2] || w1[1]) c2.lineTo(X(w1[2]), Y(sgn * w1[1]));
        if (w2[2] || w2[1]) c2.lineTo(X(w2[2]), Y(sgn * w2[1]));
        c2.lineTo(X(x[2]), Y(sgn * x[1]));
        if (d[3] >= 0) c2.lineTo(X(x[2] + d[2] * far), Y(sgn * (x[1] + d[1] * far)));
      } else c2.lineTo(w, Y(sgn * hh));
      c2.stroke();
    }
}
