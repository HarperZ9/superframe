// Weight on contact, and Lamb kept in sight (combat engineer's feel capture, 2026-10-17).
//
// Hit reactions: combat's fxOf(W).contacts names each frame's hits, catches, blocks and guard breaks
// with the struck body, the striker and a power 0..1. A struck body takes an additive reaction on top
// of whatever it plays (combat may start a flinch or stagger move, or, against armour, nothing): it
// snaps away from the blow within two frames and springs back over about 0.35 s, scaled by power and
// shaped by the blow's direction (from the front the chest and head are thrown back, from a side the
// body bends and turns away, from behind it pitches forward). The striker of a heavy blow (power 0.6
// and over), a blocked or a caught blow recoils: the chest and the tool arm rebound.
//   const R = makeReactions(fxOf)   R.read(W)  once a frame;   R.layer(id, face) -> pose offset or null
//
// Lamb's outline: when other figures are drawn over Lamb, Lamb's silhouette edge is drawn over them in
// pale ink, so Lamb is never lost behind two wardens. Lamb's drawn pixels are kept as Lamb is drawn;
// after the frame's figures (a microtask, like the contact shadows) the canvas is read over Lamb's box,
// and wherever a Lamb pixel now shows something else, Lamb's edge there is inked.
//   queueLambOutline(g, { ox, oy, w, h, rgba })   rgba: Lamb's drawn bytes
const REACT_S = 0.36, RISE_S = 0.035;

export function makeReactions(fxOf) {
  const hits = new Map(); let lastTick = null;
  return {
    // once a frame: every contact since the last tick drawn (fxOf(W, since) reads combat's 30-tick log, so
    // ticks the render skipped still land); reactions age by combat's ticks, and hold while a body is in
    // hit-stop (fxOf's frozen), so the freeze stays honest
    read(W) {
      if (!fxOf || !W || W.tick === lastTick) return;
      const since = lastTick != null && W.tick > lastTick && W.tick - lastTick <= 30 ? lastTick : null, step = since != null ? W.tick - since : 1;
      lastTick = W.tick;
      let fx; try { fx = since != null ? fxOf(W, since) : fxOf(W); } catch (e) { console.warn("fight figures: fxOf failed:", e.message); return; }
      const frozen = new Set(fx.frozen || []);
      for (const [id, h] of hits) if (!frozen.has(id)) h.age += step / 60; else h.age = Math.max(h.age, RISE_S);   // in hit-stop: held at the full snap
      for (const c of fx.contacts || []) {
        const T = W.byId && W.byId(c.id), A = c.by && W.byId && W.byId(c.by), age = c.t != null ? Math.max(0, (W.tick - c.t) / 60) : 0;
        const from = A && T ? [A.x - T.x, A.z - T.z] : [Math.cos(T ? T.face : 0), Math.sin(T ? T.face : 0)];
        if (c.kind === "hit" || c.kind === "guardbreak") hits.set(c.id, { age: frozen.has(c.id) ? RISE_S : age, pw: Math.max(0.25, c.power), from, kind: "struck" });
        if (A && (c.kind === "block" || c.kind === "catch" || (c.kind === "hit" && c.power >= 0.6))) hits.set(c.by, { age: frozen.has(c.by) ? RISE_S : age, pw: c.kind === "catch" ? 1 : c.kind === "block" ? 0.6 : c.power, from: [-from[0], -from[1]], kind: "recoil" });
      }
    },
    // the additive pose for body id facing `face` (combat radians) at time now (s), or null
    layer(id, face) {
      const h = hits.get(id); if (!h) return null;
      const t = h.age; if (t > REACT_S * 2.5) { hits.delete(id); return null; }
      // snap in over RISE_S, spring back with one small overshoot
      const env = t < RISE_S ? Math.sin((t / RISE_S) * Math.PI * 0.5) : Math.exp(-(t - RISE_S) / (REACT_S * 0.45)) * Math.cos(((t - RISE_S) / REACT_S) * Math.PI * 0.9);
      const a = 1.3 * env * h.pw, l = Math.hypot(h.from[0], h.from[1]) || 1, fx = Math.cos(face), fz = Math.sin(face);
      const front = (h.from[0] * fx + h.from[1] * fz) / l, left = (-h.from[0] * fz + h.from[1] * fx) / l;
      if (h.kind === "recoil") return { spine: { bend: -8 * a }, chest: { bend: -12 * a }, head: { bend: -6 * a }, root: { pitch: -4 * a, y: -0.02 * a }, armR: { fwd: -22 * a }, foreR: { bend: 14 * a } };
      const back = Math.max(0, front), fwd = Math.max(0, -front), s = left;   // the blow came from the front (back), behind (fwd) or a side
      return {
        root: { pitch: (-7 * back + 6 * fwd) * a, roll: -7 * s * a, y: -0.05 * a },
        spine: { bend: (-12 * back + 14 * fwd) * a, side: -14 * s * a },
        chest: { bend: (-18 * back + 10 * fwd) * a, side: -10 * s * a, turn: -18 * s * a },
        neck: { bend: (-10 * back + 8 * fwd) * a },
        head: { bend: (-20 * back + 14 * fwd) * a, turn: -24 * s * a, side: -8 * s * a },
        armL: { out: 18 * a }, armR: { out: 14 * a },
        thighL: { fwd: -6 * back * a }, shinL: { bend: 10 * a }, shinR: { bend: 12 * a },
      };
    },
  };
}

const outlines = new Map(); let pending = false;
const INK = [240, 232, 214];
export function queueLambOutline(g, job) {
  outlines.set(g, job);
  if (!pending) { pending = true; queueMicrotask(flushOutlines); }
}
function flushOutlines() {
  pending = false;
  for (const [g, J] of outlines) {
    outlines.delete(g);
    const { ox, oy, w, h, rgba } = J, W = g.canvas.width, H = g.canvas.height;
    const x0 = Math.max(0, ox), y0 = Math.max(0, oy), x1 = Math.min(W, ox + w), y1 = Math.min(H, oy + h); if (x1 <= x0 || y1 <= y0) continue;
    let now; try { now = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; } catch (e) { console.warn("fight figures: Lamb outline could not read the canvas:", e.message); continue; }
    const bw = x1 - x0, mine = (x, y) => rgba[((y - oy) * w + (x - ox)) * 4 + 3] > 128;
    const covered = (x, y) => { const i = ((y - y0) * bw + (x - x0)) * 4, j = ((y - oy) * w + (x - ox)) * 4; return Math.abs(now[i] - rgba[j]) + Math.abs(now[i + 1] - rgba[j + 1]) + Math.abs(now[i + 2] - rgba[j + 2]) > 24; };
    const out = new ImageData(bw, y1 - y0), d = out.data; let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!mine(x, y) || !covered(x, y)) continue;
      let edge = false;   // within 2 px of Lamb's own silhouette edge
      for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < ox || Y < oy || X >= ox + w || Y >= oy + h || !mine(X, Y)) { edge = true; break; } }
      if (!edge) continue;
      const k = ((y - y0) * bw + (x - x0)) * 4; d[k] = INK[0]; d[k + 1] = INK[1]; d[k + 2] = INK[2]; d[k + 3] = 215; n++;
    }
    if (!n) continue;
    const c = (flushOutlines.scratch ||= new OffscreenCanvas(8, 8)); c.width = bw; c.height = y1 - y0; c.getContext("2d").putImageData(out, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.drawImage(c, x0, y0); g.restore();
    globalThis.__lwLambOutline = n;   // pixels inked this frame (read by proto/feel captures)
  }
}
