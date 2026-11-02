// ======================================================================= One progressive frame: jittered light, lens and pixel, added into an HDR buffer
function halton(i, b) {
  let f = 1,
    r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
}
function drawSample(S) {
  const gl = GLS.gl,
    d = S.d,
    n = S.samples,
    R = Math.max(d.W, d.H),
    jl = [(halton(n + 1, 2) - 0.5) * 0.32, (halton(n + 1, 3) - 0.5) * 0.32];
  const Ld = nrm([0.42 + jl[0], -0.55 + jl[1], 0.78]);
  const lv = lookAt(
      [Ld[0] * R * 3, Ld[1] * R * 3, Ld[2] * R * 3],
      [0, 0, 0],
      Math.abs(Ld[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]
    ),
    lp = ortho(R * 1.05, 0.1, R * 7),
    LVP = mul(lp, lv);
  gl.bindFramebuffer(gl.FRAMEBUFFER, GLS.smFB);
  gl.viewport(0, 0, 2048, 2048);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(GLS.dep.p);
  gl.uniformMatrix4fv(GLS.dep.u.uVP, false, LVP);
  if (S.view !== "exploded") {
    gl.bindVertexArray(S.vao.v);
    gl.drawArrays(gl.TRIANGLES, 0, S.vao.n);
  }
  const c = S.cam,
    ce = Math.cos(c.el),
    eye0 = [
      c.tx + c.dist * ce * Math.sin(c.az),
      c.ty - c.dist * ce * Math.cos(c.az),
      c.tz + c.dist * Math.sin(c.el),
    ];
  const ang = [halton(n + 1, 5) * 6.2832, Math.sqrt(halton(n + 1, 7)) * S.aper];
  const fw = nrm([c.tx - eye0[0], c.ty - eye0[1], c.tz - eye0[2]]),
    rt = nrm(cross(fw, [0, 0, 1])),
    up = cross(rt, fw);
  const eye = [0, 1, 2].map(
    (i) => eye0[i] + rt[i] * Math.cos(ang[0]) * ang[1] + up[i] * Math.sin(ang[0]) * ang[1]
  );
  const fp = [0, 1, 2].map((i) => eye0[i] + fw[i] * S.focus);
  const aspect = GLS.tW / GLS.tH,
    jx = (((halton(n + 1, 2) - 0.5) * 2) / GLS.tW) * (n ? 1 : 0),
    jy = (((halton(n + 1, 3) - 0.5) * 2) / GLS.tH) * (n ? 1 : 0),
    near = Math.max(0.05, c.dist * 0.02),
    far = c.dist * 8 + R * 4,
    VP = mul(persp(0.5, aspect, near, far, jx, jy), lookAt(eye, fp, [0, 0, 1]));
  const m = GLS.main;
  gl.bindFramebuffer(gl.FRAMEBUFFER, GLS.msFB);
  gl.viewport(0, 0, GLS.tW, GLS.tH);
  gl.clearColor(0.012, 0.014, 0.02, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(m.p);
  gl.uniformMatrix4fv(m.u.uVP, false, VP);
  gl.uniformMatrix4fv(m.u.uLV, false, LVP);
  gl.uniform3fv(m.u.uE, eye);
  gl.uniform3fv(m.u.uLd, Ld);
  gl.uniform3fv(m.u.uMk, MASKS[S.mask]);
  const units = [
    ["uL0", "L0"],
    ["uL1", "L1"],
    ["uL2", "L2"],
    ["uL3", "L3"],
    ["uD", "D"],
    ["uO", "O"],
  ];
  units.forEach(([u, t], i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, GLS.tex[t]);
    gl.uniform1i(m.u[u], i);
  });
  gl.activeTexture(gl.TEXTURE6);
  gl.bindTexture(gl.TEXTURE_2D, GLS.smTex);
  gl.uniform1i(m.u.uS, 6);
  gl.uniform1f(m.u.uCut, S.view === "section" ? S.cutY - d.H / 2 : -1e5);
  gl.uniform1f(m.u.uCutV, S.cutY / d.H);
  gl.uniform1f(m.u.uOA, S.over && S.over !== "signal" && S.view === "board" ? S.overA : 0);
  gl.uniform1f(m.u.uDim, S.over === "signal" && S.view === "board" ? 0.8 : 0);
  gl.uniform1f(m.u.uSeed, n * 0.37);
  gl.uniform1f(m.u.uZs, S.view === "section" ? S.zs : 1);
  gl.uniform1f(m.u.uDirect, GLS.hdr ? 0 : 1);
  gl.uniform2f(m.u.uTx, 1.2 / S.texW, 1.2 / S.texH);
  gl.uniform1i(m.u.uLn, d.layers);
  const lz = layerZ(d.layers).z,
    a = new Float32Array(16);
  lz.forEach((q, i) => {
    a[i * 4] = q.top;
    a[i * 4 + 1] = q.bot;
  });
  gl.uniform4fv(m.u.uLz, a);
  gl.bindVertexArray(S.vao.v);
  gl.drawArrays(gl.TRIANGLES, 0, S.vao.n);
  if (S.tab && S.view !== "exploded" && eye[2] > S.vao.z0) {
    gl.bindVertexArray(S.tab.v);
    gl.drawArrays(gl.TRIANGLES, 0, S.tab.n);
  }
  if (S.over === "signal" && S.rib && S.view === "board") {
    gl.bindVertexArray(S.rib.v);
    gl.drawArrays(gl.TRIANGLES, 0, S.rib.n);
  }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GLS.msFB);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, GLS.rsFB);
  gl.blitFramebuffer(0, 0, GLS.tW, GLS.tH, 0, 0, GLS.tW, GLS.tH, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  const q = GLS.q;
  gl.useProgram(q.p);
  gl.bindVertexArray(GLS.empty);
  gl.disable(gl.DEPTH_TEST);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(q.u.t, 0);
  if (GLS.hdr) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, GLS.acFB);
    if (n === 0) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindTexture(gl.TEXTURE_2D, GLS.rsT);
    gl.uniform1f(q.u.k, 1);
    gl.uniform1f(q.u.gr, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, GLS.acT);
    gl.uniform1f(q.u.k, 1 / (n + 1));
    gl.uniform1f(q.u.gr, 1);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, GLS.rsT);
    gl.uniform1f(q.u.k, 1);
    gl.uniform1f(q.u.gr, 0);
  }
  gl.viewport(0, 0, GLS.tW, GLS.tH);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  S.samples++;
  S.VP = VP;
}
