let fc = 0,
  last = null,
  mdrag = 0;
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden || !gl) return;
  advance(stepsFrame);
  audio();
  if (++fc % 20 == 0) {
    const sp = spectrum();
    scopes(sp);
    read(sp);
  }
  gl.useProgram(PV.p);
  gl.uniform1i(PV.u.F, 0);
  gl.uniform1i(PV.u.M, 1);
  gl.uniform1i(PV.u.uView, S.view);
  gl.uniform2f(PV.u.uRes, cv.width, cv.height);
  gl.uniform2f(PV.u.uSrc, S.src[0], S.src[1]);
  gl.uniform2f(PV.u.uMicP, S.mic[0], S.mic[1]);
  gl.uniform1f(PV.u.uGain, S.gain * 3.2);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, MT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, cv.width, cv.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
