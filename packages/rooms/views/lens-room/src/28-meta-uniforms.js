function setMeta(St) {
  if (!U.uRa) return;
  gl.uniform1fv(U.uRa, new Float32Array(MP.R1));
  gl.uniform1fv(U.uRb, new Float32Array(MP.R2));
  const E = ILL[St.illum || "D65"];
  let Y = 0;
  BL.forEach((l, i) => (Y += cmfB[i][1] * E[i]));
  const sens = St.metaObs == "bee" || St.metaObs == "bird" ? SENS[St.metaObs] : cmfB;
  const c = new Float32Array(48),
    e = new Float32Array(16);
  let sc = [0, 0, 0];
  sens.forEach((v, i) => v.forEach((q, k) => (sc[k] += q * E[i])));
  sens.forEach((v, i) => {
    const nrm = sens === cmfB ? Y : 0;
    v.forEach((q, k) => (c[i * 3 + k] = q / (nrm || sc[k] || 1)));
    e[i] = E[i] * 16;
  });
  gl.uniform3fv(U.uCmf, c);
  gl.uniform1fv(U.uEll, e);
}
