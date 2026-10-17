// A sneak in the painted world (design/UI-SYSTEM.md 7.3). Owned by the UI and UX lead. The sneak
// plays over the plate view under the game camera, as fights do; the chart view (ui/sneak.mjs)
// stays for stepped mode and as the accessible view. On the plate: Lamb and each watcher as
// figures, each watcher's gaze as pencil hatching on the ground (heavier as it grows sure), where it
// last heard Lamb as an ink cross, hiding places as hatched ground, the way out as an ink ring. In
// the strip: each watcher's state as a word, a mark and notches, Lamb's pace and cover, time left.
// Telegraphs and voices speak in the voice line. When it ends, 700 ms for the moment to land, then
// the outcome flows into the talk panel behind the same input guard as a fight.
//   sneakLayer(ctx, host, id, onDone, { cam })
// Keys as the chart's: arrows or WASD move, C or Ctrl held crouch, Shift held hurry, T throw,
// F strike from behind; pad: stick, B held crouch, X held hurry, Y throw, RB strike, Start pause.
// Where the sneak's ground lies: world/stage.mjs stageFor with the sneak's id (an `arena: <sneak id>
// x y z yaw` line on the area places it; without one it is laid around Lamb).
import { h, btn } from "./dom.mjs";
import { createDock } from "./strip.mjs";
import { worldCanvas, clearOfPaper, groundPoly, circlePts, wedgePts, hatch, outline, ring, INK } from "./worldlayer.mjs";
import { drawPerson, placeLamb } from "./worldlayer.mjs";
import { glyph } from "./bindings.mjs";

const OUT = { win: "Across, unseen.", seen: "Seen.", ambush: "You strike first.", time: "Out of time." };
const MARK = { unaware: "", suspicious: "?", searching: "??", seen: "!" };
const STRENGTH = { unaware: 0.05, suspicious: 0.35, searching: 0.6, seen: 0.9 };
const CROUCH = new Set(["KeyC", "ControlLeft", "ControlRight"]);
const SETTLE_MS = 700, GUARD_MS = 450;

function boundsOf(v) {
  const xs = [v.x, v.goal.x], zs = [v.z, v.goal.z];
  for (const r of v.rects) { xs.push(r[0], r[2]); zs.push(r[1], r[3]); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

export function sneakLayer(ctx, host, id, onDone, { cam = null } = {}) {
  const G = ctx.G, sn = G.sneaks.start(id, { mode: G.state.runMode || "full" }), v0 = sn.view(), b = boundsOf(v0);
  const root = h("div.fightlayer.sneaklayer");
  host.append(root);
  const L = worldCanvas(root, { G, cam, id, size: [b.x1 - b.x0, b.z1 - b.z0], origin: [b.x0, b.z0] });
  const dock = createDock(root), strip = sneakStrip(dock, sn.state.def.name);
  if (cam) cam.frameOn((project) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const v = sn.view();
    for (const [x, z] of [[v.x, v.z], [v.goal.x, v.goal.z], ...v.watchers.map((w) => [w.x, w.z])]) for (const [dx, dz] of [[-1.5, -1.5], [1.5, 1.5]]) {
      const [px, py] = project(L.stage.toWorld([x + dx, z + dz], 0)); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    return clearOfPaper([x0, y0, x1, y1], cam, [dock.el, document.querySelector(".hud")]);
  });
  let raf = 0, closed = false, crouch = false, padPrev = [], settle = 0, layer = null, ended = false, pauseEl = null;
  const offSay = G.on("stealth.state", (e) => { if (e.say) dock.say(String(e.name).toUpperCase(), e.say); });
  const offVoice = G.on("stealth.voice", (e) => dock.say(String(e.name).toUpperCase(), e.text));
  const down = (e) => {
    if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); return pauseEl ? resume() : pause(); }
    if (CROUCH.has(e.code)) crouch = true; if (e.code === "KeyT") G.input.press("throw"); if (e.code === "KeyF") G.input.press("ambush");
  };
  const up = (e) => { if (CROUCH.has(e.code)) crouch = false; };
  addEventListener("keydown", down, true); addEventListener("keyup", up, true);
  const onBlur = () => { if ((ctx.prefs || {}).pauseOnBlur !== false) pause(); };
  addEventListener("blur", onBlur);
  const unloop = G.loop.add("sneak", (dt) => {
    if (sn.state.done || pauseEl) return;
    const m = G.input.get("move") || { x: 0, z: 0 };
    sn.step(dt, { x: m.x, z: m.z, run: !!G.input.get("run"), crouch: crouch || !!G.input.get("crouch"), throw: G.input.pressed("throw"), ambush: G.input.pressed("ambush") });
  }, { order: 15 });
  function pad() {
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null; if (!p) return;
    G.input.set("crouch", !!(p.buttons[1] && p.buttons[1].pressed));
    [[3, "throw"], [5, "ambush"]].forEach(([i, n]) => { const d = p.buttons[i] && p.buttons[i].pressed; if (d && !padPrev[i]) G.input.press(n); padPrev[i] = d; });
    const st = p.buttons[9] && p.buttons[9].pressed; if (st && !padPrev[9]) (pauseEl ? resume() : pause()); padPrev[9] = st;
  }
  function draw() {
    const v = sn.view(), g = L.ctx();
    for (const hd of v.hides) { const sp = groundPoly(L, circlePts([hd.x, hd.z], hd.r)); hatch(g, sp, 0.2, 6); outline(g, sp, { dash: [4, 3], width: 1, alpha: 0.6 }); }
    ring(g, L, [v.goal.x, v.goal.z], v.goal.r, { width: 2, alpha: 0.85 }); ring(g, L, [v.goal.x, v.goal.z], v.goal.r * 0.6, { width: 1.5, alpha: 0.85 });
    for (const w of v.watchers) {
      const s = STRENGTH[w.state] ?? 0.2, sp = groundPoly(L, wedgePts([w.x, w.z], w.face, w.cone[0], w.cone[1]));
      hatch(g, sp, s * Math.max(0.4, w.a), w.state === "seen" ? 4 : 7, w.state === "seen"); outline(g, sp, { dash: w.state === "unaware" ? [5, 4] : null, width: w.state === "unaware" ? 1 : 1.6, alpha: 0.55 + s * 0.4 });
      if (w.lastKnown && w.state !== "unaware") { const c = L.screen(w.lastKnown); if (c) { g.strokeStyle = `${INK}0.9)`; g.lineWidth = 2; g.beginPath(); g.moveTo(c.x - 6, c.y - 4); g.lineTo(c.x + 6, c.y + 4); g.moveTo(c.x + 6, c.y - 4); g.lineTo(c.x - 6, c.y + 4); g.stroke(); } }
    }
    // the watchers through the person drawer; Lamb by the people layer, moved to where the sneak puts Lamb
    for (const w of [...v.watchers].sort((a, c) => a.z - c.z)) drawPerson(g, L, cam, w.id, [w.x, w.z], { face: Math.atan2(Math.cos(w.face), Math.sin(w.face)), walking: w.state === "searching" });
    if (cam) placeLamb(G, L, [v.x, v.z]); else drawPerson(g, L, cam, "lamb", [v.x, v.z], { crouch: v.crouch || crouch });
    strip.update(v, crouch);
    if (v.done && !ended) { ended = true; settle = setTimeout(finish, SETTLE_MS); }
  }
  function frame() { if (closed) return; pad(); draw(); raf = requestAnimationFrame(frame); }
  function pause() {
    if (pauseEl || ended) return; G.loop.paused = true;
    const r = btn(["Resume", glyph("pause")], resume, { cls: "btn" });
    pauseEl = h("div.fightpause", h("div.menu.sheet.fade-in", h("h2", "Paused"), h("p.quiet.small", sn.state.def.name), r, btn("Settings", () => ctx.settings && ctx.settings(), { cls: "btn" })));
    root.append(pauseEl); if (ctx.F) ctx.F.focus(r, { scroll: false });
  }
  function resume() { if (!pauseEl) return; pauseEl.remove(); pauseEl = null; G.loop.paused = false; }
  function finish() {
    if (closed) return; closed = true; clearTimeout(settle); cancelAnimationFrame(raf); unloop(); offSay(); offVoice();
    removeEventListener("keydown", down, true); removeEventListener("keyup", up, true); removeEventListener("blur", onBlur);
    if (cam) cam.frameOn(null); G.loop.paused = false;
    if (ctx.F && layer) ctx.F.pop(layer);
    const outcome = sn.view().outcome;
    dock.say("", OUT[outcome] || outcome || "", { ms: 1600 });
    strip.leave().then(() => { L.remove(); setTimeout(() => root.remove(), 1700); });
    if (ctx.F) { const guard = ctx.F.push({ name: "sneak-guard", root: h("div"), onAction: () => true, onBack: () => true }); setTimeout(() => ctx.F.pop(guard), GUARD_MS); }
    onDone();
  }
  if (ctx.F) layer = ctx.F.push({ name: "sneak", root, onAction: () => !pauseEl, onBack: () => { if (pauseEl) resume(); } }); // pad B is crouch here; Esc and Start pause
  raf = requestAnimationFrame(frame);
  return { sneak: sn, draw, finish, strip, dock, pause, resume };
}

// The sneak strip: Lamb's pace and cover, time left, and each watcher in words, marks and notches.
export function sneakStrip(dock, title) {
  const pace = h("span"), cover = h("span"), left = h("span"), rows = h("div.foes"), wr = new Map();
  const el = h("div.strip.sneakstrip",
    h("div.shead", h("span.caps.quiet", title)),
    h("div.srow", h("span.lab", "Pace"), pace, h("span.v")),
    h("div.srow", h("span.lab", "Cover"), cover, h("span.v")),
    h("div.srow", h("span.lab", "Time left"), left, h("span.v")), rows);
  dock.slot.replaceChildren(el);
  function row(w) {
    let r = wr.get(w.id); if (r) return r;
    const ticks = h("span.tick.small"), state = h("span.state"), line = h("div.srow.foe", h("span.lab", w.name), ticks, state);
    for (let k = 0; k < 10; k++) ticks.append(h("i"));
    r = { line, ticks, state }; wr.set(w.id, r); rows.append(line); return r;
  }
  return {
    el,
    update(v, crouch) {
      const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
      set(pace, v.crouch || crouch ? "crouched" : "upright");
      set(cover, v.cover > 0 ? `${Math.round(v.cover * 100)} percent` : "in the open");
      set(left, Number.isFinite(v.limit) ? `${Math.max(0, v.limit - v.minutes)} min` : "no limit");
      for (const w of v.watchers) {
        const r = row(w); set(r.state, `${w.state}${MARK[w.state] ? ` ${MARK[w.state]}` : ""}`);
        [...r.ticks.children].forEach((i, k) => i.style.setProperty("--f", String(Math.max(0, Math.min(1, w.a * 10 - k)))));
        r.line.classList.toggle("seen", w.state === "seen");
      }
    },
    leave() { el.classList.add("leaving"); return new Promise((r) => setTimeout(() => { el.remove(); r(); }, 160)); },
  };
}
