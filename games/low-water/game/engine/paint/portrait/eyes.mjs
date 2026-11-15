// The eyes of a portrait, painted last and smallest, as a portrait painter finishes them: the opening read
// from the G-buffer (the eyeball's white and the iris materials), the white never white (a warm grey,
// shaded under the upper lid), an iris with a dark rim and light let in on the side away from the lamp, a
// pupil, the upper lid's lash line as the darkest accent of the face, a lit ledge on the lower lid, and
// one catch-light toward the key. The gaze moves the iris inside the opening. Original code.
//   findEyes(G) -> [{ px: [indices], cx, cy, wd, top(x), bot(x), iris: [x, y] }]   (screen space)
//   paintEyes(canvas, eyes, { w, h, study, irisColour, gaze, key })
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const WHITE = 28, IRIS = 15, PUPIL = 6, GLINT = 22, BROW = 26;

export function findEyes(G) {
  const { w, h } = G; let core = [];
  for (let i = 0; i < w * h; i++) if (G.id[i] === WHITE || G.id[i] === IRIS) core.push(i);
  // a covered eye (G.eyeId: the eye's own triangles rasterised alone, from sit.mjs): its place, reported with no
  // visible opening, so openEyes paints it open
  if (core.length < 6 && G.eyeId) { const hidden = []; for (let i = 0; i < w * h; i++) if (G.eyeId[i] === IRIS) hidden.push(i); if (hidden.length >= 6) return clusters({ ...G, id: G.eyeId }, hidden).map((e) => ({ ...e, wd: 1, ht: 1, covered: true })); }
  // no eye in the mesh at all (a head built with the eyes under a lid shelf): the eyes under the brows, a brow's
  // height plus a quarter of its width below each brow's middle
  if (core.length < 6) {
    const brow = []; for (let i = 0; i < w * h; i++) if (G.id[i] === BROW) brow.push(i);
    if (brow.length < 10) return [];
    let bc = clusters(G, brow);
    if (bc.length === 1) { const xs = brow.map((i) => i % w).sort((a, b) => a - b), mid = xs[Math.floor(xs.length / 2)]; bc = clusters(G, brow.filter((i) => i % w < mid)).concat(clusters(G, brow.filter((i) => i % w >= mid))); }   // one bar across both eyes: halved
    return bc.map((b) => { const c = [b.cx, b.y1 + b.ht * 0.6 + b.wd * 0.22]; return { ...b, cx: c[0], cy: c[1], iris: c, wd: 1, ht: 1, px: [], covered: true, fromBrow: true }; });
  }
  return clusters(G, core);
}
function clusters(G, core) {
  const { w, h } = G;
  // two eyes: split at the widest gap in x (one eye only when there is no clear gap: the far eye hidden)
  const xs = core.map((i) => i % w).sort((a, b) => a - b); let gap = 0, at = -1;
  for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > gap) { gap = xs[k] - xs[k - 1]; at = (xs[k] + xs[k - 1]) / 2; }
  const span = xs[xs.length - 1] - xs[0], groups = gap > Math.max(3, span * 0.12) ? [core.filter((i) => i % w < at), core.filter((i) => i % w >= at)] : [core];
  const eyes = [];
  for (const g of groups) {
    if (g.length < 5) continue;
    let x0 = w, x1 = 0, y0 = h, y1 = 0; for (const i of g) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    // the opening: these pixels plus the pupil and glint pixels inside the box (the pupil's id is shared with hats)
    const px = new Set(g); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (G.id[i] === PUPIL || G.id[i] === GLINT) px.add(i); }
    const top = new Map(), bot = new Map(); let sx = 0, sy = 0, ix = 0, iy = 0, ni = 0;
    for (const i of px) { const x = i % w, y = (i / w) | 0; sx += x; sy += y; top.set(x, Math.min(top.get(x) ?? y, y)); bot.set(x, Math.max(bot.get(x) ?? y, y)); if (G.id[i] !== WHITE) { ix += x; iy += y; ni++; } }
    eyes.push({ px: [...px], cx: sx / px.size, cy: sy / px.size, wd: x1 - x0 + 1, ht: y1 - y0 + 1, x0, x1, y0, y1, top, bot, iris: ni ? [ix / ni, iy / ni] : [sx / px.size, sy / px.size] });
  }
  return eyes.sort((a, b) => a.cx - b.cx);
}

// An eye the geometry hides (the old head's eyes sit under the brow, a few pixels of pupil showing): the
// portrait opens it, as a painter would, into an almond at the iris's place. Its width is a share of the
// distance between the two eyes (the far eye foreshortened), its height a share of its width, the upper
// lid's arc peaking toward the nose and the lower lid's toward the ear, tilted along the eye line. An eye
// whose opening is already big enough (the sculpted heads) is kept as modelled.
//   openEyes(eyes, { turn (-1 the face turns to screen left), lids (-1 wide .. 1 heavy), w, h }) -> eyes
export function openEyes(eyes, { turn = -1, lids = 0, w, h, minShare = 0.3 }) {
  if (!eyes.length) return eyes;
  const d = eyes.length === 2 ? Math.hypot(eyes[1].iris[0] - eyes[0].iris[0], eyes[1].iris[1] - eyes[0].iris[1]) : eyes[0].wd * 3;
  const tilt = eyes.length === 2 ? Math.atan2(eyes[1].iris[1] - eyes[0].iris[1], eyes[1].iris[0] - eyes[0].iris[0]) : 0, ct = Math.cos(tilt), st = Math.sin(tilt);
  return eyes.map((e, k) => {
    const far = eyes.length === 2 ? (turn < 0 ? k === 0 : k === 1) : false, We = d * 0.42 * (far ? 0.72 : 1), He = We * 0.4 * (1 - 0.3 * lids);
    if (e.wd >= 0.6 * We && e.ht >= minShare * We) return e;
    const [cx, cy] = e.iris, nose = eyes.length === 2 ? (k === 0 ? 1 : -1) : -turn;   // which side is the nose
    const px = [], top = new Map(), bot = new Map(); let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let y = Math.floor(cy - He); y <= cy + He; y++) for (let x = Math.floor(cx - We * 0.6); x <= cx + We * 0.6; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const u = ((x - cx) * ct + (y - cy) * st) / (We / 2), v = (-(x - cx) * st + (y - cy) * ct) / (He / 2);
      if (Math.abs(u) >= 1) continue;
      const s = u * nose, upPeak = 1 - Math.pow(Math.abs(s - 0.18) / 1.18, 2), loPeak = 1 - Math.pow(Math.abs(s + 0.2) / 1.2, 2);
      const tY = -1.05 * Math.max(0, upPeak), bY = 0.75 * Math.max(0, loPeak);
      if (v < tY || v > bY) continue;
      const i = y * w + x; px.push(i); top.set(x, Math.min(top.get(x) ?? y, y)); bot.set(x, Math.max(bot.get(x) ?? y, y));
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (px.length < 4) return e;
    return { ...e, px, top, bot, x0, x1, y0, y1, wd: x1 - x0 + 1, ht: y1 - y0 + 1, cx, cy: (y0 + y1) / 2, iris: [cx, cy + He * 0.08], opened: true };
  });
}

// irisColour: [r,g,b]; gaze: [dx, dy] in units of the eye's width (0,0 keeps the modelled gaze)
export function paintEyes(canvas, eyes, { w, h, study, irisColour = [0.3, 0.22, 0.15], gaze = [0, 0], key = [-0.6, -0.5], lash = [0.08, 0.05, 0.05] }) {
  const set = (i, c, a) => { if (a <= 0) return; for (let k = 0; k < 3; k++) canvas[i * 3 + k] = canvas[i * 3 + k] * (1 - a) + c[k] * a; };
  for (const e of eyes) {
    const inside = new Set(e.px), wd = Math.max(4, e.wd), ri = Math.max(1.6, wd * 0.24), rp = ri * 0.42;
    // the light on this eye: the study's mean value over the opening (the far eye in shadow paints darker)
    let L = 0; for (const i of e.px) L += 0.3 * study[i * 3] + 0.59 * study[i * 3 + 1] + 0.11 * study[i * 3 + 2]; L = clamp(L / e.px.length / 0.75, 0.25, 1);
    const ic = [e.iris[0] + gaze[0] * wd, e.iris[1] + gaze[1] * wd];
    // keep most of the iris inside the opening
    ic[0] = clamp(ic[0], e.x0 + ri * 0.6, e.x1 - ri * 0.6); ic[1] = clamp(ic[1], e.y0 + ri * 0.3, Math.max(e.y0 + ri * 0.3, e.y1 - ri * 0.2));
    const pad = Math.ceil(ri + 3);
    for (let y = Math.max(0, e.y0 - pad); y <= Math.min(h - 1, e.y1 + pad); y++) for (let x = Math.max(0, e.x0 - pad); x <= Math.min(w - 1, e.x1 + pad); x++) {
      const i = y * w + x; if (!inside.has(i)) continue;
      const t = e.top.get(x) ?? e.y0, b = e.bot.get(x) ?? e.y1, v = b > t ? (y - t) / (b - t) : 0.5, u = (x - e.x0) / Math.max(1, e.x1 - e.x0);
      // the white: warm grey, shaded under the lid and into the corners
      const shadeLid = 0.55 + 0.45 * clamp(v * 1.8), corner = 1 - 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 3);
      const white = [0.78, 0.74, 0.68].map((c) => c * L * shadeLid * corner);
      set(i, white, 0.92);
      // the iris and pupil
      const d = Math.hypot(x - ic[0], y - ic[1]);
      if (d < ri + 0.6) {
        const edge = clamp(ri + 0.6 - d), ring = clamp((d / ri - 0.72) / 0.28), away = clamp(((x - ic[0]) * -key[0] + (y - ic[1]) * -key[1]) / ri * 0.8 + 0.2);
        const lid = 0.55 + 0.45 * clamp(v * 2);
        let c = irisColour.map((q, k) => Math.min(0.3, q * (1 + 0.4 * away) * (1 - 0.6 * ring)) * L * lid);   // an iris never glows
        if (d < rp + 0.5) c = c.map((q) => q * 0.15 + 0.012 * clamp(rp + 0.5 - d) * 0);
        set(i, c, edge);
      }
    }
    // the upper lid's lash line: the darkest accent, thick in the middle, past the outer corner a little
    const dir = e.cx < ic[0] ? 1 : -1; void dir;
    const thick = Math.max(1.4, wd * 0.08);
    for (let x = e.x0 - 1; x <= e.x1 + 1; x++) {
      const t = e.top.get(Math.max(e.x0, Math.min(e.x1, x))); if (t == null) continue;
      const u = (x - e.x0) / Math.max(1, e.x1 - e.x0), th = thick * (0.55 + 0.45 * Math.sin(Math.PI * clamp(u)));
      for (let k = -Math.ceil(th); k <= 0; k++) { const y = t + k, i = y * w + x; if (y < 0 || y >= h || x < 0 || x >= w) continue; set(i, lash, clamp(1 + (k + th) / th * 0.15) * 0.85 * (inside.has(i) ? 0.7 : 1)); }
      if (inside.has(t * w + x)) set(t * w + x, lash, 0.55);
    }
    // the lower lid's wet, lit ledge (the middle half of it)
    for (let x = e.x0; x <= e.x1; x++) {
      const u = (x - e.x0) / Math.max(1, e.x1 - e.x0); if (u < 0.2 || u > 0.85) continue;
      const b = e.bot.get(x); if (b == null || b + 1 >= h) continue;
      const i = (b + 1) * w + x, s = [study[i * 3], study[i * 3 + 1], study[i * 3 + 2]].map((q) => Math.min(1, q * 1.25 + 0.04));
      set(i, s, 0.45 * Math.sin(Math.PI * (u - 0.2) / 0.65));
    }
    // one catch-light toward the key, on the iris's edge above the pupil, inside the opening
    const gx = ic[0] + key[0] * ri * 0.45, gy = ic[1] + key[1] * ri * 0.5, gr = Math.max(0.9, ri * 0.24);
    for (let y = Math.floor(gy - gr - 1); y <= gy + gr + 1; y++) for (let x = Math.floor(gx - gr - 1); x <= gx + gr + 1; x++) {
      const i = y * w + x; if (x < 0 || y < 0 || x >= w || y >= h || !inside.has(i)) continue;
      set(i, [0.97, 0.94, 0.88].map((c) => c * Math.max(0.75, L)), clamp(gr + 0.6 - Math.hypot(x - gx, y - gy)) * 0.95);
    }
  }
}
