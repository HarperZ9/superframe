// Renders both patches into small targets with whole cycles of the 16 bands and reads the stored values, so results come from the picture's own rays.
function renderMean(St, w, h, frames, wins) {
  const a = tgt(w, h),
    b = tgt(w, h);
  let A0 = a,
    B0 = b;
  const sv = frame;
  for (let k = 0; k < frames; k++) {
    frame = k;
    setLens(St, w, h, 0);
    sI("uFrame", k);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, imgT);
    gl.activeTexture(gl.TEXTURE3);
    if (turingT) gl.bindTexture(gl.TEXTURE_2D, turingT);
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
  frame = sv;
  free(a);
  free(b);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return px;
}
