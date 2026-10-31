// Runs one probe and returns the raw rows.
function drawProbe(w, h) {
  const t = getT(w, h);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
  gl.viewport(0, 0, w, h);
  gl.disable(gl.SCISSOR_TEST);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Float32Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, px);
  return px;
}
function lensProbe(St, mask = 3, flip = 0) {
  setLens(St, 24, 7, 1, mask, flip);
  const px = drawProbe(24, 7);
  return (c, r) => {
    const o = (r * 24 + c) * 4;
    return [px[o], px[o + 1], px[o + 2], px[o + 3]];
  };
}
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "none");
