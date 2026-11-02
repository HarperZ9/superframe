// ======================================================================= Inside view, autofocus, framing, compare, capture, immersion, morph
function placeInside() {
  const g = lensProbe(S);
  for (let k = 0; k < 12; k++) {
    const e = g(k, 0),
      q = g(k, 1);
    if (e[3] > 0 && g(k, 3)[3] > 0) {
      const w1 = g(k, 5);
      const hx = w1[2] || w1[1] ? w1 : q;
      S.insideP = [(e[0] + hx[0]) / 2, (e[1] + hx[1]) / 2, (e[2] + hx[2]) / 2];
      return;
    }
  }
  S.insideP = null;
}
let afTarget = null;
// Contrast autofocus on the render itself: sweeps the focus, renders a small view with a real aperture at each stop, scores gradient energy in a window, and fits a parabola to the top three.
function autofocus(cx = 0.5, cy = 0.5) {
  if (S.kind != "lens") return;
  const w = 256,
    h = Math.max(64, Math.round(256 * (H / W))),
    a = tgt(w, h),
    b = tgt(w, h),
    win = 0.12;
  let best = [];
  const Fs = [];
  for (let i = 0; i < 22; i++) Fs.push(0.6 * Math.pow(40, i / 21));
  const St = Object.assign({}, S, {
    ap: Math.max(S.ap, 0.09),
    frame: 0,
    pt: false,
    polA: 0,
    polP: 0,
  });
  const sf = frame;
  let A0 = a,
    B0 = b;
  const scores = [];
  for (const F of Fs) {
    St.focus = F;
    frame = 0;
    for (let k = 0; k < 28; k++) {
      setLens(St, w, h, 0);
      frame = k;
      sI("uFrame", k);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, imgT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, A0.t);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B0.f);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      [A0, B0] = [B0, A0];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, A0.f);
    const px = new Float32Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, px);
    const x0 = Math.max(1, Math.round((cx - win) * w)),
      x1 = Math.min(w - 2, Math.round((cx + win) * w)),
      y0 = Math.max(1, Math.round((cy - win) * h)),
      y1 = Math.min(h - 2, Math.round((cy + win) * h));
    let s = 0;
    const B = 3,
      L0 = (x, y) => {
        const o = (y * w + x) * 4;
        const v = px[o] + px[o + 1] + px[o + 2];
        return v / (1 + v);
      },
      L = (x, y) => {
        let t = 0;
        for (let j = 0; j < B; j++)
          for (let i = 0; i < B; i++) t += L0(Math.min(w - 1, x + i), Math.min(h - 1, y + j));
        return t / (B * B);
      };
    for (let y = y0; y < y1 - B; y += B)
      for (let x = x0; x < x1 - B; x += B) {
        const gx = L(x + B, y) - L(x, y),
          gy = L(x, y + B) - L(x, y);
        s += gx * gx + gy * gy;
      }
    scores.push(s);
  }
  free(a);
  free(b);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  frame = 0;
  let bi = 0;
  scores.forEach((v, i) => {
    if (v > scores[bi]) bi = i;
  });
  let Fbest = Fs[bi];
  if (bi > 0 && bi < Fs.length - 1) {
    const a0 = scores[bi - 1],
      b0 = scores[bi],
      c0 = scores[bi + 1],
      o = (0.5 * (a0 - c0)) / (a0 - 2 * b0 + c0 || 1);
    Fbest = Fs[bi] * Math.pow(40, o / 21);
  }
  setS("focus", Math.min(20, Fbest));
  last.af = { focus: Fbest, scores, Fs };
  $("afnote").textContent =
    "Contrast peak at focus " + Fbest.toFixed(2) + ", measured on the render.";
  if (S.ap == 0) setS("ap", 0.03);
}
