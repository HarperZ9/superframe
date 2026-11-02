// ======================================================================= Control wiring
const pick = (on, offs) => {
  on.setAttribute("aria-pressed", "true");
  offs.forEach((o) => o.setAttribute("aria-pressed", "false"));
};
const TABS = {
  look: "Through",
  side: "Side",
  inside: "Inside",
  walk: "Walk inside",
  back: "Looking back",
  wave: "Wave",
  caustic: "Caustic",
  diagram: "Diagram",
};
function drawTabs() {
  const t = $("tabs");
  t.innerHTML = "";
  for (const [k, l] of Object.entries(TABS)) {
    const b = document.createElement("button");
    b.textContent = l;
    b.setAttribute("aria-pressed", S.view == k ? "true" : "false");
    b.onclick = () => setView(k);
    t.append(b);
  }
}
function setView(v) {
  S.view = v;
  S.persp = v == "inside" ? "inside" : v == "back" ? "back" : v == "walk" ? "walk" : "look";
  $("over").hidden = v == "look" || v == "back" || v == "inside" || v == "walk";
  $("pad").hidden = v != "walk";
  if (v == "inside") placeInside();
  if (v == "walk") enterWalk();
  drawTabs();
  reset();
}
function setKind(k) {
  S.kind = k;
  document
    .querySelectorAll("[data-kind]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.kind == k ? "true" : "false"));
  document.querySelectorAll("[data-for]").forEach((d) => {
    d.hidden = !d.dataset.for.split(" ").includes(k);
  });
  if (k == "train" && !TR) loadTrain();
  if (k == "world") applyField();
  reset();
}
document
  .querySelectorAll("[data-kind]")
  .forEach((b) => (b.onclick = () => setKind(b.dataset.kind)));
$("shape").addEventListener("change", () => {
  const v = $("shape").value;
  S.shape = v == "F" || v == "none" ? v : +v;
  if (v == "F" && !S.formula) compileFormula();
  reset();
});
$("shape2").addEventListener("change", () => {
  const v = $("shape2").value;
  S.shape2 = v == "none" ? v : +v;
  reset();
});
$("glass").onclick = () => {
  S.mat = 0;
  pick($("glass"), [$("mirror")]);
  reset();
};
$("mirror").onclick = () => {
  S.mat = 1;
  pick($("mirror"), [$("glass")]);
  reset();
};
$("inv").onclick = () => {
  S.inv = 1 - S.inv;
  $("inv").setAttribute("aria-pressed", S.inv ? "true" : "false");
  reset();
};
function setTwo(v) {
  S.two = v;
  $("two").setAttribute("aria-pressed", v ? "true" : "false");
  $("two").textContent = v ? "Remove second lens" : "Add second lens";
  reset();
}
$("two").onclick = () => setTwo(S.two ? 0 : 1);
function setShape(v, two) {
  if (two) {
    S.shape2 = v;
    $("shape2").value = v;
  } else {
    S.shape = v;
    $("shape").value = v;
  }
}
// Galilean: light runs objective then eyepiece, but the camera looks in the reverse direction: rays leave the eye first, so lens 1 is the eyepiece.
// Biconcave eyepiece near the eye and a weak biconvex objective, spaced so the focal points coincide (found from the readout formula, afocal when d = fo + fe).
$("pGal").onclick = () => {
  setTwo(1);
  setShape(1);
  setShape(0, 1);
  setS("curve", 1);
  setS("curve2", 0);
  setS("n", 1.5);
  setS("n2", 1.5);
  setS("size", 0.5);
  setS("size2", 1);
  setS("tilt", 0);
  setS("spin", 0);
  setS("dist", 1.6);
  setS("zoom", 1.3);
  setS("focus", 9.5);
  setS("sp", 3.2);
  S.oz = 0;
  setS("sp", tuneAfocal());
  reset();
};
// Compound microscope seen backward: eyepiece first, then a strong objective close to the chart at z = 6.
$("pMic").onclick = () => {
  setTwo(1);
  setShape(0);
  setShape(0, 1);
  setS("curve", 0.3);
  setS("curve2", 1);
  setS("size", 0.8);
  setS("size2", 0.38);
  setS("n", 1.5);
  setS("n2", 1.6);
  setS("sp", 5.2);
  setS("dist", 2.1);
  setS("zoom", 1.2);
  setS("focus", 9);
  S.oz = 0.32;
  S.scene = S.scene;
  reset();
};
$("pAch").onclick = () => {
  setTwo(1);
  setShape(0);
  setShape(1, 1);
  setS("curve", 0.6);
  setS("curve2", 0.2);
  setS("size", 1);
  setS("size2", 1);
  setS("sp", 1.1);
  setS("dist", 5);
  setS("zoom", 1.3);
  S.oz = 0;
  reset();
};
// Slides the spacing until the measured exit beam is parallel: a few secant steps on the rays themselves.
function tuneAfocal() {
  let a = 2,
    b = 5;
  const sl = (sp) => {
    const St = Object.assign({}, S, { sp });
    const g = lensProbe(St);
    const d = g(0, 2);
    return d[1] / d[2];
  };
  let fa = sl(a),
    fb = sl(b);
  for (let i = 0; i < 14; i++) {
    const m = 0.5 * (a + b),
      fm = sl(m);
    if (fa * fm <= 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}
$("tpreset").onchange = () => {
  S.preset = $("tpreset").value;
  setS("tfield", 0);
  loadTrain();
};
function applyField() {
  const f = FIELDS[S.field];
  for (const [k, on] of [
    ["mass", S.field == "gravity"],
    ["lay", S.field == "mirage"],
    ["a2", S.field == "fisheye"],
  ])
    $("r_" + k).hidden = !on;
  $("r_focus").hidden = false;
  reset();
}
$("wfield").onchange = () => {
  S.field = $("wfield").value;
  S.yaw = 0;
  S.pitch = 0;
  applyField();
};
// Marker motion: runs only by request, off under reduced motion, stops when the page is hidden (the frame loop returns early then).
const rm = matchMedia("(prefers-reduced-motion: reduce)");
let moving = false;
$("wmove").onclick = () => {
  moving = !moving;
  $("wmove").setAttribute("aria-pressed", moving ? "true" : "false");
  if (moving) {
    let t0 = performance.now();
    const tick = (now) => {
      if (!moving) return;
      requestAnimationFrame(tick);
      if (document.hidden || rm.matches) {
        t0 = now;
        return;
      }
      setS("mark", (S.mark + (now - t0) / 9000) % 1);
      t0 = now;
    };
    requestAnimationFrame(tick);
  }
};
if (rm.matches) $("wmove").title = "Reduced motion is on: use the Marker slider.";
{
  const s = $("fex");
  s.innerHTML = `<option value="">Examples</option>`;
  for (const [a, b] of FEX) {
    const o = document.createElement("option");
    o.value = b;
    o.textContent = a;
    s.append(o);
  }
  s.onchange = () => {
    if (s.value) {
      $("ftext").value = s.value;
      compileFormula();
      s.value = "";
    }
  };
}
function compileFormula() {
  const txt = $("ftext").value,
    e = $("ferr");
  let fm;
  try {
    fm = fCompile(txt);
  } catch (x) {
    if (x instanceof FormulaError) {
      e.className = "bad";
      e.textContent = `Position ${x.at + 1}: ${x.message}`;
      return false;
    }
    console.error("formula failed", x);
    throw x;
  }
  // Trial compile: a grammar pass should always compile, and if it ever does not, the old formula stays and the viewer sees why.
  const trial = { ...S, formula: fm, shape: "F", two: 0, shapeM: null, inv: 0, mat: 0 };
  try {
    const t0 = performance.now();
    useLens(trial);
    const ms = performance.now() - t0;
    e.className = "note";
    e.textContent =
      (fm.kind == "surface"
        ? "Surface plate"
        : fm.kind == "level"
          ? "Level set, inside where negative"
          : "Index field in a unit ball") + `, compiled in ${ms.toFixed(0)} ms.`;
  } catch (x) {
    e.className = "bad";
    e.textContent = "The GPU compiler refused this: " + String(x.message).slice(0, 200);
    return false;
  }
  S.formula = fm;
  S.shape = "F";
  $("shape").value = "F";
  if (fm.kind == "index") {
    let neg = false;
    for (let r = 0; r <= 1; r += 0.05) if (fEval(fm.ast, { x: r, y: 0, z: 0, r }) < 0) neg = true;
    if (neg)
      e.textContent +=
        " Not physical as a plain dielectric: n² goes negative inside; rays are clamped there.";
  }
  reset();
  return true;
}
$("fgo").onclick = () => compileFormula();
$("ftext").addEventListener("keydown", (e) => {
  if (e.key == "Enter" && !e.shiftKey) {
    e.preventDefault();
    compileFormula();
  }
});
let drag = null;
cv.addEventListener("pointerdown", (e) => {
  drag = [e.clientX, e.clientY];
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", (e) => {
  if (!drag) return;
  S.yaw += (e.clientX - drag[0]) * 0.006;
  S.pitch = Math.max(-1.4, Math.min(1.4, S.pitch + (e.clientY - drag[1]) * 0.006));
  drag = [e.clientX, e.clientY];
  reset();
});
cv.addEventListener("pointerup", () => (drag = null));
cv.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (S.kind == "train")
      setS("tview", Math.max(0.05, Math.min(3, S.tview * Math.exp(e.deltaY * 0.001))));
    else setS("zoom", Math.max(1, Math.min(8, S.zoom * Math.exp(-e.deltaY * 0.001))));
  },
  { passive: false }
);
$("hide").onclick = () => {
  const f = $("app").classList.toggle("full");
  $("hide").setAttribute("aria-pressed", f ? "true" : "false");
  reset();
};
bootExtras();
bootWalk();
bootMore();
setView("look");
setKind("lens");
if (gl) requestAnimationFrame(loop);
// Test hook for the checks reported with this page.
window.__lr = {
  insideChecks,
  anchors: () => VOX,
  walkState: () => S.wk,
  autofocus,
  runWave,
  dropProfile,
  FRAMES,
  MAT,
  SCENES,
  S,
  last,
  compileLog,
  setS,
  reset,
  setKind,
  setView,
  setTwo,
  setShape,
  loadTrain,
  applyField,
  compileFormula,
  tuneAfocal,
  PRESETS,
  FIELDS,
  gl,
  get frame() {
    return frame;
  },
  get W() {
    return W;
  },
  get H() {
    return H;
  },
  get Q() {
    return Q;
  },
  get TR() {
    return TR;
  },
  measure,
};
