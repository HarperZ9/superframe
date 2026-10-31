// ======================================================================= State and controls
const $ = (id) => document.getElementById(id);
const S = {
  scatOn: false,
  trOn: false,
  sig: 6,
  hg: 0.3,
  alb: 0.98,
  fRho: "1",
  fAbs: "1",
  fTr: "1",
  illum: "D65",
  metaObs: "human",
  metaD: 0,
  patK: 0,
  moA: 3,
  moP: 0.1,
  lensTex: false,
  meta: false,
  pt: true,
  morphOn: false,
  split: 0.5,
  nMix: 0.85,
  nGain: 0.6,
  nRange: 4,
  nAnis: 0,
  nAxis: 0,
  stopD: 2,
  waveL: 550,
  waveU: 20,
  waveZ: 10,
  waveIdeal: true,
  compare: null,
  spin2: 0,
  polA: 0,
  polP: 0,
  polAa: 90,
  polPa: 0,
  stress: 0,
  omega: 2,
  volt: 0,
  bond: 0,
  film: 0.6,
  absScale: 1,
  tofT: 10,
  tofHold: false,
  kind: "lens",
  shape: 4,
  shape2: 1,
  shapeM: 5,
  two: 0,
  mat: 0,
  inv: 0,
  scene: "chart",
  zoom: 1.3,
  focus: 9.5,
  ap: 0,
  dist: 5,
  n: 1.5,
  size: 1,
  tilt: 0,
  spin: 0,
  curve: 0.6,
  disp: 0,
  yaw: 0,
  pitch: 0.06,
  n2: 1.5,
  disp2: 0,
  curve2: 0.6,
  size2: 1,
  sp: 2.5,
  oz: 0,
  morph: 0,
  preset: "cass",
  tfield: 0,
  tview: 0.5,
  tseg: 0,
  tsegT: 0,
  field: "fisheye",
  mass: 0.1,
  lay: 0.12,
  a2: 2,
  mark: 0,
  wview: 0,
  view: "look",
  absA: [0, 0, 0],
  absB: [0, 0, 0],
  lam: [0.63, 0.532, 0.465],
  formula: null,
  frame: 0,
};
const qs = new URLSearchParams(location.search);
const sliders = [
  ["cam", "zoom", "Zoom", 1, 8, 0.01, (v) => v.toFixed(1) + "×"],
  ["cam", "focus", "Focus", 0.3, 20, 0.01, (v) => v.toFixed(1)],
  ["cam", "ap", "Aperture", 0, 0.35, 0.001, (v) => (v == 0 ? "pin" : "f/" + (0.5 / v).toFixed(1))],
  ["cam", "dist", "Distance", 0.1, 12, 0.01, (v) => v.toFixed(1)],
  ["lens", "n", "Index", 1, 2.6, 0.005, (v) => v.toFixed(3)],
  ["lens", "curve", "Strength", 0, 1, 0.005, (v) => v.toFixed(2)],
  ["lens", "size", "Size", 0.25, 1.8, 0.005, (v) => v.toFixed(2)],
  ["lens", "tilt", "Tilt", -90, 90, 0.5, (v) => v.toFixed(0) + "°"],
  ["lens", "spin", "Spin", -180, 180, 0.5, (v) => v.toFixed(0) + "°"],
  ["lens", "disp", "Colour split", 0, 0.12, 0.001, (v) => v.toFixed(3)],
  ["lens2", "sp", "Spacing", 0, 12, 0.01, (v) => v.toFixed(2)],
  ["lens2", "n2", "Index", 1, 2.6, 0.005, (v) => v.toFixed(3)],
  ["lens2", "curve2", "Strength", 0, 1, 0.005, (v) => v.toFixed(2)],
  ["lens2", "size2", "Size", 0.25, 1.8, 0.005, (v) => v.toFixed(2)],
  ["lens2", "disp2", "Colour split", 0, 0.12, 0.001, (v) => v.toFixed(3)],
  ["trainS", "tfield", "Field", 0, 1, 0.002, (v) => v.toFixed(2)],
  ["trainS", "tview", "View span", 0.05, 3, 0.005, (v) => v.toFixed(2) + "×"],
  ["trainS", "tseg", "Piston", 0, 500, 1, (v) => v.toFixed(0) + " nm"],
  ["trainS", "tsegT", "Seg tilt", 0, 20, 0.1, (v) => v.toFixed(1) + " µrad"],
  ["worldS", "mass", "Mass", 0, 1, 0.002, (v) => v.toFixed(3)],
  ["worldS", "lay", "Layer", -0.3, 0.3, 0.002, (v) => v.toFixed(3)],
  ["worldS", "a2", "Sphere R", 0.5, 4, 0.01, (v) => v.toFixed(2)],
  ["worldS", "mark", "Marker", 0, 1, 0.002, (v) => v.toFixed(2)],
];
function addSlider(p, k, l, a, b, st, fm) {
  const r = document.createElement("div");
  r.className = "row";
  r.id = "r_" + k;
  r.innerHTML = `<label for="s_${k}">${l}</label><input id="s_${k}" type="range" min="${a}" max="${b}" step="${st}" value="${S[k]}"><output id="o_${k}"></output>`;
  $(p).append(r);
  const i = r.querySelector("input"),
    o = r.querySelector("output");
  const up = () => {
    o.textContent = fm(+i.value);
  };
  up();
  i.addEventListener("input", () => {
    S[k] = +i.value;
    up();
    reset();
  });
  r._up = up;
  return r;
}
for (const x of sliders) addSlider(...x);
function setS(k, v) {
  S[k] = v;
  const i = $("s_" + k);
  if (i) {
    i.value = v;
    $("r_" + k)._up();
  }
  reset();
}
fillShapes($("shape"));
fillShapes($("shape2"), [30, 31, 32, 33, "F"]);
$("shape").value = S.shape;
$("shape2").value = S.shape2;
{
  const sel = $("tpreset");
  const gs = {};
  for (const [k, p] of Object.entries(PRESETS)) {
    let g = gs[p.group];
    if (!g) {
      g = gs[p.group] = document.createElement("optgroup");
      g.label = p.group;
      sel.append(g);
    }
    const o = document.createElement("option");
    o.value = k;
    o.textContent = p.name;
    g.append(o);
  }
  sel.value = S.preset;
}
{
  const sel = $("wfield");
  for (const [k, p] of Object.entries(FIELDS)) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = p.name;
    sel.append(o);
  }
  sel.value = S.field;
}
