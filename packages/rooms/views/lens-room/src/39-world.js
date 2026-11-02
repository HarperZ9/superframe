// ======================================================================= World
function worldBody() {
  const f = FIELDS[S.field];
  if (S.field == "formula") {
    return S.formula && S.formula.kind == "index"
      ? S.formula.dec.replace(/;$/, ";") + `return ${S.formula.glsl};`
      : null;
  }
  return f.body;
}
function setWorld(w, h, mode, flip, noHit, opl, fan) {
  const body = worldBody() || "return 1.;";
  const key =
    "W|" +
    S.field +
    (S.field == "formula" && S.formula ? S.formula.text : "") +
    (S.scatOn ? "S" + S.fRho + S.fAbs : "");
  useProgram(key, () => worldFS({ body, fhelp: S.field == "formula", St: S }));
  setCommon(w, h, mode);
  const f = FIELDS[S.field];
  sI("uFlip", flip || 0);
  sI("uData", 0);
  sI("uNoHit", noHit ? 1 : 0);
  sF("uK", f.K);
  sF("uHH", f.hh);
  sF("uM", S.mass);
  sF("uLay", S.lay);
  sF("uA2", S.a2);
  sI("uSteps", f.steps);
  sI("uRoom", f.room);
  sF("uBg", f.bg);
  sF("uOplMax", opl || (f.opl ? f.opl * 2.05 * Math.PI * S.a2 : f.steps * f.hh * 2));
  sV("uFanP", fan || [0, 0, 0]);
  setScat(S);
  const o = worldObjs(f);
  gl.uniform4fv(U.uObj, o);
  sI("uNObj", o.length / 4);
  sF("uFov", 2 * Math.atan(0.9 / S.zoom));
  sF("uAp", S.ap);
  sF("uFocus", S.focus);
  const R = mul(ry(S.yaw), rx(S.pitch));
  gl.uniformMatrix3fv(U.uCamR, false, new Float32Array(R));
  const d = S.wview;
  gl.uniform3f(U.uCam, f.cam[0], f.cam[1], f.cam[2]);
}
function worldObjs(f) {
  const t = S.mark * 6.28318,
    mk =
      S.field == "gravity"
        ? [Math.cos(t) * 3.5, 0.3 * Math.sin(t * 2), 6 + Math.sin(t) * 3.5]
        : S.field == "fisheye"
          ? [0.9 * Math.cos(t), 0.25 * Math.sin(t), 0.9 + 0.9 * Math.sin(t)]
          : [-3 + 6 * S.mark, -1.2, 1.5];
  const a = [mk[0], mk[1], mk[2], 0.25];
  if (S.field == "gravity")
    a.push(
      0,
      0,
      0,
      Math.max(2 * S.mass, 0.05),
      -2.5,
      1,
      12,
      0.8,
      3,
      -1,
      16,
      1.1,
      -5,
      -2,
      18,
      1,
      0,
      4,
      14,
      0.9
    );
  else if (S.field == "fisheye")
    a.push(
      0.35,
      0.1,
      0.1,
      0.2,
      -0.5,
      -0.3,
      0.5,
      0.2,
      0.2,
      0.45,
      0.9,
      0.22,
      -0.3,
      0.3,
      -0.5,
      0.14,
      0,
      0,
      1.6,
      0.3,
      0,
      0,
      0,
      0,
      f.cam[0],
      f.cam[1],
      f.cam[2],
      0.14
    );
  else if (S.field == "mirage")
    a.push(
      -5,
      -0.6,
      12,
      1.1,
      4,
      -0.8,
      20,
      0.9,
      0,
      -1,
      30,
      0.7,
      -9,
      -0.4,
      28,
      1.3,
      12,
      -0.5,
      34,
      1.2
    );
  else
    a.push(
      2.5,
      -0.8,
      1,
      0.9,
      -3,
      -0.6,
      2.5,
      1.1,
      0,
      1.5,
      3,
      0.8,
      -2,
      0,
      -2,
      0.45,
      2.2,
      0.7,
      -2.5,
      0.35
    );
  return new Float32Array(a);
}
