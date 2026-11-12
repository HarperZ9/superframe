// Derived from game/engine/tools/visualcheck/analyse.js (the systems engineer's check), with the flagged pixels
// returned as marks for proto/markup.mjs. Kept here only to show what the check counts; the check itself governs.
// Runs inside play.html (tools/visual-check.mjs injects it). Self-contained on purpose: it judges the
// build it runs in with its own rules, and reads only the plate's data, the screen and what each
// figure stands on, so a build cannot pass by changing what the check imports.
// Returns { figures: [...], shadow: {...}, fails: [...] } for the view on screen.
async (opts) => {
  const { bodyR = 0.25, propStep = 0.4, head = 2.0, minProp = 3, band = [0.25, 2.0], offFloorMax = 0.03, stackMax = 40 } = opts || {};
  const c = window.__lw, G = c.G, play = c.play, cam = play.cam, place = cam.place(), geo = cam.geo(), fr = cam.frameNow();
  if (!place || !geo || !fr) return { error: "the plate is not ready" };
  const { plateArena } = await import("/engine/combat/sim/plate.mjs");
  const A = plateArena(place, geo.pos, geo.ids, { cell: 0.25, datum: place.datum || null }), { w, h, cells } = A.grid, cs = A.cell, [ox, oz] = A.origin;
  // the check's own prop grid: three or more samples 0.4 to 2 m over a cell's floor
  const s = place.geoScale || 1, gw = Math.round(place.width * s), gh = Math.round(place.height * s), tall = new Uint16Array(w * h);
  for (let i = 0; i < gw * gh; i++) { const x = geo.pos[i * 3], y = geo.pos[i * 3 + 1], z = geo.pos[i * 3 + 2]; if (!Number.isFinite(x)) continue; const q = Math.floor((x - ox) / cs), r = Math.floor((z - oz) / cs); if (q < 0 || r < 0 || q >= w || r >= h) continue; const cell = cells[r * w + q]; if (!cell) continue; const up = y - cell.h; if (up > propStep && up < head) tall[r * w + q]++; }
  const prop = (q, r) => q >= 0 && r >= 0 && q < w && r < h && tall[r * w + q] >= minProp;
  const geoY = (sx, sy) => { const px = fr.left + sx / fr.zoom, py = fr.top + sy / fr.zoom, gx = Math.floor(px * s), gy = Math.floor(py * s); if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return null; const y = geo.pos[(gy * gw + gx) * 3 + 1]; return Number.isFinite(y) ? y : null; };
  // who is on screen: the people layer's figures, and a fight's fighters (plate arenas are world x, z)
  const figs = (play.people.figures ? play.people.figures() : []).map((f) => ({ who: f.who, at: f.at }));
  const C = G.ext && G.ext.combat, W = C && C.current && C.current.W;
  if (W && document.querySelector("canvas.fightcanvas")) for (const F of W.fighters) { if (F.out) continue; const q = Math.floor((F.x - ox) / cs), r = Math.floor((F.z - oz) / cs), cell = q >= 0 && r >= 0 && q < w && r < h ? cells[r * w + q] : null; figs.push({ who: F.id, at: [F.x, cell ? cell.h : 0, F.z], fighter: true }); }
  const layers = [play.people.canvas || document.querySelector("canvas.peoplecanvas"), document.querySelector("canvas.fightcanvas")].filter(Boolean).map((cv) => ({ cv, d: cv.width && cv.height ? cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data : null, w: cv.width })).filter((L) => L.d);
  const plateCv = document.querySelector(".platecam canvas"), pd = plateCv.getContext("2d").getImageData(0, 0, plateCv.width, plateCv.height).data, pw = plateCv.width;
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const px = (sx, sy) => { for (const L of layers) { const i = (Math.round(sy) * L.w + Math.round(sx)) * 4; if (sx < 0 || sy < 0 || sx >= L.w || i + 3 >= L.d.length) continue; const a = L.d[i + 3] / 255; if (a > 0.01) return { a, l: lum(L.d[i], L.d[i + 1], L.d[i + 2]) }; } return null; };
  const plateLum = (sx, sy) => { const x = Math.floor(fr.left + sx / fr.zoom), y = Math.floor(fr.top + sy / fr.zoom), i = (y * pw + x) * 4; return x < 0 || y < 0 || x >= pw || i + 3 >= pd.length ? null : lum(pd[i], pd[i + 1], pd[i + 2]); };
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const marks = { over: [], stack: [], off: [], shadow: [] }; const out = { marks, figures: [], shadow: { pixels: 0, offFloor: 0, stacked: 0, medianAlpha: null }, fails: [] }, shadows = [];
  for (const f of figs) {
    const sp = cam.toScreen(f.at), ppm = cam.scaleAt(f.at); if (!sp || !ppm) continue;
    const [x, y] = sp, q0 = Math.floor((f.at[0] - ox) / cs), r0 = Math.floor((f.at[2] - oz) / cs), R = Math.ceil(bodyR / cs);
    let inProp = 0; for (let dr = -R; dr <= R; dr++) for (let dq = -R; dq <= R; dq++) { const ex = Math.max(0, Math.abs(dq) - 0.5) * cs, ez = Math.max(0, Math.abs(dr) - 0.5) * cs; if (Math.hypot(ex, ez) < bodyR && prop(q0 + dq, r0 + dr)) inProp++; }
    // standing on a top: the figure's feet more than 0.3 m over the floor around it (median of the ground within 1.5 m)
    const around = []; for (let dr = -6; dr <= 6; dr++) for (let dq = -6; dq <= 6; dq++) { const q = q0 + dq, r = r0 + dr; if (q < 0 || r < 0 || q >= w || r >= h || prop(q, r)) continue; const cc = cells[r * w + q]; if (cc && Math.hypot(dq, dr) * cs <= 1.5) around.push(cc.h); }
    const floorAround = med(around), onTop = floorAround != null && f.at[1] - floorAround > 0.3;
    const body = [], ring = [];
    // figure pixels drawn where the painting stands more than 0.5 m nearer than the figure (a counter or wall in front): occlusion failures
    const fd = cam.depthOf ? cam.depthOf(f.at) : null; let drawnOver = 0;
    for (let sy = y - 2.0 * ppm; sy < y - 0.15 * ppm; sy += Math.max(1, ppm / 40)) for (let sx = x - 0.45 * ppm; sx < x + 0.45 * ppm; sx += Math.max(1, ppm / 40)) { const p = px(sx, sy); if (p && p.a > 0.9) { body.push(p.l); if (fd != null && cam.depthAt && cam.depthAt(sx, sy) < fd - 0.5) { drawnOver++; marks.over.push([Math.round(sx), Math.round(sy)]); } } }
    for (let sy = y - 2.3 * ppm; sy < y + 0.4 * ppm; sy += Math.max(1, ppm / 20)) for (let sx = x - 1.6 * ppm; sx < x + 1.6 * ppm; sx += Math.max(1, ppm / 20)) { if (Math.abs(sx - x) < 0.6 * ppm && sy > y - 2.1 * ppm) continue; const l = plateLum(sx, sy); if (l != null) ring.push(l); }
    for (let sy = y - 0.35 * ppm; sy < y + 0.35 * ppm; sy++) for (let sx = x - 0.8 * ppm; sx < x + 0.8 * ppm; sx++) { const p = px(sx, sy); if (p && p.a >= 0.12 && p.a <= 0.88 && p.l < 0.12) { const gy = geoY(sx, sy); shadows.push({ a: p.a, sx: Math.round(sx), sy: Math.round(sy), off: gy == null ? false : Math.abs(gy - f.at[1]) > 0.2 }); } }
    const fb = med(body), pl = med(ring), ratio = fb != null && pl != null ? fb / Math.max(0.02, pl) : null;
    const overShare = body.length ? drawnOver / body.length : 0;
    const row = { who: f.who, fighter: !!f.fighter, at: f.at.map((v) => +v.toFixed(2)), inProp, onTop, drawnOver: +overShare.toFixed(3), figureLum: fb && +fb.toFixed(3), plateLum: pl && +pl.toFixed(3), ratio: ratio && +ratio.toFixed(2) };
    out.figures.push(row);
    if (overShare > 0.05) out.fails.push(`${f.who}: ${(overShare * 100).toFixed(0)}% of the figure is drawn over painting that stands in front of it (occlusion)`);
    if (onTop) out.fails.push(`${f.who}: stands ${(f.at[1] - floorAround).toFixed(2)} m over the floor around it (on a counter, bench or table) at ${row.at.join(", ")}`);
    if (inProp) out.fails.push(`${f.who}: footprint overlaps ${inProp} prop cell(s) at ${row.at.join(", ")}`);
    if (ratio != null && (ratio < band[0] || ratio > band[1])) out.fails.push(`${f.who}: figure mid-tone ${row.figureLum} against plate ${row.plateLum} (ratio ${row.ratio}, band ${band.join(" to ")})`);
  }
  // bodies inside bodies: two figures' feet nearer than 0.5 m
  for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) { const d = Math.hypot(figs[i].at[0] - figs[j].at[0], figs[i].at[2] - figs[j].at[2]); if (d < 0.5) out.fails.push(`${figs[i].who} and ${figs[j].who}: ${d.toFixed(2)} m apart (bodies overlap)`); }
  const ma = med(shadows.map((x) => x.a));
  out.shadow = { pixels: shadows.length, offFloor: shadows.filter((x) => x.off).length, stacked: ma == null ? 0 : shadows.filter((x) => x.a > ma * 1.3 + 0.05).length, medianAlpha: ma && +ma.toFixed(3) };
  for (const q of shadows) { if (q.off) marks.off.push([q.sx, q.sy]); else if (ma != null && q.a > ma * 1.3 + 0.05) marks.stack.push([q.sx, q.sy]); else marks.shadow.push([q.sx, q.sy]); }
  if (shadows.length && out.shadow.offFloor / shadows.length > offFloorMax) out.fails.push(`shadow: ${out.shadow.offFloor} of ${shadows.length} shadow pixels land off the floor (more than ${offFloorMax * 100}%)`);
  if (out.shadow.stacked > stackMax) out.fails.push(`shadow: ${out.shadow.stacked} pixels where shadows stack darker (more than ${stackMax})`);
  return out;
}
