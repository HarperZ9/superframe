function clearF() {
  for (const t of [A, B]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  step = 0;
  hist.length = 0;
}
function build() {
  const r = rooms[S.room],
    d = new Float32Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const q = r.f(x + 0.5, y + 0.5),
        i = (y * N + x) * 4;
      d[i] = CFL * (q.k ?? 1) * S.speed;
      d[i + 1] = q.w ? 1 : 0;
      let edge = 1;
      if (r.open) {
        const b = Math.min(x, y, N - 1 - x, N - 1 - y);
        if (b < 32) edge = 1 - 0.12 * ((32 - b) / 32) ** 2;
      } else if (x < 1 || y < 1 || x > N - 2 || y > N - 2) d[i + 1] = 1;
      d[i + 2] = edge;
    }
  gl.bindTexture(gl.TEXTURE_2D, MT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, d);
  for (const [a, b] of [
    [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
    [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ])
    gl.texParameteri(gl.TEXTURE_2D, a, b);
  clearF();
}
function setRoom(n) {
  S.room = n;
  sel.value = n;
  const r = rooms[n];
  S.src = [...r.s];
  S.mic = [...r.m];
  if (r.view != null) pick("vw", r.view);
  if (n == "Parabolic dish") {
    S.src = [...r.src2];
  }
  build();
}
let step = 0,
  hist = [],
  stepsFrame = 50,
  listening = false,
  ac = null,
  nextT = 0,
  audioQ = [],
  clicks = 0,
  moveMic = false,
  paused = false;
function drive() {
  const t = step * DT,
    w = 2 * Math.PI;
  if (S.srcType == 0) {
    const ramp = Math.min(1, step / 200);
    return S.amp * ramp * Math.sin(w * S.f * t);
  }
  if (S.srcType == 1) {
    const u = (step - clicks - 20) / 6;
    return step - clicks < 60 ? S.amp * 4 * (1 - 2 * u * u) * Math.exp(-u * u) : 0;
  }
  const T = 0.02,
    ph = (t % T) / T;
  return S.amp * Math.sin(w * (200 + 7800 * ph * 0.5) * (t % T));
}
function micDraw(i) {
  gl.useProgram(PM.p);
  gl.uniform1i(PM.u.F, 0);
  gl.uniform2i(PM.u.uMic, Math.round(S.mic[0]), Math.round(S.mic[1]));
  gl.bindFramebuffer(gl.FRAMEBUFFER, H.f);
  gl.viewport(0, 0, HW, 1);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(i, 0, 1, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.disable(gl.SCISSOR_TEST);
}
function advance(n) {
  const px = new Float32Array(HW * 4);
  let c = 0;
  for (let i = 0; i < n; i++) {
    gl.useProgram(PS.p);
    gl.uniform1i(PS.u.F, 0);
    gl.uniform1i(PS.u.M, 1);
    gl.uniform1f(PS.u.uDamp, S.damp);
    gl.uniform1f(PS.u.uAmp, drive());
    gl.uniform2f(PS.u.uSrc, S.src[0], S.src[1]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, MT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.f);
    gl.viewport(0, 0, N, N);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [A, B] = [B, A];
    step++;
    gl.bindTexture(gl.TEXTURE_2D, A.t);
    micDraw(c);
    c++;
    if (c == HW || i == n - 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, H.f);
      gl.readPixels(0, 0, HW, 1, gl.RGBA, gl.FLOAT, px);
      for (let j = 0; j < c; j++) hist.push(px[j * 4]);
      c = 0;
    }
  }
  if (hist.length > 1 << 15) hist.splice(0, hist.length - (1 << 15));
}
