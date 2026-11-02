function useProgram(key, build) {
  if (!cache[key]) {
    const t0 = performance.now();
    const p = prog(VS, build());
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const m = gl.getActiveUniform(p, i).name;
      u[m] = gl.getUniformLocation(p, m);
      if (m.endsWith("[0]")) u[m.slice(0, -3)] = u[m];
    }
    cache[key] = { p, u };
    compileLog.push({ key, ms: Math.round(performance.now() - t0) });
  }
  P = cache[key].p;
  U = cache[key].u;
  gl.useProgram(P);
}
const sF = (n, v) => U[n] != null && gl.uniform1f(U[n], v),
  sI = (n, v) => U[n] != null && gl.uniform1i(U[n], v),
  sV = (n, v) => U[n] != null && gl.uniform3f(U[n], v[0], v[1], v[2]);
function useLens(St) {
  useProgram(lensKey(St), () => {
    let grin = grinBody(St);
    return lensFS({
      a: shapeBody(St.shape, St),
      b: St.two ? shapeBody(St.shape2, St) : null,
      m: St.morphOn ? shapeBody(St.shapeM, St) : null,
      grin,
      scene: St.scene,
      fhelp: St.shape === "F",
      pol: polOn(St),
      pt: St.pt,
      St,
      meta: St.scene == "meta",
      scat: !!St.scatOn,
      tr: !!St.trOn,
      ltex: !!St.lensTex,
      pat: St.scene == "patterns" || !!St.lensTex,
      soap: St.mat == 2,
      inner: St.inner || null,
      prof: St.shape === 50 || (St.shape2 === 50 && St.two) || (St.shapeM === 50 && St.morphOn),
    });
  });
}
