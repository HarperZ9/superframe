// The inner arena's readability measures (combat/PROGRESS.md 30), taken from the finished frame in greyscale (CIE L*
// from the canvas's own pixels, so the tone, the grain and the HUD are all in what is measured):
//   P1  the player's figure is 130 px tall or more at 1080 lines on every frame he stands (design/CAMERA.md: people at
//       130 to 160 px at 1080p); a roll, a fall and being down are left out and reported
//   P2  the player's outline reads on every frame: half or more of his outline pixels differ by dL* 8 or more from the
//       ground 2 px outside them
//   F1  every part a form names (Saturn's eyes, the arm, a limb's mark, the horns, the cart's wheel, the ice's
//       crack, Received's lids...) is 6 px or more across at 1080 on its smaller side, and differs from the ring
//       round it by dL* 15 or more, at every still
//   S1  the grey silhouette test: two different forms (or one boss's two looks) overlap less than 0.75 (0.85 for one
//       boss's looks) as plain silhouettes at game scale, set on the same foot point
// Controls that must fail: the player drawn flat at the ground's value with no edge (P2, ?innerfx=rim,lambflat); a part
// named over empty ground and a part 1 px across (F1); a silhouette compared with itself (S1).
//   install(P) puts the page-side functions in; PLAYER and STILL are the per-frame and per-still expressions

export const PAGE = `(() => {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y);
  const reader = (d, w) => { const k = w / 640; return (x, y) => { const i = (Math.round(y * k) * w + Math.round(x * k)) * 4; return Lstar(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])); }; };
  window.__lambMeasure = (d, w) => {
    const A = window.__arena, V = A.view, M = V.lambMask, B = V.lambBox, L = A.W.lamb(); if (!M || !B) return null;
    const Ls = reader(d, w), m = (x, y) => x >= 0 && y >= 0 && x < 640 && y < 360 && M[y * 640 + x] === 1;
    let edges = 0, sep = 0; const [x0, y0, bw, bh] = B;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
      if (!m(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!m(x + dx, y + dy)) { edges++; const ox = x + 2 * dx, oy = y + 2 * dy; if (ox >= 0 && oy >= 0 && ox < 640 && oy < 360 && !m(ox, oy) && Math.abs(Ls(x, y) - Ls(ox, oy)) >= 8) sep++; break; }
    }
    return { h1080: bh * 3, sep: edges ? +(sep / edges).toFixed(3) : 0, hidden: V.lambHidden || 0, act: L.act ? L.act.id : null, pose: V.lambPose || null, down: !!(L.fallen || L.out || L.hp <= 0) };
  };
  const featureOf = (Ls, f) => {
    let si = 0, ni = 0, so = 0, no = 0, size;
    if (f.boxes) {
      const mean = (bs) => { let s = 0, n = 0; for (const [x, y, bw, bh] of bs) for (let yy = Math.max(0, y | 0); yy < Math.min(360, y + bh); yy++) for (let xx = Math.max(0, x | 0); xx < Math.min(640, x + bw); xx++) { s += Ls(xx, yy); n++; } return n ? s / n : 0; };
      const a = mean(f.boxes), b = mean(f.vs); size = [Math.min(...f.boxes.map((q) => q[2])) * 3, Math.min(...f.boxes.map((q) => q[3])) * 3];
      return { name: f.name, size: size.map((v) => +v.toFixed(1)), dL: +Math.abs(a - b).toFixed(1) };
    }
    const vals = [];
    if (f.box) {
      const [x, y, bw, bh] = f.box.map(Math.round), ix = Math.max(1, Math.round(bw * 0.2)), iy = Math.max(1, Math.round(bh * 0.2)); size = [bw * 3, bh * 3]; let se = 0, ne = 0;
      for (let yy = y - 5; yy < y + bh + 5; yy++) for (let xx = x - 5; xx < x + bw + 5; xx++) {
        if (xx < 0 || yy < 0 || xx >= 640 || yy >= 360) continue;
        const inside = xx >= x && xx < x + bw && yy >= y && yy < y + bh, near = xx >= x - 2 && xx < x + bw + 2 && yy >= y - 2 && yy < y + bh + 2, core = xx >= x + ix && xx < x + bw - ix && yy >= y + iy && yy < y + bh - iy;
        if (core || (inside && bw < 5) || (inside && bh < 5)) { const v = Ls(xx, yy); si += v; ni++; vals.push(v); } else if (inside) { se += Ls(xx, yy); ne++; } else if (!near) { so += Ls(xx, yy); no++; }
      }
      if (ni && no) { const ring = so / no, spread = f.pattern && vals.length > 8 ? (vals.sort((a, b) => a - b), vals[Math.floor(vals.length * 0.9)] - vals[Math.floor(vals.length * 0.1)]) : 0;
        return { name: f.name, size, dL: +Math.max(Math.abs(si / ni - ring), ne ? Math.abs(se / ne - ring) : 0, spread).toFixed(1) }; }
    } else {
      const [x1, y1, x2, y2] = f.seg, hw = f.w / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1; size = [len * 3, f.w * 3]; let se = 0, ne = 0;
      for (let yy = Math.floor(Math.min(y1, y2) - hw - 5); yy <= Math.max(y1, y2) + hw + 5; yy++) for (let xx = Math.floor(Math.min(x1, x2) - hw - 5); xx <= Math.max(x1, x2) + hw + 5; xx++) {
        if (xx < 0 || yy < 0 || xx >= 640 || yy >= 360) continue;
        const t = Math.max(0, Math.min(1, ((xx - x1) * (x2 - x1) + (yy - y1) * (y2 - y1)) / (len * len))), dd = Math.hypot(xx - (x1 + t * (x2 - x1)), yy - (y1 + t * (y2 - y1)));
        if (dd <= hw * 0.6) { const v = Ls(xx, yy); si += v; ni++; vals.push(v); } else if (dd <= hw + 0.5) { se += Ls(xx, yy); ne++; } else if (dd > hw + 1.5 && dd <= hw + 5) { so += Ls(xx, yy); no++; }
      }
      // a part with an ink line round a pale core reads by its edge: the larger difference counts
      const spread = f.pattern && vals.length > 8 ? (vals.sort((a, b) => a - b), vals[Math.floor(vals.length * 0.9)] - vals[Math.floor(vals.length * 0.1)]) : 0;
      if (ni && ne && no) return { name: f.name, size: size.map((v) => +v.toFixed(1)), dL: +Math.max(Math.abs(si / ni - so / no), Math.abs(se / ne - so / no), spread).toFixed(1) };
    }
    return ni && no ? { name: f.name, size: size.map((v) => +v.toFixed(1)), dL: +Math.abs(si / ni - so / no).toFixed(1) } : { name: f.name, size: size.map((v) => +v.toFixed(1)), dL: null, out: true };
  };
  window.__stillMeasure = (d, w, plant) => {
    const V = window.__arena.view, Ls = reader(d, w), fs = [...(V.features || []), ...(plant || [])];
    return { feats: fs.map((f) => featureOf(Ls, f)), sil: V.silhouettes ? V.silhouettes() : [] };
  };
  return true;
})()`;

const P1_MIN = 130, P2_MIN = 0.5, F1_SIZE = 6, F1_DL = 15, S1_OTHER = 0.75, S1_LOOKS = 0.85;
// a roll, a fall and being down change the figure's height by design; they are reported apart (any pose)
const rolling = (f) => /^(dodge|down|fall)$/.test(f.lamb.pose || "") || (!!f.lamb.act && /roll|dodge|fall|down/.test(f.lamb.act));

export function judgePlayer(frames) {
  const errs = [], ok = frames.filter((f) => f.lamb), stand = ok.filter((f) => !f.lamb.down && !rolling(f));
  const hMin = stand.length ? Math.min(...stand.map((f) => f.lamb.h1080)) : null, hAll = ok.length ? Math.min(...ok.map((f) => f.lamb.h1080)) : null;
  const seps = ok.map((f) => f.lamb.sep).sort((a, b) => a - b), sepMin = seps.length ? seps[0] : null, sepMed = seps.length ? seps[seps.length >> 1] : null;
  if (hMin != null && hMin < P1_MIN) errs.push(`P1: the player stood ${hMin} px tall at 1080 (at least ${P1_MIN})`);
  const low = ok.filter((f) => f.lamb.sep < P2_MIN).length;
  if (low) errs.push(`P2: on ${low} of ${ok.length} frames under half the player's outline read (lowest ${sepMin})`);
  return { errs, h1080Min: hMin, h1080MinAny: hAll, sepMin, sepMedian: sepMed, coveredFrames: ok.filter((f) => f.lamb.hidden > 0).length };
}

export function judgeFeatures(stills) {
  const errs = [], seen = {};
  let outOfFrame = 0;
  for (const s of stills) for (const f of s.feats || []) {
    if (f.out) { outOfFrame++; continue; }
    const k = f.name.split(":")[0]; (seen[k] ||= { n: 0, minSize: 1e9, minDL: 1e9 }); seen[k].n++; seen[k].minSize = Math.min(seen[k].minSize, Math.min(...f.size)); seen[k].minDL = Math.min(seen[k].minDL, f.dL);
    if (Math.min(...f.size) < F1_SIZE) errs.push(`F1: ${f.name} at ${s.still} is ${Math.min(...f.size).toFixed(1)} px across at 1080 (at least ${F1_SIZE})`);
    if (f.dL < F1_DL) errs.push(`F1: ${f.name} at ${s.still} differs from its ring by dL* ${f.dL} (at least ${F1_DL})`);
  }
  return { errs, parts: seen, outOfFrame };
}

const BODY_LOOKS = { prudence: ["coats", "eye"], father: ["saturn", "arm"], golem: ["cell", "walls"], beast: ["gap"] };
const decode = (s) => { const [, , w, h] = s.box, bits = new Uint8Array(w * h); let p = 0, on = 0; for (const n of s.rle.split(",").map(Number)) { if (on) bits.fill(1, p, p + n); p += n; on ^= 1; } return { w, h, bits }; };
// overlap of two silhouettes set on the same foot point (the middle of the box's bottom row), at game scale
export function iou(a, b) {
  const A = decode(a), B = decode(b), W2 = Math.max(A.w, B.w), H2 = Math.max(A.h, B.h);
  const at = (S, x, y) => { const sx = x - Math.floor((W2 - S.w) / 2), sy = y - (H2 - S.h); return sx >= 0 && sy >= 0 && sx < S.w && sy < S.h ? S.bits[sy * S.w + sx] : 0; };
  let i = 0, u = 0; for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const p = at(A, x, y), q = at(B, x, y); if (p && q) i++; if (p || q) u++; }
  return u ? i / u : 0;
}

export function judgeSilhouettes(stills) {
  const errs = [], kinds = new Map();
  // one silhouette per form and look (a hand's look is the boss's, so hands are keyed by form alone; a limb by its lie)
  for (const s of stills) for (const sil of s.sil || []) { const key = sil.id.includes("hand") ? sil.form : sil.id.includes("limb") ? `limb:${sil.id.split("-").pop()}` : `${sil.form}:${sil.look || "base"}`; if (!kinds.has(key)) kinds.set(key, { ...sil, at: s.still }); }
  const list = [...kinds.entries()], pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [ka, a] = list[i], [kb, b] = list[j], same = a.form === b.form, v = iou(a, b), lim = same ? S1_LOOKS : S1_OTHER;
    const bodyChange = (s) => (BODY_LOOKS[s.form] || []).includes(s.look);
    if (same && !bodyChange(a) && !bodyChange(b)) { pairs.push({ a: ka, b: kb, iou: +v.toFixed(3), room: true }); continue; }
    pairs.push({ a: ka, b: kb, iou: +v.toFixed(3) });
    if (v >= lim) errs.push(`S1: ${ka} and ${kb} overlap ${v.toFixed(2)} as silhouettes (under ${lim})`);
  }
  return { errs, kinds: list.map(([k, s]) => ({ key: k, box: s.box, at: s.at })), worst: pairs.sort((p, q) => q.iou - p.iou).slice(0, 6) };
}
