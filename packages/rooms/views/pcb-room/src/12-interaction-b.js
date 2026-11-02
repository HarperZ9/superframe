function pickFocus(e) {
  const G = $("gl"),
    r = G.getBoundingClientRect(),
    c = S.cam,
    ce = Math.cos(c.el),
    eye = [
      c.tx + c.dist * ce * Math.sin(c.az),
      c.ty - c.dist * ce * Math.cos(c.az),
      c.tz + c.dist * Math.sin(c.el),
    ],
    fw = nrm([c.tx - eye[0], c.ty - eye[1], c.tz - eye[2]]),
    rt = nrm(cross(fw, [0, 0, 1])),
    up = cross(rt, fw),
    t = Math.tan(0.25),
    a = r.width / r.height,
    x = (((e.clientX - r.left) / r.width) * 2 - 1) * t * a,
    y = (1 - ((e.clientY - r.top) / r.height) * 2) * t,
    dir = nrm([0, 1, 2].map((i) => fw[i] + rt[i] * x + up[i] * y)),
    T = layerZ(S.d.layers).total / 2;
  if (Math.abs(dir[2]) < 1e-4) return;
  const q = (T - eye[2]) / dir[2];
  if (q > 0) {
    S.focus = q * dot(dir, fw);
    S.focusSet = true;
    resetAcc();
  }
}
let lblT = 0;
function placeLabelsSoon() {
  if (lblT) return;
  lblT = requestAnimationFrame(() => {
    lblT = 0;
    placeLabels();
  });
}
function markModes() {
  for (const b of $("modes").children)
    b.setAttribute("aria-pressed", (b.dataset.m || null) === (S.over || null));
  for (const b of $("tabs").children) b.setAttribute("aria-pressed", b.dataset.v === S.view);
}
function setView(k) {
  S.view = k;
  S.focusSet = false;
  markModes();
  $("plain").textContent = PLAIN[k];
  const two = k === "schem" || k === "blue" || k === "field";
  $("over").hidden = !two;
  $("gl").hidden = two;
  if (k === "section" || k === "field") {
    $("secD").open = true;
    $("cut").value = S.d ? (S.cutY / S.d.H) * 100 : 50;
    $("cut").dispatchEvent(new Event("input"));
  }
  $("labels").textContent = "";
  if (two) {
    fit2D();
    draw2D();
  } else {
    setupTargets();
    rebuild();
    frameCam();
    if (S.over === "signal" && k === "board" && S.tl) colorSignal();
    setTimeout(placeLabels, 60);
  }
}
