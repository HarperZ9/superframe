// Runs inside play.html (tools/visual-check.mjs injects it). Self-contained on purpose: it judges the
// build it runs in with its own rules, and reads only the plate's data, the screen and what each
// figure stands on, so a build cannot pass by changing what the check imports.
// Returns { figures: [...], shadow: {...}, fails: [...] } for the view on screen.
async (opts) => {
  const SCREEN_MAX = (opts && opts.screenMax) || 0.04;   // painted mode: pixel-scale energy of a dither screen (the unpainted fallback)
  const BLOTCH_MAX = (opts && opts.blotchMax) || 0.02;   // painted mode: the share of surface interiors compact blotches may cover
  const WAY_MIN = 0.6;   // glyph mode: the share of a way out's outline cells that must show its mark
  const LEGIBLE_MIN = (opts && opts.legibleMin) || 0.75;   // glyph mode: the share of the plate's structural blocks that must read
  const { bodyR = 0.25, propStep = 0.4, head = 2.0, minProp = 3, band = [0.25, 1.6], offFloorMax = 0.03, stackMax = 40 } = opts || {};
  // judge a settled frame: the figures on the layer are drawn with the camera of the frame they were drawn
  // in, so a camera still easing by a pixel puts the check's reading of the plate a pixel off the drawing
  // (shadow rims then read as on a stool's top: brine-bar, 2026-10-21). Wait until the camera holds for two frames.
  if (window.__lw.play.renderers && window.__lw.play.renderers.mode && window.__lw.play.renderers.mode() === "glyph") globalThis.__lwGlyphMasks = true;   // the glyph frame marks the cells figures and panels set
  { const cm = window.__lw.play.cam, key = () => { const f = cm.frameNow(); return f ? `${f.left},${f.top},${f.zoom}` : ""; }, raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0, k = key(); i < 60; i++) { await raf(); const k2 = key(); if (k2 === k) break; k = k2; } }
  const c = window.__lw, G = c.G, play = c.play, cam = play.cam, place = cam.place(), geo = cam.geo(), fr0 = cam.frameNow();
  // read the plate through the camera the figures on screen were drawn with (the people layer records it),
  // so a follow camera still easing between the drawing and this reading cannot shift the shadows off the floor
  const pv = play.people && play.people.canvas && play.people.canvas.dataset.view, fr = pv ? (([l, t, z]) => ({ ...fr0, left: l, top: t, zoom: z }))(pv.split(",").map(Number)) : fr0;
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
    // a hanging thing (lamp, beam) more than 1.95 m above the figure's floor over open floor is let through by design (platecam depthAt with floorY): not counted
    // each body pixel's own depth: h metres up the figure is h x sin(elevation) nearer than the feet under the bake camera (character lead's correction)
    const fd = cam.depthOf ? cam.depthOf(f.at) : null, sinE = Math.sin(((place.camera.elevDeg || 30) * Math.PI) / 180); let drawnOver = 0;
    for (let sy = y - 2.0 * ppm; sy < y - 0.15 * ppm; sy += Math.max(1, ppm / 40)) for (let sx = x - 0.45 * ppm; sx < x + 0.45 * ppm; sx += Math.max(1, ppm / 40)) { const p = px(sx, sy); if (p && p.a > 0.9) { body.push(p.l); if (fd != null && cam.depthAt && cam.depthAt(sx, sy, f.at[1]) < fd - ((y - sy) / ppm) * sinE - 0.5) drawnOver++; } }
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
      const a = alphaOf(A2), b = alphaOf(B2); let both = 0, na = 0, nb = 0, aBehind = 0, bBehind = 0, edgeHits = 0;
      const edgeOf = (m, k) => { const x = k % Wc, y = (k / Wc) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= Wc || yy >= Hc || !m[yy * Wc + xx]) return true; } return false; };
      for (let k = 0; k < a.length; k++) { na += a[k]; nb += b[k]; if (a[k] && b[k]) { if (a.depth && b.depth) { const za = a.depth(k), zb = b.depth(k); if (Number.isFinite(za) && Number.isFinite(zb)) { const dd = za - zb, edge = edgeOf(a, k) || edgeOf(b, k); if (edge) edgeHits++; else if (Math.abs(dd) < 0.04) both++; else if (dd > 0) aBehind++; else bBehind++; /* a pixel within 2 px of either silhouette's edge has a grazing depth sample: counted apart */ } } else { const sy = (k / Wc) | 0, za = da - ((sa[1] - sy) / pa) * sinE2, zb = db - ((sb[1] - sy) / pb) * sinE2; if (Math.abs(za - zb) < 0.25) both++; } } } // true depths within 0.15 m when the drawer gives them, else the estimate
      // bodies pass through each other where their surfaces meet (within 4 cm) or cross (each in front of the other
      // over 20 px or more); two bodies with a clear gap along the view ray only stand close
      if (a.depth && b.depth && Math.min(aBehind, bBehind) >= 20) both += Math.min(aBehind, bBehind);
      (out.interpenetration ||= []).push({ a: A2.who, b: B2.who, depthApart: +dz.toFixed(2), overlap: both, aBehind, bBehind, edgePixels: edgeHits });
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
  // UI: notes (the #toasts stack: toasts and found cards) never cover an open panel or each other
  // (coordinator's review, 2026-10-21: FOUND cards over PACK tags, both over the place menu)
  {
    const vis = (el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05 && !el.inert && !el.hidden; };
    const R = (el, sel) => { const r = el.getBoundingClientRect(); return { sel, x: r.left, y: r.top, w: r.width, h: r.height }; };
    const panels = [];
    for (const sel of ["aside.talk", ".screen.play .here", ".fightlayer .dock", ".talkoffer", ".hud", ".topbar"]) for (const el of document.querySelectorAll(sel)) if (vis(el)) { const r = R(el, sel); if (r.w > 4 && r.h > 4) panels.push(r); }
    const notes = [...document.querySelectorAll("#toasts > *")].filter(vis).map((el) => R(el, el.className));
    const hit = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
    out.ui = { notes: notes.length, panels: panels.map((p) => p.sel) };
    for (const n of notes) for (const p of panels) if (hit(n, p)) out.fails.push(`ui: a note (${n.sel}) covers ${p.sel}`);
    for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) if (hit(notes[i], notes[j])) out.fails.push(`ui: two notes overlap (${notes[i].sel}, ${notes[j].sel})`);
  }
  if (play.renderers && play.renderers.mode && play.renderers.mode() === "glyph") out.fails = out.fails.filter((f) => /^ui/.test(f));   // figures are judged in painted mode
  // UI in glyph mode: the panels as the glyph renderer placed them in the grid never overlap one another
  { const R = play.renderers, gs = R && R.mode && R.mode() === "glyph" ? R.glyph.state.ui : null;
    if (gs) { out.uiGlyph = gs; const P = gs.placed || [], hit = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (hit(P[i], P[j])) out.fails.push(`ui (glyph): ${P[i].cls} and ${P[j].cls} overlap`); } }
  // Painted mode: camouflage on the plate (the Spit's frost, 2026-10-21: rime laid where a noise crossed a
  // threshold made 10 to 30 cm blotches over ground, hull and planks). The check's own reading of the plate as
  // drawn (the plate canvas) inside the view, at a third of its size: inside one surface kind (a 7 by 7 patch of
  // one geo id), the compact islands (4 to 300 samples, aspect under 2.5, filling over 45 percent of their box)
  // that stand 30 percent and 6 levels above or below the local mean; brush strokes are long and thin and do not
  // count. Fails when those islands cover more than BLOTCH_MAX of the surfaces' interiors.
  { const R0 = play.renderers, glyphOn = R0 && R0.mode && R0.mode() === "glyph", pc = document.querySelector("canvas.platecam-img");
    if (!glyphOn && pc && pc.width) {
      const k = 3, vw = innerWidth / fr0.zoom, vh = innerHeight / fr0.zoom, x0 = Math.max(0, Math.floor(fr0.left)), y0 = Math.max(0, Math.floor(fr0.top));
      const x1 = Math.min(pc.width, Math.ceil(fr0.left + vw)), y1 = Math.min(pc.height, Math.ceil(fr0.top + vh)), w = Math.floor((x1 - x0) / k), hgt = Math.floor((y1 - y0) / k);
      const px = pc.getContext("2d", { willReadFrequently: true }).getImageData(x0, y0, x1 - x0, y1 - y0).data, rw = x1 - x0;
      const idFull = geo.ids.length === place.width * place.height, gs3 = place.geoScale || 1, gw3 = Math.round(place.width * gs3);
      const L = new Float32Array(w * hgt), ID = new Int16Array(w * hgt);
      for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
        const sx = x * k, sy = y * k, q = (sy * rw + sx) * 4; L[y * w + x] = 0.2126 * px[q] + 0.7152 * px[q + 1] + 0.0722 * px[q + 2];
        const gx = x0 + sx, gy = y0 + sy; ID[y * w + x] = idFull ? geo.ids[gy * place.width + gx] : geo.ids[Math.floor(gy * gs3) * gw3 + Math.floor(gx * gs3)];
      }
      // a box filter (radius r) along rows then columns; min and max of ids over 7 x 7
      const boxf = (A, r) => { const T = new Float32Array(A.length), O = new Float32Array(A.length);
        for (let y = 0; y < hgt; y++) { let s = 0, n = 0; for (let x = -r; x < w + r; x++) { if (x + r < w && x + r >= 0) { s += A[y * w + x + r]; n++; } if (x - r - 1 >= 0) { s -= A[y * w + x - r - 1]; n--; } if (x >= 0 && x < w) T[y * w + x] = s / n; } }
        for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let y = -r; y < hgt + r; y++) { if (y + r < hgt && y + r >= 0) { s += T[(y + r) * w + x]; n++; } if (y - r - 1 >= 0) { s -= T[(y - r - 1) * w + x]; n--; } if (y >= 0 && y < hgt) O[y * w + x] = s / n; } }
        return O; };
      const loc = boxf(L, 7), inner = new Uint8Array(w * hgt); let innerN = 0;
      for (let y = 3; y < hgt - 3; y++) for (let x = 3; x < w - 3; x++) { const i = y * w + x, id = ID[i]; if (L[i] <= 8) continue; let ok = true; for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) if (ID[i + dy * w + dx] !== id) { ok = false; break; } if (ok) { inner[i] = 1; innerN++; } }
      let blot = 0; const lab = new Int32Array(w * hgt), stack = [];
      for (const sgn of [1, -1]) {
        lab.fill(0); let nl = 0;
        const on = (i) => inner[i] && (L[i] - loc[i]) * sgn > 0.3 * loc[i] + 6;
        for (let i = 0; i < w * hgt; i++) { if (lab[i] || !on(i)) continue; nl++; let a = 0, mnx = 1e9, mny = 1e9, mxx = -1, mxy = -1; stack.length = 0; stack.push(i); lab[i] = nl;
          while (stack.length) { const j = stack.pop(), jx = j % w, jy = (j / w) | 0; a++; if (jx < mnx) mnx = jx; if (jx > mxx) mxx = jx; if (jy < mny) mny = jy; if (jy > mxy) mxy = jy;
            for (const q of [j - 1, j + 1, j - w, j + w]) if (q >= 0 && q < w * hgt && !lab[q] && Math.abs((q % w) - jx) <= 1 && on(q)) { lab[q] = nl; stack.push(q); } }
          const bw = mxx - mnx + 1, bh = mxy - mny + 1; if (a >= 4 && a <= 300 && Math.max(bw, bh) / Math.min(bw, bh) < 2.5 && a / (bw * bh) > 0.45) blot += a; }
      }
      const score = innerN ? blot / innerN : 0; out.blotch = { score: +score.toFixed(4), inner: innerN };
      // the unpainted fallback (the Gut's palette plate in Act 3, 2026-10-21: flat blocks under a dither screen): a
      // painted plate has almost no pixel-scale energy left once a 3 x 3 median is taken; a dither screen keeps a
      // lot. Mean |L - median3(L)| / (L + 8) over surface interiors, every third row at full size; painted plates
      // 0.001 to 0.019, the palette Gut 0.08 to 0.11. Also fails when the plate canvas is empty in view.
      { let hf = 0, hn = 0, lit = 0, tot = 0; const LF = (x, y) => { const q = (y * rw + x) * 4; return 0.2126 * px[q] + 0.7152 * px[q + 1] + 0.0722 * px[q + 2]; }, nb = new Float32Array(9);
        for (let y = 1; y < (y1 - y0) - 1; y += 3) for (let x = 1; x < rw - 1; x++) {
          const l = LF(x, y); tot++; if (l > 2) lit++;
          const sx = Math.floor(x / k), sy = Math.floor(y / k); if (sx >= w || sy >= hgt || !inner[sy * w + sx] || l <= 6) continue;
          let t = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nb[t++] = LF(x + dx, y + dy); nb.sort(); hf += Math.abs(l - nb[4]) / (l + 8); hn++; }
        const screen = hn ? hf / hn : 0; out.unpainted = { screen: +screen.toFixed(4), lit: tot ? +(lit / tot).toFixed(3) : 0 };
        if (hn > 2000 && screen > SCREEN_MAX) out.fails.push(`unpainted: a dither screen over the plate (pixel-scale energy ${screen.toFixed(3)}, painted plates stay under ${SCREEN_MAX}): the unpainted fallback, not a painted plate`);
        if (tot > 1000 && lit / tot < 0.05) out.fails.push(`unpainted: the plate canvas is empty in view (${(100 * lit / tot).toFixed(1)} percent lit): the plate did not load`); }
      if (innerN > 2000 && score > BLOTCH_MAX) out.fails.push(`camouflage: compact blotches cover ${(score * 100).toFixed(2)} percent of the plate's surfaces in view, over ${(BLOTCH_MAX * 100).toFixed(2)}`);
    } }
  // Glyph mode at night: does the plate's structure still read on screen? The check's own reading of what
  // the glyph raster drew (the frame's cells: glyph, type colour, ground colour, and the atlas's ink per
  // glyph) against the plate's own geo buffers (surface kind and depth at each cell's centre), not the
  // renderer's measure. A cell is structural where the plate changes kind or depth (0.6 m or more) against a
  // neighbour, or meets the void; it reads where the neighbour across differs by 6 display levels in cell
  // value, or one shows type (ink 16 levels over its ground) and the other none, or both show different
  // glyphs (texture). Figures and panels are left out.
  { const R = play.renderers, gl = R && R.mode && R.mode() === "glyph" ? R.glyph : null, S = gl && gl.state, ob = S && S.buf, g = S && S.grid, C = S && S.C;
    if (ob && g && C) {
      const { I0, J0, cols, rows } = g, n = cols * rows, mask = S.figMask, cov = gl.atlas.cov;
      const cam0 = place.camera, yaw = (cam0.yawDeg * Math.PI) / 180, el = (cam0.elevDeg * Math.PI) / 180, fw = [-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)];
      const gs2 = place.geoScale || 1, gw2 = Math.round(place.width * gs2), gh2 = Math.round(place.height * gs2), idFull = geo.ids.length === place.width * place.height;
      const lum = (a, i) => 0.2126 * a[i * 3] + 0.7152 * a[i * 3 + 1] + 0.0722 * a[i * 3 + 2];
      const K = new Int32Array(n).fill(-2), D = new Float32Array(n), Yc = new Float32Array(n), sh = new Uint8Array(n);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = y * cols + x; if (mask && mask[v]) continue;
        const u = (I0 + x + 0.5) * C.pw, w = (J0 + y + 0.5) * C.ph, gx = Math.floor(u * gs2), gy = Math.floor(w * gs2); if (gx < 0 || gy < 0 || gx >= gw2 || gy >= gh2) continue;
        const k = gy * gw2 + gx, X = geo.pos[k * 3], Yw = geo.pos[k * 3 + 1], Z = geo.pos[k * 3 + 2];
        const fg = lum(ob.FG, v), bg = lum(ob.BG, v), cv = cov[ob.G[v]] || 0; Yc[v] = bg + Math.min(1, cv * 2.5) * Math.max(0, fg - bg); sh[v] = cv > 0.01 && fg - bg >= 16 ? 1 : 0;
        if (!Number.isFinite(Yw) || (X === 0 && Yw === 0 && Z === 0)) { K[v] = -1; continue; }
        K[v] = idFull ? geo.ids[Math.min(place.height - 1, Math.floor(gy / gs2)) * place.width + Math.min(place.width - 1, Math.floor(gx / gs2))] : geo.ids[k]; D[v] = X * fw[0] + Yw * fw[1] + Z * fw[2];
      }
      let st = 0, ok = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = y * cols + x; if (K[v] < 0) continue; let isS = false, rd = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Yb = y + dy; if (X < 0 || Yb < 0 || X >= cols || Yb >= rows) continue; const q = Yb * cols + X; if (K[q] === -2) continue;
          if (!(K[q] < 0 || K[q] !== K[v] || Math.abs(D[q] - D[v]) >= 0.6)) continue; isS = true;
          if (Math.abs(Yc[v] - Yc[q]) >= 6 || sh[v] !== sh[q] || (sh[v] && sh[q] && ob.G[v] !== ob.G[q])) rd = true;
        }
        if (isS) { st++; if (rd) ok++; }
      }
      const legible = st ? ok / st : 1; out.glyphLegible = { structure: +legible.toFixed(3), structural: st };
      if (st >= 200 && legible < LEGIBLE_MIN) out.fails.push(`legibility (glyph): the plate's structure reads in ${(legible * 100).toFixed(0)} percent of its structural cells, under ${LEGIBLE_MIN * 100}`);
    } }
  // Glyph mode in a fight: each way out must show in type. The check walks the exit's outline on the ground (the
  // arena's own exits, the plate's own ground height, the camera's projection), maps each point to its glyph
  // cell, and counts cells holding a line or arrow glyph in a light colour; under WAY_MIN of them fails.
  { const R = play.renderers, gl = R && R.mode && R.mode() === "glyph" ? R.glyph : null, S = gl && gl.state, ob = S && S.buf, gr = S && S.grid;
    const CW = G.ext && G.ext.combat, FW = CW && CW.current && CW.current.W, exits = FW && !FW.result && FW.field && FW.field.arena && FW.field.arena.exits;
    if (ob && gr && gr.cw && exits && exits.length && document.querySelector("canvas.fightcanvas")) {
      const { groundAt } = await import("/engine/world/plateworld.mjs"), FA = FW.field.arena;   // the ground the fight stands on, as the fight reads it
      const lineG = new Set(["-", "|", "/", "\\", "→", "←", "↑", "↓"].map((c) => gl.atlas.index(c))), hgt = (x, z) => { const q = Math.floor((x - ox) / cs), r = Math.floor((z - oz) / cs), c = q >= 0 && r >= 0 && q < w && r < h ? cells[r * w + q] : null; return c ? c.h : 0; };
      out.ways = [];
      for (const [x0, z0, x1, z1] of exits) {
        const pts = []; for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) for (let t = 0; t < 1; t += 0.1) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; pts.push([x, groundAt(FA, x, z) ?? hgt(x, z), z]); }
        const seen = new Set(); let on = 0;
        const panes = ((S.ui && S.ui.placed) || []).map((b) => [b.x0 * gr.cw, b.y0 * gr.ch, (b.x1 + 1) * gr.cw, (b.y1 + 1) * gr.ch]);   // under a panel, a mark is hidden in either mode
        for (const p of pts) { const sp = cam.toScreen(p); if (!sp || panes.some(([a, b, c, d]) => sp[0] >= a - 8 && sp[0] < c + 8 && sp[1] >= b - 12 && sp[1] < d + 12)) continue; const X = Math.floor((sp[0] - gr.ox) / gr.cw), Y = Math.floor((sp[1] - gr.oy) / gr.ch); if (X < 0 || Y < 0 || X >= gr.cols || Y >= gr.rows) continue;
          let hit = false; for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) { const XX = X + dx, YY = Y + dy; if (XX < 0 || YY < 0 || XX >= gr.cols || YY >= gr.rows) continue; const i = YY * gr.cols + XX; if (lineG.has(ob.G[i]) && 0.2126 * ob.FG[i * 3] + 0.7152 * ob.FG[i * 3 + 1] + 0.0722 * ob.FG[i * 3 + 2] >= 150) { hit = true; break; } }
          const key = `${X},${Y}`; if (seen.has(key)) continue; seen.add(key); if (hit) on++; }
        const share = seen.size ? on / seen.size : 1; out.ways.push({ exit: [x0, z0, x1, z1], cells: seen.size, shown: +share.toFixed(2) });
        if (seen.size >= 8 && share < WAY_MIN) out.fails.push(`ways (glyph): the way out at ${((x0 + x1) / 2).toFixed(1)}, ${((z0 + z1) / 2).toFixed(1)} shows in ${(share * 100).toFixed(0)} percent of its outline cells, under ${WAY_MIN * 100}`);
      }
    } }
  out.state = { talking: !!play.P.talk, node: play.P.talk ? play.P.talk.node : null, walking: play.people.walking ? play.people.walking() : null, clock: G.clock(), pos: G.state.pos };
  return out;
}
