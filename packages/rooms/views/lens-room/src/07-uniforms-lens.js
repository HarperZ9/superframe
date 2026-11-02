function setLens(St, w, h, mode, mask = 3, flip = 0) {
  useLens(St);
  setCommon(w, h, mode);
  sI("uMask", mask);
  sI("uFlip", flip);
  sI("uMat", St.mat);
  sI("uInv", St.inv);
  sI(
    "uSpec",
    mode == 0 &&
      St.scene != "meta" &&
      (St.disp > 0 || St.disp2 > 0 || St.mat == 2 || polOn(St) || frameOf(St).lam)
      ? 1
      : 0
  );
  sI("uData", frameOf(St).data || 0);
  sI("uRemap", mode == 0 && frameOf(St).lam ? 1 : 0);
  sV("uLam", frameOf(St).lam || S.lam);
  sF("uFacet", mode == 0 && frameOf(St).facet ? frameFacet(St) : 0);
  if (U.uCrop) gl.uniform2f(U.uCrop, 0, 0);
  sI("uBounces", St.bounce || (St.scatOn ? 96 : St.persp == "walk" ? 24 : St.pt ? 18 : 12));
  sF("uMirT", St.mirT || 0);
  sF("uMirR", St.mirR || 0);
  sF("uMl", St.mirL || 0);
  sF("uFilm", St.film || 0.6);
  sI("uBire", St.bire ? 1 : 0);
  sI("uBireF", St.bireF || 0);
  sF("uNe", St.dne || 0);
  sV("uAxis", [0, 0.7071, 0.7071]);
  sF("uLiq", liqValue(St));
  if (U.uProf) gl.uniform1fv(U.uProf, dropProfile(St.bond || 0).h);
  sI("uPA", St.polA ? 1 : 0);
  sI("uPP", St.polP ? 1 : 0);
  const pa = ((St.polAa || 0) * Math.PI) / 180,
    pp = ((St.polPa || 0) * Math.PI) / 180;
  sV("uPolA", [Math.cos(pa), Math.sin(pa), 0]);
  sV("uPolP", [Math.cos(pp), Math.sin(pp), 0]);
  sF("uStress", St.stress || 0);
  setInner(St, mode);
  setScat(St);
  setMeta(St);
  if (U.uMoA != null || U.uPatK != null || U.uMoP != null) {
    sF("uMoA", ((St.moA || 0) * Math.PI) / 180);
    sF("uMoP", St.moP || 0.1);
    sI("uPatK", St.patK || 0);
    if (U.uTur != null) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, turing());
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(U.uTur, 3);
    }
  }
  sV("uSunD", [0.4656, 0.8381, -0.3259]);
  sF("uStopR", St.stopR || 1);
  sF("uZr", St.zr || 0);
  sF("uNA", St.n);
  sF("uBA", St.disp / DISPB);
  sF("uNB", St.n2);
  sF("uBB", St.disp2 / DISPB);
  sF("uCurve", St.curve);
  sF("uCurve2", St.curve2);
  sF("uSize", St.size);
  sF("uS2", St.size2 / St.size);
  sF("uSp", St.sp / St.size);
  sF("uMorph", St.morph);
  sF("uFov", 2 * Math.atan((St.persp == "walk" ? 0.95 : 0.45) / St.zoom));
  sF("uAp", St.persp == "walk" ? 0 : St.ap);
  sF("uFocus", St.focus);
  {
    const ks = (St.wscale || 0.1) / 0.1;
    sV(
      "uAbsA",
      St.absA.map((a) => a * ks)
    );
    sV(
      "uAbsB",
      St.absB.map((a) => a * ks)
    );
  }
  sV("uOff", [0, 0, St.oz]);
  gl.uniformMatrix3fv(
    U.uRot,
    false,
    new Float32Array(mul(ry((St.spin * Math.PI) / 180), rx((St.tilt * Math.PI) / 180)))
  );
  const back = St.persp == "back",
    R = mul(ry(St.yaw + (back ? Math.PI : 0)), rx(St.pitch));
  const dir = [R[6], R[7], R[8]];
  gl.uniformMatrix3fv(U.uCamR, false, new Float32Array(R));
  let cam = [-dir[0] * St.dist, -dir[1] * St.dist, -dir[2] * St.dist];
  if (back) cam = [0, -0.2, 5.7];
  if (St.persp == "inside" && St.insideP) cam = St.insideP;
  if (St.persp == "walk" && St.wk) cam = stackToWorld(St, St.wk);
  gl.uniform3f(U.uCam, cam[0], cam[1], cam[2]);
  if (U.uMarkP) {
    if (back) gl.uniform4f(U.uMarkP, 0, 0, -St.dist, 0.32);
    else if (St.selfMark) gl.uniform4f(U.uMarkP, cam[0], cam[1], cam[2] - 0.001, 0.18);
    else gl.uniform4f(U.uMarkP, 0, 0, 0, 0);
  }
}
