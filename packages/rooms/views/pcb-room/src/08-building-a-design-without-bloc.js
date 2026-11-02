// ======================================================================= Building a design without blocking the page
let buildTok = 0;
function cachedDesign(text, force) {
  return S.cache.get(force + "|" + text);
}
function buildAsync(text, force) {
  const key = force + "|" + text;
  if (S.cache.has(key)) return Promise.resolve(S.cache.get(key));
  const tok = ++buildTok;
  return new Promise((res) => {
    const g = buildGen(text, force || undefined);
    const tick = () => {
      if (tok !== buildTok) return res(null);
      const t0 = performance.now();
      let r;
      for (;;) {
        r = g.next();
        if (r.done || performance.now() - t0 > 30) break;
      }
      if (r.done) {
        if (!r.value.errors.length) S.cache.set(key, r.value);
        return res(r.value);
      }
      setStatus("Routing " + (r.value.net || "") + ", pass " + r.value.pass);
      setTimeout(tick, 0);
    };
    setStatus("Placing parts");
    setTimeout(tick, 0);
  });
}
async function generate() {
  const text = $("net").value,
    force = S.force || 0;
  $("neterr").textContent = "";
  const d = await buildAsync(text, force);
  if (!d) return;
  if (d.errors.length) {
    $("neterr").textContent = d.errors.slice(0, 5).join("; ");
    setStatus("");
    return;
  }
  adopt(d);
}
function adopt(d) {
  S.d = d;
  S.tl = null;
  S.joule = null;
  S.plantI = 0;
  const s = 2048 / Math.max(d.W, d.H);
  S.texW = Math.ceil(d.W * s);
  S.texH = Math.ceil(d.H * s);
  for (let l = 0; l < 4; l++) {
    const li = l < d.layers ? l : 0;
    uploadTex("L" + l, layerCanvas(d, li, s), true);
  }
  uploadTex("D", drillCanvas(d, s), true);
  S.cutY = defaultCut(d);
  S.mask = $("maskc").value;
  fillNets();
  $("l2").setAttribute("aria-pressed", d.layers === 2);
  $("l4").setAttribute("aria-pressed", d.layers === 4);
  rebuild();
  frameCam();
  updateOverlay();
  renderManufacture();
  renderDRC();
  renderArray();
  renderRead();
  if (S.view === "schem" || S.view === "blue" || S.view === "field") {
    fit2D();
    draw2D();
  }
  setStatus(d.routeFail.length ? "Router left " + d.routeFail.length + " nets open" : "");
}
function defaultCut(d) {
  const c = d.vias
    .filter((v) => v.x > 2 && v.x < d.W - 2)
    .sort(
      (a, b) => Math.hypot(a.x - d.W / 2, a.y - d.H / 2) - Math.hypot(b.x - d.W / 2, b.y - d.H / 2)
    )[0];
  return c ? c.y : d.H / 2;
}
function rebuild() {
  const d = S.d;
  if (!d) return;
  const b = buildMesh(d, S);
  freeVAO(S.vao);
  S.vao = makeVAO(b.arr);
  S.vao.z0 = b.zBottom;
  freeVAO(S.tab);
  const R = Math.max(d.W, d.H) * 5,
    z = b.zBottom - (S.view === "section" ? 4 : 2.4),
    t = new Mesh(d.W, d.H);
  t.quad([-R, -R, z], [R, -R, z], [R, R, z], [-R, R, z], [0, 0, 1], [0.012, 0.013, 0.016], 11);
  S.tab = makeVAO(new Float32Array(t.a));
  resetAcc();
  placeLabels();
}
function frameCam() {
  const d = S.d,
    G = $("gl"),
    asp = (G.clientWidth || 1) / (G.clientHeight || 1),
    R = Math.max(d.W / Math.min(asp, 1.6), d.H) * 1.05 + (d.W > d.H ? 0 : 0),
    c = S.cam;
  if (S.view === "section") {
    c.az = 0.12;
    c.el = 0.16;
    c.dist = Math.max(12, R * 0.5);
    c.tx = 0;
    c.ty = S.cutY - d.H / 2;
    c.tz = 0;
    const v = nearestVia(d);
    if (v) c.tx = clamp(v.x - d.W / 2, -d.W / 2, d.W / 2);
  } else if (S.view === "exploded") {
    c.az = 0.55;
    c.el = 0.42;
    c.dist = R * 2.9;
    c.tx = 0;
    c.ty = 0;
    c.tz = 0;
  } else {
    c.az = 0.32;
    c.el = 0.9;
    c.dist = R * 2.5;
    c.tx = 0;
    c.ty = 0;
    c.tz = 0;
  }
  S.focus = c.dist;
  resetAcc();
}
function nearestVia(d) {
  let b = null,
    e = 1e9;
  for (const v of d.vias) {
    const q = Math.abs(v.y - S.cutY);
    if (q < e) {
      e = q;
      b = v;
    }
  }
  return b;
}
function placeLabels() {
  const h = $("labels");
  if (S.view !== "exploded" && S.view !== "section") {
    h.textContent = "";
    return;
  }
  const r = $("gl").getBoundingClientRect();
  h.textContent = "";
  if (!S.VP) return;
  let lastY = -99;
  for (const L of S.labelsAt || []) {
    const p = L.left ? [S.cam.tx, L.p[1], L.p[2]] : L.p,
      v = S.VP,
      w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
    if (w <= 0) continue;
    const x = (v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12]) / w,
      y = (v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13]) / w;
    const sx = L.left ? 6 : (x * 0.5 + 0.5) * r.width,
      sy = (0.5 - y * 0.5) * r.height;
    if (sx < 4 || sx > r.width - 60 || sy < 40 || sy > r.height - 10 || Math.abs(sy - lastY) < 13)
      continue;
    lastY = sy;
    const e = document.createElement("span");
    e.textContent = L.text;
    e.style.left = sx + 4 + "px";
    e.style.top = sy + "px";
    h.appendChild(e);
  }
}
