// ======================================================================= Train
let TR = null;
function loadTrain() {
  const p = PRESETS[S.preset];
  const m = p.make();
  TR = Object.assign({}, m, { p });
  $("tnote").textContent = p.note;
  const seg = !!m.seg;
  for (const k of ["tseg", "tsegT"]) $("r_" + k).hidden = !seg;
  $("r_tfield").querySelector("label").textContent = m.obj !== undefined ? "Object y" : "Field";
  reset();
}
function trainArrays() {
  const s = TR.s,
    a = new Float32Array(MAXS * 4),
    b = new Float32Array(MAXS * 4),
    c = new Float32Array(MAXS * 4);
  s.forEach((q, i) => {
    const cv = q.R ? 1 / q.R : 0;
    a.set([q.z, cv, q.k, q.ty], i * 4);
    b.set([q.y, q.tilt, q.ap, q.hole], i * 4);
    const dB =
      q.V > 0 && q.n > 1 ? (q.n - 1) / q.V / (1 / (0.4861 * 0.4861) - 1 / (0.6563 * 0.6563)) : 0;
    c.set([q.n, dB, q.a4, q.a6], i * 4);
  });
  return { a, b, c };
}
const tFieldRad = () => {
  const d = TR.fieldDeg || 0.1;
  return (S.tfield * d * Math.PI) / 180;
};
function setTrain(w, h, mode, noAp = 0, fieldOverride) {
  useProgram("T|" + S.scene + "|" + (TR.src == "chart" ? "chart" : "night"), () =>
    trainFS({ scene: TR.src == "chart" ? "chart" : "night" })
  );
  setCommon(w, h, mode);
  sI("uFlip", 0);
  const { a, b, c } = trainArrays();
  gl.uniform4fv(U.uA, a);
  gl.uniform4fv(U.uB, b);
  gl.uniform4fv(U.uC, c);
  sI("uNS", TR.s.length);
  sI("uRowN", TR.s.length + 1);
  sI("uNoAp", noAp);
  const isObj = TR.obj !== undefined;
  sF("uN0", TR.n0 || 1);
  sF("uObjZ", isObj ? TR.obj : 0);
  sF("uObjK", isObj ? TR.spec || 6 : 0);
  sI("uSegI", TR.seg ? TR.seg.i : -1);
  sF("uSegP", TR.seg ? TR.seg.pitch : 1);
  sF("uSegPist", S.tseg * 1e-9);
  sF("uSegTilt", S.tsegT * 1e-6);
  const fld =
    fieldOverride !== undefined
      ? fieldOverride
      : isObj
        ? S.tfield * (TR.objField || 0.1)
        : tFieldRad();
  sF("uField", fld);
  sF("uPup", TR.pupil || TR.s[0].ap);
  sF("uImgH", imgHalf());
  sF("uGain", S.tgain || 1);
  sV("uLam", mode == 0 ? S.lam : [0, 0, 0]);
}
function imgHalf() {
  const e = (last.train && Math.abs(last.train.efl)) || 10;
  const d = ((TR.fieldDeg || 0.1) * Math.PI) / 180;
  if (TR.obj !== undefined) {
    const im = TR.s[TR.s.length - 1];
    return (
      S.tview * Math.min(im.ap, last.train ? (last.train.mag || 1) * (TR.objField || 0.1) : im.ap)
    );
  }
  return S.tview * e * Math.tan(d);
}
function trainFan(field) {
  const n = TR.s.length,
    w = 26,
    h = n + 2;
  setTrain(w, h, 1, 0, field);
  const px = drawProbe(w, h);
  return (k, row) => {
    const o = (row * w + k) * 4;
    return [px[o], px[o + 1], px[o + 2], px[o + 3]];
  };
}
function trainParax() {
  const n = TR.s.length,
    w = 26,
    h = n + 2;
  setTrain(w, h, 1, 1, 0);
  const px = drawProbe(w, h);
  return (k, row) => {
    const o = (row * w + k) * 4;
    return [px[o], px[o + 1], px[o + 2], px[o + 3]];
  };
}
function trainSpot(field, N = 96) {
  setTrain(N, N, 3, 0, field);
  return drawProbe(N, N);
}
