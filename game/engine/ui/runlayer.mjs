// A Tide Run in the painted world (design/UI-SYSTEM.md 7.4). Owned by the UI and UX lead. The run
// plays over the plate view under the game camera, framed on the course and the water front
// (CAMERA.md); the chart view (ui/run.mjs) stays for stepped mode and as the accessible view. On
// the plate: Lamb as a figure, flooded ground as close hatching (closer for deeper), frost as
// dotted rings, a pursuer's gaze as hatching, the goal as an ink ring. In the strip: the water in
// words, Lamb's footing, the time left. The outcome flows into the talk panel after 700 ms.
//   runLayer(ctx, host, id, onDone, { cam })
import { h, btn } from "./dom.mjs";
import { createDock } from "./strip.mjs";
import { worldCanvas, clearOfPaper, groundPoly, circlePts, wedgePts, hatch, outline, ring } from "./worldlayer.mjs";
import { drawPerson, placeLamb } from "./worldlayer.mjs";
import { glyph } from "./bindings.mjs";

const REASONS = { goal: "You made it.", swept: "The water took your feet.", fell: "You went off the edge in the dark.", seen: "You were seen.", time: "The water came before you did." };
const SETTLE_MS = 700, GUARD_MS = 450;
const depthWord = (v) => (v.depth <= 0.02 ? "dry underfoot" : v.depth < v.knee ? "below the knee" : v.depth < v.waist ? "above the knee" : "at the waist");

export function runLayer(ctx, host, id, onDone, { cam = null } = {}) {
  const G = ctx.G, run = G.runs.start(id, { mode: G.state.runMode || "full" }), v0 = run.view();
  const xs = [v0.x, v0.goal.x, ...v0.rects.flatMap((r) => [r[0], r[2]])], zs = [v0.z, v0.goal.z, ...v0.rects.flatMap((r) => [r[1], r[3]])];
  const root = h("div.fightlayer.runlayer"); host.append(root);
  const L = worldCanvas(root, { G, cam, id, size: [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)], origin: [Math.min(...xs), Math.min(...zs)] });
  const dock = createDock(root);
  const water = h("span"), depthV = h("span.v"), time = h("span"), seen = h("span");
  const el = h("div.strip.runstrip", h("div.shead", h("span.caps.quiet", run.state.def.name)),
    h("div.srow", h("span.lab", "Water"), water, depthV), h("div.srow", h("span.lab", "Time left"), time, h("span.v")), h("div.srow", h("span.lab", "Seen"), seen, h("span.v")));
  dock.slot.replaceChildren(el);
  // the camera frames the whole course and its water, then keeps it clear of the paper
  if (cam) cam.frameOn((project) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of v0.rects) for (const [x, z] of [[r[0], r[1]], [r[2], r[3]]]) { const [px, py] = project(L.stage.toWorld([x, z], 0)); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    return clearOfPaper([x0, y0, x1, y1], cam, [dock.el, document.querySelector(".hud")]);
  });
  let raf = 0, closed = false, ended = false, settle = 0, layer = null, pauseEl = null, padPrev = false;
  const unloop = G.loop.add("tide-run", (dt) => {
    if (run.state.done || pauseEl) return;
    const m = G.input.get("move") || { x: 0, z: 0 };
    run.step(dt, { x: m.x, z: m.z, run: !!G.input.get("run") });
  }, { order: 15 });
  const down = (e) => { if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); pauseEl ? resume() : pause(); } };
  addEventListener("keydown", down, true);
  const onBlur = () => { if ((ctx.prefs || {}).pauseOnBlur !== false) pause(); };
  addEventListener("blur", onBlur);
  function draw() {
    const v = run.view(), g = L.ctx();
    for (const r of v.rects) {
      const d = v.waterY - (r[4] ?? 0); if (d <= 0) continue;
      const sp = groundPoly(L, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
      hatch(g, sp, Math.min(1, d / v.waist), d >= v.waist ? 4 : d >= v.knee ? 7 : 11);
    }
    for (const f of v.frost || []) ring(g, L, [f[0], f[1]], f[2], { dash: [1, 4], width: 2, alpha: 0.7 });
    if (v.pursuer) { const face = Math.atan2(v.pursuer.fx, v.pursuer.fz), sp = groundPoly(L, wedgePts([v.pursuer.x, v.pursuer.z], face, v.pursuer.cone[0], v.pursuer.cone[1])); hatch(g, sp, 0.3 + v.seen * 0.6, 7, v.seen > 0.5); outline(g, sp, { dash: [5, 4], width: 1.2, alpha: 0.7 }); }
    ring(g, L, [v.goal.x, v.goal.z], v.goal.r, { width: 2, alpha: 0.85 }); ring(g, L, [v.goal.x, v.goal.z], v.goal.r * 0.6, { width: 1.5, alpha: 0.85 });
    if (v.pursuer) drawPerson(g, L, cam, "pursuer", [v.pursuer.x, v.pursuer.z], { face: Math.atan2(v.pursuer.fz, v.pursuer.fx), walking: true });
    if (cam) placeLamb(G, L, [v.x, v.z]); else drawPerson(g, L, cam, "lamb", [v.x, v.z]);
    const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
    set(water, depthWord(v)); set(depthV, `${v.depth.toFixed(2)} m`);
    set(time, Number.isFinite(v.limit) ? `${Math.max(0, v.limit - v.minutes)} min` : "no limit");
    set(seen, !v.pursuer ? "nobody watching" : v.seen >= 0.01 ? `${Math.round(Math.min(1, v.seen) * 100)} percent` : "not seen");
    if (v.done && !ended) { ended = true; settle = setTimeout(finish, SETTLE_MS); }
  }
  function frame() {
    if (closed) return;
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null, st = !!(p && p.buttons[9] && p.buttons[9].pressed);
    if (st && !padPrev) (pauseEl ? resume() : pause()); padPrev = st;
    draw(); raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (pauseEl || ended) return; G.loop.paused = true;
    const r = btn(["Resume", glyph("pause")], resume, { cls: "btn" });
    pauseEl = h("div.fightpause", h("div.menu.sheet.fade-in", h("h2", "Paused"), h("p.quiet.small", run.state.def.name), r, btn("Settings", () => ctx.settings && ctx.settings(), { cls: "btn" })));
    root.append(pauseEl); if (ctx.F) ctx.F.focus(r, { scroll: false });
  }
  function resume() { if (!pauseEl) return; pauseEl.remove(); pauseEl = null; G.loop.paused = false; }
  function finish() {
    if (closed) return; closed = true; clearTimeout(settle); cancelAnimationFrame(raf); unloop();
    removeEventListener("keydown", down, true); removeEventListener("blur", onBlur);
    if (cam) cam.frameOn(null); G.loop.paused = false;
    if (ctx.F && layer) ctx.F.pop(layer);
    const v = run.view(); dock.say("", REASONS[v.reason] || v.reason || "", { ms: 1600 });
    el.classList.add("leaving"); setTimeout(() => { L.remove(); el.remove(); }, 160); setTimeout(() => root.remove(), 1800);
    if (ctx.F) { const guard = ctx.F.push({ name: "run-guard", root: h("div"), onAction: () => true, onBack: () => true }); setTimeout(() => ctx.F.pop(guard), GUARD_MS); }
    onDone();
  }
  if (ctx.F) layer = ctx.F.push({ name: "run", root, onAction: () => !pauseEl, onBack: () => { if (pauseEl) resume(); } }); // pad B is crouch here; Esc and Start pause
  raf = requestAnimationFrame(frame);
  return { run, draw, finish, dock, pause, resume };
}
