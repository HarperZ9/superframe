// ======================================================================= Frame loop
let dirty = true;
function reset() {
  frame = 0;
  dirty = true;
  if (typeof cxReset == "function") cxReset();
}
function measure() {
  if (S.kind == "lens") measureLens();
  else if (S.kind == "train") measureTrain();
  else measureWorld();
  if (S.view == "wave") runWave();
  if (S.view == "caustic" && S.kind == "lens") runCaustic();
  if (S.view == "diagram") drawDiagram();
  applyLevel();
}
function renderSide(w, h) {
  if (S.kind == "lens") setLens(S, w, h, 0);
  else if (S.kind == "train") setTrain(w, h, 0);
  else setWorld(w, h, 0);
}
let halted = false;
function loop() {
  if (halted) return;
  requestAnimationFrame(loop);
  if (!gl || document.hidden) return;
  size();
  try {
    if (dirty) {
      measure();
      dirty = false;
    }
  } catch (e) {
    console.error("measure failed", e);
    fail(String(e.message || e));
    dirty = false;
    return;
  }
  if (S.view != "look" && S.view != "back" && S.view != "inside" && S.view != "walk") return;
  if (frame >= (S.pt ? 6000 : 1000)) return;
  const now = performance.now();
  if (tLast) {
    tSum += now - tLast;
    tN++;
    if (tN >= 12) {
      const m = tSum / tN;
      tSum = tN = 0;
      if (m < 24 && Q < qMax) {
        Q = Math.min(qMax, Q * 1.4);
        tLast = 0;
        return;
      } else if (m > 160 && Q > 160) Q = Math.max(160, Q * 0.6);
    }
  }
  tLast = now;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, imgT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.f);
  gl.viewport(0, 0, W, H);
  try {
    if (S.compare && S.kind == "lens") {
      gl.enable(gl.SCISSOR_TEST);
      const sx = Math.round(W * S.split);
      gl.scissor(0, 0, sx, H);
      setLens(S.compare, W, H, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.scissor(sx, 0, W - sx, H);
      setLens(S, W, H, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    } else {
      renderSide(W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  } catch (e) {
    console.error("render setup failed", e);
    halted = true;
    return;
  }
  sps.n += W * H;
  if (frame == 0) {
    const er = gl.getError();
    if (er) {
      console.error("draw failed", er);
      fail(
        "The graphics driver refused this shader at draw time (GL error " +
          er +
          "). Choose another shape or field."
      );
    } else $("err").hidden = true;
  }
  [A, B] = [B, A];
  frame++;
  display(now);
}
const sps = { n: 0, t: performance.now(), v: 0 };
function display(now) {
  const fr = frameOf(S);
  let neural = false;
  if (S.frame == 20) {
    neural = stepCortex();
  }
  gl.useProgram(D);
  const u = (n) => gl.getUniformLocation(D, n);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, neural ? CX.a.t : null);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u("t"), 0);
  gl.uniform1i(u("cx"), 2);
  gl.uniform1i(u("uF"), S.frame);
  gl.uniform1i(u("uDich"), S.metaD || 0);
  const sw = S.frame == 15 ? (rm.matches || S.tofHold ? S.tofT : ((now * 0.003) % 1) * 30) : 0;
  gl.uniform1f(u("uSweep"), sw);
  gl.uniform2f(u("uR"), W, H);
  gl.uniform1f(u("uNA"), S.nMix);
  gl.uniform1f(u("uDmax"), fr.dmax || 20);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (S.compare && S.kind == "lens") {
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0.9, 0.9, 0.9, 1);
    gl.scissor(Math.round(W * S.split) - 1, 0, Math.max(2, (W / 400) | 0), H);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }
  if (now - sps.t > 1000) {
    sps.v = sps.n / ((now - sps.t) / 1000);
    sps.t = now;
    sps.n = 0;
    const e = $("spsv");
    if (e) e.textContent = (sps.v / 1e6).toFixed(1) + " M/s at " + W + " by " + H;
  }
}
