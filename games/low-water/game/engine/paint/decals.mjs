// Attack telegraphs as ground decals in painted mode (the night-crowd reference: many enemies read at once on a dark,
// torchlit floor when each wind-up is written on the ground). For every tell showing (combat/anim/fx.mjs: id, kind,
// k 0..1 through the wind-up, unstoppable), a ring on the ground round the attacker's feet in the view's one hot
// colour: it tightens and brightens as the blow comes, a grab's ring is dashed, an unstoppable blow's is doubled, and
// a short wedge points along the attacker's facing. The same signs as glyph mode's rings (glyph/figures.mjs).
//   drawTelegraphs(g, W, tells (Map id -> tell), toScreen) ; ?decals=0 leaves them off
const HOT = [214, 120, 74];
export function drawTelegraphs(g, W, tells, toScreen) {
  if (!tells || !tells.size || (typeof location !== "undefined" && /[?&]decals=0/.test(location.search))) return 0;
  let n = 0; g.save();
  for (const F of W.fighters) {
    const t = tells.get(F.id); if (!t || F.out || F.team === "lamb") continue;
    const k = Math.max(0, Math.min(1, t.k || 0)), R = 0.75 * (1.25 - 0.35 * k), pts = [];
    for (let a = 0; a <= 40; a++) { const th = (a / 40) * Math.PI * 2, p = toScreen([F.x + Math.cos(th) * R, 0.02, F.z + Math.sin(th) * R]); if (!p) { pts.length = 0; break; } pts.push(p); }
    if (!pts.length) continue;
    const alpha = 0.35 + 0.6 * k, ring = (scale) => { g.beginPath(); pts.forEach((p, i) => { const c = toScreen([F.x, 0.02, F.z]), x = c.x + (p.x - c.x) * scale, y = c.y + (p.y - c.y) * scale; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke(); };
    g.strokeStyle = `rgba(${HOT.join(",")},${alpha.toFixed(3)})`; g.lineWidth = 2 + 3 * k; g.setLineDash(t.kind === "grab" ? [8, 7] : []);
    g.shadowColor = `rgba(${HOT.join(",")},${(0.6 * k).toFixed(3)})`; g.shadowBlur = 10 * k;
    ring(1); if (t.unstoppable) ring(1.22);
    // the wedge along the facing: where the blow will land
    const f = F.face || 0, tip = toScreen([F.x + Math.cos(f) * (R + 0.55), 0.02, F.z + Math.sin(f) * (R + 0.55)]), l = toScreen([F.x + Math.cos(f - 0.35) * R, 0.02, F.z + Math.sin(f - 0.35) * R]), r = toScreen([F.x + Math.cos(f + 0.35) * R, 0.02, F.z + Math.sin(f + 0.35) * R]);
    if (tip && l && r) { g.setLineDash([]); g.fillStyle = `rgba(${HOT.join(",")},${(0.25 + 0.5 * k).toFixed(3)})`; g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(tip.x, tip.y); g.lineTo(r.x, r.y); g.closePath(); g.fill(); }
    n++;
  }
  g.restore(); return n;
}

// Its own canvas over the view, independent of the fight layer: each frame, the fight running (G.ext.combat.current),
// its tells (combat/anim/fx.mjs fxOf) and the plate camera's projection. Painted mode only.
export function installDecals({ parent, G, cam, isGlyph }) {
  const cv = document.createElement("canvas"); cv.className = "telegraphs"; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3";
  parent.append(cv); let raf = 0, fxOf = null; import("../combat/anim/fx.mjs").then((m) => { fxOf = m.fxOf; }).catch((e) => console.warn(`decals: ${e.message}`));
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const r = parent.getBoundingClientRect(); if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) { cv.width = Math.round(r.width); cv.height = Math.round(r.height); }
    const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    const C = G() && G().ext && G().ext.combat, W = C && C.current && C.current.W; if (!W || W.result || !fxOf || !cam.ready() || (isGlyph && isGlyph())) return;
    const tells = new Map(fxOf(W).tells.map((t) => [t.id, t])), A = W.field && W.field.arena;
    drawTelegraphs(g, W, tells, ([x, y, z]) => { const s = cam.toScreen([x, (A && A.grid && G().ext ? groundOf(A, x, z) : 0) + y, z]); return s && { x: s[0], y: s[1] }; });
  };
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); cv.remove(); } };
}
let groundOf = () => 0; import("../world/plateworld.mjs").then((m) => { groundOf = (A, x, z) => m.groundAt(A, x, z) ?? 0; }).catch(() => {});
