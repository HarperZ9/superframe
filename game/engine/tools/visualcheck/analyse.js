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
  const figs = (play.people.figures ? play.people.figures() : []).map((f) => ({ who: f.who, at: f.at, pose: f.pose || null, mark: f.mark || null }));
  // a seat the plate shows near a seated figure's mark (samples 0.3 to 0.6 m up within 0.5 m): the check's own reading
  // the seat's extent: samples 0.3 to 0.6 m up within 0.7 m of the mark, not under a part 0.6 to 1.3 m up (the back); a figure on its seat stands inside that extent
  const seatNear = (m) => { const back = new Set(), L = []; const col = (x, z) => `${Math.round(x / 0.05)},${Math.round(z / 0.05)}`; for (let i = 0; i < geo.pos.length; i += 3) { const x = geo.pos[i], y = geo.pos[i + 1] - m[1], z = geo.pos[i + 2]; if ((x - m[0]) ** 2 + (z - m[2]) ** 2 > 0.49) continue; if (y > 0.6 && y < 1.3) back.add(col(x, z)); else if (y > 0.3 && y < 0.6) L.push([x, z]); } const F = L.filter((p) => !back.has(col(p[0], p[1]))); if (F.length < 100) return null; const xs = F.map((p) => p[0]), zs = F.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]; };
  const C = G.ext && G.ext.combat, W = C && C.current && C.current.W;
  if (W && document.querySelector("canvas.fightcanvas")) for (const F of W.fighters) { if (F.out) continue; const q = Math.floor((F.x - ox) / cs), r = Math.floor((F.z - oz) / cs), cell = q >= 0 && r >= 0 && q < w && r < h ? cells[r * w + q] : null; figs.push({ who: F.id, at: [F.x, cell ? cell.h : 0, F.z], fighter: true }); }
  const layers = [play.people.canvas || document.querySelector("canvas.peoplecanvas"), document.querySelector("canvas.fightcanvas")].filter(Boolean).map((cv) => ({ cv, d: cv.width && cv.height ? cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data : null, w: cv.width })).filter((L) => L.d);
  const plateCv = document.querySelector(".platecam canvas"), pd = plateCv.getContext("2d").getImageData(0, 0, plateCv.width, plateCv.height).data, pw = plateCv.width;
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const px = (sx, sy) => { for (const L of layers) { const i = (Math.round(sy) * L.w + Math.round(sx)) * 4; if (sx < 0 || sy < 0 || sx >= L.w || i + 3 >= L.d.length) continue; const a = L.d[i + 3] / 255; if (a > 0.01) return { a, l: lum(L.d[i], L.d[i + 1], L.d[i + 2]) }; } return null; };
  const plateLum = (sx, sy) => { const x = Math.floor(fr.left + sx / fr.zoom), y = Math.floor(fr.top + sy / fr.zoom), i = (y * pw + x) * 4; return x < 0 || y < 0 || x >= pw || i + 3 >= pd.length ? null : lum(pd[i], pd[i + 1], pd[i + 2]); };
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const out = { figures: [], shadow: { pixels: 0, offFloor: 0, stacked: 0, medianAlpha: null }, fails: [] }, shadows = [], seenPx = new Set(), feet = [];
  for (const f of figs) {
    const sp = cam.toScreen(f.at), ppm = cam.scaleAt(f.at); if (!sp || !ppm) continue;
    feet.push({ x: sp[0], y: sp[1], ppm });
    const [x, y] = sp, q0 = Math.floor((f.at[0] - ox) / cs), r0 = Math.floor((f.at[2] - oz) / cs), R = Math.ceil(bodyR / cs);
    let inProp = 0; for (let dr = -R; dr <= R; dr++) for (let dq = -R; dq <= R; dq++) { const ex = Math.max(0, Math.abs(dq) - 0.5) * cs, ez = Math.max(0, Math.abs(dr) - 0.5) * cs; if (Math.hypot(ex, ez) < bodyR && prop(q0 + dq, r0 + dr)) inProp++; }
    // standing on a top: the figure's feet more than 0.3 m over the floor around it (median of the ground within 1.5 m)
    const around = []; for (let dr = -6; dr <= 6; dr++) for (let dq = -6; dq <= 6; dq++) { const q = q0 + dq, r = r0 + dr; if (q < 0 || r < 0 || q >= w || r >= h || prop(q, r)) continue; const cc = cells[r * w + q]; if (cc && Math.hypot(dq, dr) * cs <= 1.5) around.push(cc.h); }
    const floorAround = med(around), onTop = floorAround != null && f.at[1] - floorAround > 0.3;
    const body = [], ring = [];
    // figure pixels drawn where the painting stands more than 0.5 m nearer than the figure (a counter or wall in front): occlusion failures
    // each body pixel's own depth: h metres up the figure is h x sin(elevation) nearer than the feet under the bake camera (character lead's correction)
    const fd = cam.depthOf ? cam.depthOf(f.at) : null, sinE = Math.sin(((place.camera.elevDeg || 30) * Math.PI) / 180); let drawnOver = 0;
    for (let sy = y - 2.0 * ppm; sy < y - 0.15 * ppm; sy += Math.max(1, ppm / 40)) for (let sx = x - 0.45 * ppm; sx < x + 0.45 * ppm; sx += Math.max(1, ppm / 40)) { const p = px(sx, sy); if (p && p.a > 0.9) { body.push(p.l); if (fd != null && cam.depthAt && cam.depthAt(sx, sy) < fd - ((y - sy) / ppm) * sinE - 0.5) drawnOver++; } }
    for (let sy = y - 2.3 * ppm; sy < y + 0.4 * ppm; sy += Math.max(1, ppm / 20)) for (let sx = x - 1.6 * ppm; sx < x + 1.6 * ppm; sx += Math.max(1, ppm / 20)) { if (Math.abs(sx - x) < 0.6 * ppm && sy > y - 2.1 * ppm) continue; const l = plateLum(sx, sy); if (l != null) ring.push(l); }
    // a figure's own one-pixel feather is not a shadow: skip pixels within 2 px of an opaque figure pixel (character lead's correction)
    const nearBody = (sx, sy) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const q = px(sx + dx, sy + dy); if (q && q.a > 0.9) return true; } return false; };
    for (let sy = y - 0.35 * ppm; sy < y + 0.35 * ppm; sy++) for (let sx = x - 0.8 * ppm; sx < x + 0.8 * ppm; sx++) { const p = px(sx, sy); if (p && p.a >= 0.12 && p.a <= 0.88 && p.l < 0.12 && !nearBody(sx, sy)) { const k = (Math.round(sy) << 16) | Math.round(sx); if (seenPx.has(k)) continue; seenPx.add(k); const gy = geoY(sx, sy); shadows.push({ sx, sy, a: p.a, off: gy == null ? false : Math.abs(gy - f.at[1]) > 0.2 }); } } // each pixel once
    const fb = med(body), pl = med(ring), ratio = fb != null && pl != null ? fb / Math.max(0.02, pl) : null;
    const overShare = body.length ? drawnOver / body.length : 0;
    const row = { who: f.who, pose: f.pose || null, fighter: !!f.fighter, at: f.at.map((v) => +v.toFixed(2)), inProp, onTop, drawnOver: +overShare.toFixed(3), figureLum: fb && +fb.toFixed(3), plateLum: pl && +pl.toFixed(3), ratio: ratio && +ratio.toFixed(2) };
    out.figures.push(row);
    if (overShare > 0.05) out.fails.push(`${f.who}: ${(overShare * 100).toFixed(0)}% of the figure is drawn over painting that stands in front of it (occlusion)`);
    // in a prop: only a seated figure on its own seat is allowed
    const seat = f.pose === "seated" ? seatNear(f.mark || f.at) : null, onSeat = !!seat && Math.hypot(f.at[0] - seat[0], f.at[2] - seat[1]) <= 0.15; // within 15 cm of the seat's middle
    row.onSeat = onSeat;
    if (f.pose === "seated" && !onSeat) out.fails.push(`${f.who}: seated, but not on a seat (nearest seat ${seat ? `${Math.hypot(f.at[0] - seat[0], f.at[2] - seat[1]).toFixed(2)} m away` : "none within 0.5 m"}): sitting on air`);
    if (onTop && !onSeat) out.fails.push(`${f.who}: stands ${(f.at[1] - floorAround).toFixed(2)} m over the floor around it (on a counter, bench or table) at ${row.at.join(", ")}`);
    if (inProp && !onSeat) out.fails.push(`${f.who}: footprint overlaps ${inProp} prop cell(s) at ${row.at.join(", ")}`);
    if (ratio != null && (ratio < band[0] || ratio > band[1])) out.fails.push(`${f.who}: figure mid-tone ${row.figureLum} against plate ${row.plateLum} (ratio ${row.ratio}, band ${band.join(" to ")})`);
  }
  // bodies inside bodies: two figures' feet nearer than 0.5 m
  // a seated figure's knees and feet reach 0.8 m along its facing: measured to that segment
  const faceOf = (f) => { const pf = (play.people.figures ? play.people.figures() : []).find((x) => x.who === f.who); return pf ? pf.face || 0 : 0; };
  const bd = (a, b) => { const s = a.pose === "seated" ? a : b.pose === "seated" ? b : null, o = s === a ? b : a; if (!s) return Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]); const fc = faceOf(s), dx = Math.cos(fc) * 0.8, dz = Math.sin(fc) * 0.8, t = Math.max(0, Math.min(1, ((o.at[0] - s.at[0]) * dx + (o.at[2] - s.at[2]) * dz) / 0.64)); return Math.hypot(o.at[0] - (s.at[0] + dx * t), o.at[2] - (s.at[2] + dz * t)); };
  for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) { const d = bd(figs[i], figs[j]); if (d < 0.5) out.fails.push(`${figs[i].who} and ${figs[j].who}: ${d.toFixed(2)} m apart (bodies overlap${figs[i].pose === "seated" || figs[j].pose === "seated" ? ", a seated figure's knees included" : ""})`); }
  // silhouettes at about the same depth must not interpenetrate (held props are part of a figure): each
  // figure drawn alone through the game's own person drawer (ui/figures.mjs), with the arguments the
  // people layer gives it; a pair whose opaque pixels overlap at the same depth (within 0.25 m, each pixel's depth from
  // its height up its figure) by more than 40 px or 2% of the smaller silhouette fails
  {
    const { personDrawer } = await import("/engine/ui/figures.mjs");
    const lc = play.people.canvas || document.querySelector("canvas.peoplecanvas"), Wc = lc.width, Hc = lc.height;
    const pf = play.people.figures ? play.people.figures() : [];
    const variant = (cam.area && cam.area() && cam.area().variant) || (place.variants && place.variants[0]), lights = (place.lights && place.lights[variant]) || [];
    const solo = new Map();
    const alphaOf = (f) => {
      if (solo.has(f.who)) return solo.get(f.who);
      const cv = document.createElement("canvas"); cv.width = Wc; cv.height = Hc;
      const sp = cam.toScreen(f.at), full = pf.find((x) => x.who === f.who) || f;
      const r = sp ? personDrawer()(cv.getContext("2d"), full, { x: sp[0], y: sp[1], ppm: cam.scaleAt(f.at), at: f.at, face: full.face || 0, walking: false, running: false, talking: false, gesture: null, cam: place.camera, plate: place.place, depth: cam.depthOf(f.at), depthAt: cam.depthAt, lights, darkness: cam.darkness ? cam.darkness() : 0, pose: full.pose || null, reach: null, solo: true }) : null;
      const d = cv.getContext("2d").getImageData(0, 0, Wc, Hc).data, a = new Uint8Array(Wc * Hc); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 128 ? 1 : 0;
      // the drawer's own depth per drawn pixel when it gives one ({ depth, w, h, ox, oy }, NaN where nothing shows)
      a.depth = r && r.depth ? (k) => { const x = (k % Wc) - r.ox, y = ((k / Wc) | 0) - r.oy; return x >= 0 && y >= 0 && x < r.w && y < r.h ? r.depth[y * r.w + x] : NaN; } : null;
      solo.set(f.who, a); return a;
    };
    const persons = figs.filter((f) => !f.fighter);
    for (let i = 0; i < persons.length; i++) for (let j = i + 1; j < persons.length; j++) {
      const A2 = persons[i], B2 = persons[j], dz = Math.abs(cam.depthOf(A2.at) - cam.depthOf(B2.at)); if (dz > 1.2) continue; // more than a reach apart: no contact possible
      // where both are drawn, each pixel's depth is its figure's feet depth less its height up the figure x sin(elevation);
      // two pixels within 0.25 m of depth are one body passing through the other (a figure in front is clearly nearer)
      const sinE2 = Math.sin(((place.camera.elevDeg || 30) * Math.PI) / 180), sa = cam.toScreen(A2.at), sb = cam.toScreen(B2.at), pa = cam.scaleAt(A2.at), pb = cam.scaleAt(B2.at), da = cam.depthOf(A2.at), db = cam.depthOf(B2.at);
      const a = alphaOf(A2), b = alphaOf(B2); let both = 0, na = 0, nb = 0, aBehind = 0, bBehind = 0;
      for (let k = 0; k < a.length; k++) { na += a[k]; nb += b[k]; if (a[k] && b[k]) { if (a.depth && b.depth) { const za = a.depth(k), zb = b.depth(k); if (Number.isFinite(za) && Number.isFinite(zb)) { const dd = za - zb; if (Math.abs(dd) < 0.04) both++; else if (dd > 0) aBehind++; else bBehind++; } } else { const sy = (k / Wc) | 0, za = da - ((sa[1] - sy) / pa) * sinE2, zb = db - ((sb[1] - sy) / pb) * sinE2; if (Math.abs(za - zb) < 0.25) both++; } } } // true depths within 0.15 m when the drawer gives them, else the estimate
      // bodies pass through each other where their surfaces meet (within 4 cm) or cross (each in front of the other
      // over 20 px or more); two bodies with a clear gap along the view ray only stand close
      if (a.depth && b.depth && Math.min(aBehind, bBehind) >= 20) both += Math.min(aBehind, bBehind);
      (out.interpenetration ||= []).push({ a: A2.who, b: B2.who, depthApart: +dz.toFixed(2), overlap: both, aBehind, bBehind });
      if (both > Math.max(40, 0.02 * Math.min(na, nb))) out.fails.push(`${A2.who} and ${B2.who}: silhouettes pass through each other (${both} px at ${dz.toFixed(2)} m apart in depth)`);
    }
    // a pixel that any figure's own solo drawing covers (a coat's feather, a lantern's glass) is not a shadow
    const covered = (q) => persons.some((f) => { const a = alphaOf(f), k = Math.round(q.sy) * Wc + Math.round(q.sx); return a.depth ? Number.isFinite(a.depth(k)) : !!a[k]; });
    const before = shadows.length; for (let i = shadows.length - 1; i >= 0; i--) if (covered(shadows[i])) shadows.splice(i, 1);
    out.shadowCoveredByBodies = before - shadows.length;
  }
  const ma = med(shadows.map((x) => x.a));
  // stacked: darker than one shadow (edges and repeats already left out); how many of those lie inside two
  // figures' contact ellipses is reported beside it (underTwo), as a reading aid only: it does not change the count
  const under = (q) => feet.filter((F) => ((q.sx - F.x) / (0.55 * F.ppm)) ** 2 + ((q.sy - F.y) / (0.3 * F.ppm)) ** 2 <= 1).length;
  // one shadow's own darkness, measured: the 98th percentile alpha of shadow pixels under exactly one
  // figure's contact ellipse (a shadow's core is darker than its rim, so the view's median is not it).
  // Stacked: darker than that by 0.08 or more. With too few lone pixels to measure, the median rule.
  const lone = shadows.filter((q) => under(q) === 1).map((q) => q.a).sort((p, q) => p - q);
  const single = lone.length >= 30 ? lone[Math.floor(lone.length * 0.98)] : null;
  const dark = ma == null ? [] : shadows.filter((x) => (single != null ? x.a > single + 0.08 : x.a > ma * 1.3 + 0.05));
  out.shadow = { pixels: shadows.length, offFloor: shadows.filter((x) => x.off).length, single: single && +single.toFixed(2), stacked: dark.length, underTwo: dark.filter((q) => under(q) >= 2).length, darkAt: dark.slice(0, 600).map((q) => [Math.round(q.sx), Math.round(q.sy), +q.a.toFixed(2)]), alphaMax: shadows.length ? +Math.max(...shadows.map((x) => x.a)).toFixed(2) : null, offAt: shadows.filter((x) => x.off).slice(0, 600).map((q) => [Math.round(q.sx), Math.round(q.sy)]), medianAlpha: ma && +ma.toFixed(3) };
  if (shadows.length && out.shadow.offFloor / shadows.length > offFloorMax) out.fails.push(`shadow: ${out.shadow.offFloor} of ${shadows.length} shadow pixels land off the floor (more than ${offFloorMax * 100}%)`);
  if (out.shadow.stacked > stackMax) out.fails.push(`shadow: ${out.shadow.stacked} pixels where shadows stack darker (more than ${stackMax})`);
  out.state = { talking: !!play.P.talk, node: play.P.talk ? play.P.talk.node : null, walking: play.people.walking ? play.people.walking() : null, clock: G.clock(), pos: G.state.pos };
  return out;
}
