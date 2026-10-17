// Lamb and the people of the scene on the plate, outside fights: one canvas over the plate view,
// every figure drawn through ui/figures.mjs personDrawer() each frame, far ones first. Lamb walks
// on the plate's ground (world/plateworld.mjs over the plate camera's arena grid): a click on the
// plate walks there, and the play screen walks Lamb to a hotspot or an exit before it opens
// (as the prototype did). Speeds in @rules: walk-speed (1.5 m/s, a true walk: the figures blend
// walk under 1.9 m/s and run above 3.0), run-speed (3.6 m/s, the character lead's 3.5 to 4) while the run button is held (Shift,
// the pad's X or a stick push: G.input "run"), walk-metres-per-minute (the clock moves when Lamb
// does; paid on arrival). Idle, walk, run and a talk gesture now and then
// for Lamb and the speaker while a conversation is open.
// Keys and the stick walk Lamb directly too (WASD or the left stick, screen directions turned
// into the plate's ground by its camera), while nothing else is open: the prototype's free walk.
//   const P = peopleLayer(ctx, host, cam, { onPick, idle, onClock, onFrame })   onFrame(dt): each running
//   frame; idle(): whether the world is
//   free to walk; onClock(): the free walk moved the clock (the play screen looks for a due scene)   onPick(worldPoint): a click on the plate
//   P.walkTo([x, y, z], then) -> bool    P.talkingWith(who | null)    P.hide(ids)    P.stop()
//   P.figures() -> [{ who, at, face, walking }]   P.walking()
import { h } from "./dom.mjs";
import { personDrawer } from "./figures.mjs";
import { evaluate } from "../core/expr.mjs";
import { findPath, groundAt, walkable, camBasis } from "../world/plateworld.mjs";

const TALK = ["talk_a", "talk_b", "talk_c"], GESTURE_S = 2.4;

export function peopleLayer(ctx, host, cam, { onPick = null, idle = () => true, onClock = null, onFrame = null } = {}) {
  const G = ctx.G, R = G.rs.rules, canvas = h("canvas.peoplecanvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  host.append(canvas);
  const live = () => G.loop && G.loop.clockRate > 0; // the world clock runs: walking costs no extra minutes
  const S = { runLock: 0, barkAt: -1e9, barkRun: 0, wander: {}, path: null, then: null, run: false, metres: 0, face: {}, talking: null, gesture: {}, hidden: new Set(), raf: 0, last: performance.now(), stopped: false, moving: false };
  const rule = (k, d) => (R[k] != null ? +R[k] : d);
  const waterY = (A) => (A && A.water ? A.water.a + A.water.b * (+G.env.term("tide") || 0) : -Infinity);
  const lambAt = () => G.state.pos || (G.world.area() && G.world.area().spawn) || null;

  function walkTo(p, then = null) {
    const A = cam.arena(), from = lambAt();
    if (!from || !p) return false;
    let path = A ? findPath(A, [from[0], from[2]], [p[0], p[2]], { waterY: waterY(A) }) : [[p[0], p[2]]];
    if (!path) return false;
    if (!path.length) path = [[from[0], from[2]]];
    S.path = path; S.then = then;
    return true;
  }
  // the free walk from the move vector (x right, z down the screen)
  function freeWalk(dt, pos) {
    const v = (G.input && G.input.get("move")) || { x: 0, z: 0 }, L = Math.hypot(v.x || 0, v.z || 0);
    if (L < 0.2 || !idle()) return false;
    const pj = cam.place(), A = cam.arena(); if (!pj || !pj.camera) return false;
    const B = camBasis(pj.camera), fl = Math.hypot(B.f[0], B.f[2]) || 1;
    let dx = B.right[0] * v.x - (B.f[0] / fl) * v.z, dz = B.right[2] * v.x - (B.f[2] / fl) * v.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    S.run = !!G.input.get("run") && performance.now() >= S.runLock; S.path = null; S.then = null;
    const sp = (S.run ? rule("run-speed", 3.6) : rule("walk-speed", 1.5)) * dt * Math.min(1, L), nx = pos[0] + dx * sp, nz = pos[2] + dz * sp;
    S.face.lamb = Math.atan2(dz, dx);
    if (A && !walkable(A, nx, nz, waterY(A))) return true;
    const y = A ? groundAt(A, nx, nz) : null;
    if (A && y != null && Math.abs(y - pos[1]) > 0.6) return true;
    G.state.pos = [nx, y ?? pos[1], nz]; S.metres += sp; S.moving = true;
    const per = rule("walk-metres-per-minute", 6); if (!live() && S.metres >= per) { const m = Math.floor(S.metres / per); S.metres -= m * per; G.advance(m); if (onClock) onClock(); }
    return true;
  }
  function step(dt) {
    const pos = lambAt(); S.moving = false;
    if (pos && freeWalk(dt, pos)) return;
    if (!S.path || !pos) return;
    S.run = !!(G.input && G.input.get("run")) && performance.now() >= S.runLock;
    const A = cam.arena(), sp = (S.run ? rule("run-speed", 3.6) : rule("walk-speed", 1.5)) * dt;
    const [tx, tz] = S.path[0], dx = tx - pos[0], dz = tz - pos[2], d = Math.hypot(dx, dz);
    const k = d <= sp ? 1 : sp / d, nx = pos[0] + dx * k, nz = pos[2] + dz * k, y = A ? groundAt(A, nx, nz) : null;
    if (d > 1e-4) S.face.lamb = Math.atan2(dz, dx);
    G.state.pos = [nx, y ?? pos[1], nz]; S.metres += Math.min(d, sp); S.moving = d > 1e-4;
    if (d <= sp) S.path.shift();
    if (!S.path.length) {
      S.path = null; S.moving = false;
      const per = rule("walk-metres-per-minute", 6), m = Math.floor(S.metres / per);
      if (m > 0 && !live()) { S.metres -= m * per; G.advance(m); } else if (live()) S.metres = 0;
      const then = S.then; S.then = null; if (then) then();
    }
  }
  function figures() {
    const out = [], a = lambAt();
    if (a) out.push({ who: "lamb", at: a, face: S.face.lamb ?? 0, walking: S.moving, running: S.moving && S.run });
    for (const f of G.world.figures()) { const w = S.wander[f.id]; out.push({ who: f.id, at: (w && w.at) || f.at, face: S.face[f.id] ?? (+f.face < 0 ? Math.PI : 0), walking: !!(w && w.moving) }); }
    return out.filter((f) => !S.hidden.has(f.who));
  }
  function gestureOf(who, dt) {
    const gs = S.gesture[who];
    if (gs) { gs.t += dt; if (gs.t < GESTURE_S) return gs; delete S.gesture[who]; }
    if (S.talking && (who === "lamb" || who === S.talking) && Math.random() < dt / 4) return (S.gesture[who] = { anim: TALK[Math.floor(Math.random() * TALK.length)], t: 0 });
    return null;
  }
  function draw(dt) {
    const r = host.getBoundingClientRect(); if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
    const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
    if (!cam.ready()) return;
    const pj = cam.place(), variant = (cam.area() && cam.area().variant) || (pj && pj.variants && pj.variants[0]), lights = (pj && pj.lights && pj.lights[variant]) || [];
    const list = figures().map((f) => ({ f, depth: cam.depthOf(f.at) })).sort((a, b) => b.depth - a.depth);
    for (const { f, depth } of list) {
      const s = cam.toScreen(f.at); if (!s) continue;
      const talking = !!S.talking && (f.who === "lamb" || f.who === S.talking);
      personDrawer()(g, f, { x: s[0], y: s[1], ppm: cam.scaleAt(f.at), at: f.at, face: f.face, walking: f.walking, running: !!f.running, talking, gesture: f.walking ? null : gestureOf(f.who, dt), cam: pj && pj.camera, plate: pj && pj.place, depth, depthAt: cam.depthAt, lights, darkness: cam.darkness() });
    }
  }
  // Passers-by: a figure with wander: r walks between points within r of its spot, stopping a
  // while at each, and stands still while it is the one Lamb is talking to. Live spots go to
  // G.figureAt for the fight's placement and for facing.
  function wanderStep(dt) {
    const A = cam.arena(), spots = (G.figureAt ||= {});
    for (const f of G.world.figures()) {
      if (!f.wander) { delete S.wander[f.id]; delete spots[f.id]; continue; }
      const w = (S.wander[f.id] ||= { at: [...f.at], to: null, wait: 1 + (f.id.length % 3), moving: false });
      w.moving = false;
      if (S.talking === f.id || S.hidden.has(f.id)) { spots[f.id] = w.at; continue; }
      if (!w.to) { w.wait -= dt; if (w.wait <= 0) { const a = Math.random() * Math.PI * 2, r = f.wander * Math.sqrt(Math.random()), t = [f.at[0] + Math.cos(a) * r, f.at[2] + Math.sin(a) * r]; if (!A || groundAt(A, t[0], t[1]) != null) w.to = t; else w.wait = 0.5; } }
      else {
        const dx = w.to[0] - w.at[0], dz = w.to[1] - w.at[2], d = Math.hypot(dx, dz), sp = 1.1 * dt;
        if (d <= sp) { w.at = [w.to[0], A ? groundAt(A, w.to[0], w.to[1]) ?? w.at[1] : w.at[1], w.to[1]]; w.to = null; w.wait = 2 + Math.random() * 4; }
        else { const nx = w.at[0] + (dx / d) * sp, nz = w.at[2] + (dz / d) * sp, y = A ? groundAt(A, nx, nz) : null; if (A && y == null) { w.to = null; w.wait = 1; } else { w.at = [nx, y ?? w.at[1], nz]; w.moving = true; S.face[f.id] = Math.atan2(dz, dx); } }
      }
      spots[f.id] = w.at;
    }
  }
  // Passive voices in the open (LIVE-CONVERSATION B3, B4.3): an area's voice: line is said as a bark
  // when Lamb walks within its r and the skill meets its dc, one at a time, at most two in a row,
  // never while a conversation or fight holds the screen.
  function voices() {
    const a = G.world.area(), pos = lambAt(); if (!a || !pos || !a.voices || !a.voices.length || !idle()) return;
    const now = performance.now(); if (now - S.barkAt < 4000) return;
    if (now - S.barkAt > 12000) S.barkRun = 0; if (S.barkRun >= 2) return;
    const heard = (G.state.barks ||= []);
    for (const v of a.voices) {
      if (v.once && heard.includes(v.key)) continue;
      if (v.at && Math.hypot(pos[0] - v.at[0], pos[2] - v.at[2]) > v.r) continue;
      if (v.cond && !evaluate(v.cond, G.scope)) continue;
      if (G.sheet.skill(v.skill) < v.dc) continue;
      heard.push(v.key); S.barkAt = now; S.barkRun++;
      const sk = G.rs.skills[v.skill]; G.emit("voice.bark", { skill: v.skill, name: sk ? sk.name : v.skill, text: v.text });
      return;
    }
  }
  function frame(now) {
    if (S.stopped) return;
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
    if (!G.loop || !G.loop.paused) { step(dt); wanderStep(dt); voices(); if (onFrame) onFrame(dt); }
    draw(dt);
    S.raf = requestAnimationFrame(frame);
  }
  const onClick = (e) => {
    if (!onPick || e.target.closest("button, a, input, .sheet, .talk")) return;
    const r = host.getBoundingClientRect(), p = cam.pointAt(e.clientX - r.left, e.clientY - r.top);
    if (p) onPick(p);
  };
  host.addEventListener("click", onClick);
  S.raf = requestAnimationFrame(frame);
  return {
    walkTo, figures, step, draw,
    walking: () => !!S.path,
    // Lamb faces the speaker; the speaker faces Lamb
    talkingWith(who) {
      S.talking = who || null; S.gesture = {};
      const f = who && G.world.figures().find((x) => x.id === who), a = lambAt(), fa = f && ((G.figureAt && G.figureAt[f.id]) || f.at);
      if (fa && a) { S.face.lamb = Math.atan2(fa[2] - a[2], fa[0] - a[0]); S.face[who] = Math.atan2(a[2] - fa[2], a[0] - fa[0]); }
    },
    get talkingWithWho() { return S.talking; },
    facing: () => S.face.lamb ?? 0,
    // after a conversation: the run button does nothing for a moment (LIVE-CONVERSATION A3: 0.5 s)
    lockRun(ms = 500) { S.runLock = performance.now() + ms; },
    hide(ids) { S.hidden = new Set(ids || []); },
    stop() { S.stopped = true; cancelAnimationFrame(S.raf); host.removeEventListener("click", onClick); canvas.remove(); },
    canvas,
  };
}
