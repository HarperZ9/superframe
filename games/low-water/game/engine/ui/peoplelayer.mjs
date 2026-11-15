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
import { postureTransform } from "./senseplayer.mjs";
import { h } from "./dom.mjs";
import { personDrawer } from "./figures.mjs";
import { evaluate } from "../core/expr.mjs";
import { findPathVG } from "../world/visgraph.mjs";
import { debugOn } from "./debugflags.mjs";
import { navDebug } from "./navdebug.mjs";
import { findPath, groundAt, walkable, camBasis, bodyCan, clearSpot, spotKind, clearAhead, seatOf, propDistance } from "../world/plateworld.mjs";

const TALK = ["talk_a", "talk_b", "talk_c"], GESTURE_S = 2.4;

export function peopleLayer(ctx, host, cam, { onPick = null, idle = () => true, onClock = null, onFrame = null } = {}) {
  const G = ctx.G, R = G.rs.rules, canvas = h("canvas.peoplecanvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  host.append(canvas);
  const live = () => G.loop && G.loop.clockRate > 0; // the world clock runs: walking costs no extra minutes
  const S = { seatY: {}, runLock: 0, barkAt: -1e9, barkRun: 0, wander: {}, path: null, then: null, run: false, metres: 0, face: {}, talking: null, gesture: {}, hidden: new Set(), raf: 0, last: performance.now(), stopped: false, moving: false, spd: 0, dir: [1, 0], coast: false };
  const rule = (k, d) => (R[k] != null ? +R[k] : d);
  const waterY = (A) => (A && A.water ? A.water.a + A.water.b * (+G.env.term("tide") || 0) : -Infinity);
  const lambAt = () => G.state.pos || (G.world.area() && G.world.area().spawn) || null;

  function walkTo(p, then = null) {
    const A = cam.arena(), from = lambAt();
    if (!from || !p) return false;
    let path = A ? findPathVG(A, [from[0], from[2]], [p[0], p[2]], { waterY: waterY(A) }) : [[p[0], p[2]]]; // the visibility graph, grid A* when the way needs a squeeze (world/visgraph.mjs)
    if (!path) return false;
    if (!path.length) path = [[from[0], from[2]]];
    S.path = path; S.then = then; S.coast = false;
    return true;
  }
  // Walking speed eases (engine PROGRESS 37, the character lead's note: a walk that stopped dead in one frame made
  // the front foot step back): up to speed in WALK_EASE.up s, down to a stop in WALK_EASE.down s at the most,
  // so the legs carry the last step out. S.spd is Lamb's speed now (m/s), S.dir the way she last walked.
  const WALK_EASE = { up: 0.15, down: 0.2 };
  const easeSpeed = (want, top, dt) => { const r = top / (want > S.spd ? WALK_EASE.up : WALK_EASE.down); S.spd = want > S.spd ? Math.min(want, S.spd + r * dt) : Math.max(want, S.spd - r * dt); return S.spd; };
  // the free walk from the move vector (x right, z down the screen); with the stick let go, the walk coasts to a stop
  function freeWalk(dt, pos) {
    const v = (G.input && G.input.get("move")) || { x: 0, z: 0 }, L = Math.hypot(v.x || 0, v.z || 0);
    if (!idle()) { S.spd = 0; return false; }
    const going = L >= 0.2;
    if (!going && !(S.spd > 0.01 && S.coast)) { S.spd = S.path ? S.spd : 0; S.coast = false; return false; }
    const pj = cam.place(), A = cam.arena(); if (!pj || !pj.camera) return false;
    let dx, dz;
    if (going) {
      const B = camBasis(pj.camera), fl = Math.hypot(B.f[0], B.f[2]) || 1;
      dx = B.right[0] * v.x - (B.f[0] / fl) * v.z; dz = B.right[2] * v.x - (B.f[2] / fl) * v.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      S.run = !!G.input.get("run") && performance.now() >= S.runLock; S.path = null; S.then = null; S.coast = true; S.dir = [dx, dz];
    } else [dx, dz] = S.dir;
    const top = (S.run ? rule("run-speed", 3.6) : rule("walk-speed", 1.5)) * gait();
    const sp = easeSpeed(going ? top * Math.min(1, L) : 0, top, dt) * dt, nx = pos[0] + dx * sp, nz = pos[2] + dz * sp;
    if (!going && S.spd <= 0.01) { S.coast = false; return false; }
    S.face.lamb = Math.atan2(dz, dx);
    if (A && !bodyCan(A, [pos[0], pos[2]], nx, nz, waterY(A))) { S.spd = 0; return true; } // props, and the body's margin off them
    if (crowded("lamb", pos, nx, nz)) { S.spd = 0; return true; } // never into another body
    const y = A ? groundAt(A, nx, nz) : null;
    if (A && y != null && Math.abs(y - pos[1]) > 0.6) return true;
    G.state.pos = [nx, y ?? pos[1], nz]; S.metres += sp; S.moving = true; S.vel = [dx * sp / dt, dz * sp / dt];
    const per = rule("walk-metres-per-minute", 6); if (!live() && S.metres >= per) { const m = Math.floor(S.metres / per); S.metres -= m * per; G.advance(m); if (onClock) onClock(); }
    return true;
  }
  function step(dt) {
    const pos = lambAt(); S.moving = false; S.vel = [0, 0];
    if (pos && freeWalk(dt, pos)) return;
    // standing still in a body's margin (a walk ended against a prop, a spawn beside one): step out to
    // the nearest clear floor within 0.6 m, so where Lamb ends never depends on how the walk went
    if (!S.path && pos && idle() && !S.settled) { const A = cam.arena(), k = A && spotKind(A, pos); if (k === "margin" || k === "prop" || k === "top" || (A && propDistance(A, pos[0], pos[2]) < 0.3)) { const c = settleSpot(A, pos); if (c) { S.path = [[c[0], c[2]]]; S.settling = true; } } S.settled = true; }
    if (S.path && !S.settling) S.settled = false;
    if (!S.path || !pos) return;
    S.run = !!(G.input && G.input.get("run")) && performance.now() >= S.runLock;
    // a walk to a spot eases up to speed and slows into its last stride (the stop no faster than WALK_EASE.down
    // allows: never above the speed from which that deceleration stops at the end of the path)
    const top = (S.run ? rule("run-speed", 3.6) : rule("walk-speed", 1.5)) * gait();
    let left = 0; { let q = pos; for (const w of S.path) { left += Math.hypot(w[0] - q[0], w[1] - (q.length > 2 ? q[2] : q[1])); q = w; } }
    const want = Math.min(top, Math.sqrt(2 * (top / WALK_EASE.down) * left) + 0.15);
    const A = cam.arena(), sp = easeSpeed(want, top, dt) * dt;
    const [tx, tz] = S.path[0], dx = tx - pos[0], dz = tz - pos[2], d = Math.hypot(dx, dz);
    const k = d <= sp ? 1 : sp / d, nx = pos[0] + dx * k, nz = pos[2] + dz * k, y = A ? groundAt(A, nx, nz) : null;
    if (d > 1e-4) S.face.lamb = Math.atan2(dz, dx);
    if (crowded("lamb", pos, nx, nz, S.settling ? 0.6 : SEP)) { S.blocked = (S.blocked || 0) + dt; /* stepping off a prop may pass closer (0.6 m) than walking does */ if (S.blocked > 1.2) { const wasSettle = S.settling; S.blocked = 0; S.path = null; S.settling = false; if (wasSettle) { S.settled = true; return; } S.settled = false; const then = S.then; S.then = null; if (then) then(); } return; } // someone stands in the way: wait, then stop short (the settle rule then steps off any prop)
    S.blocked = 0;
    G.state.pos = [nx, y ?? pos[1], nz]; S.metres += Math.min(d, sp); S.moving = d > 1e-4; S.vel = d > 1e-4 ? [(dx / d) * Math.min(d, sp) / dt, (dz / d) * Math.min(d, sp) / dt] : [0, 0];
    if (d <= sp) S.path.shift();
    if (!S.path.length) {
      S.path = null; S.moving = false; S.settling = false; S.spd = 0;
      const per = rule("walk-metres-per-minute", 6), m = Math.floor(S.metres / per);
      if (m > 0 && !live()) { S.metres -= m * per; G.advance(m); } else if (live()) S.metres = 0;
      const then = S.then; S.then = null; if (then) then();
    }
  }
  // Bodies keep apart (0.95 m centre to centre): a step that brings `who` nearer than that to
  // anyone else is refused; a step away is always allowed, so nobody sticks.
  const SEP = 0.95; // flared coats: at 0.8 m two coats come within 0.12 m along the view ray (visual-check silhouettes, character lead's solo depths)
  // A seated body reaches its knees and feet about 0.8 m forward of the chair (character lead): its
  // keep-out is the segment from the seat to 0.8 m along its facing, not only the seat.
  const SEAT_REACH = 0.8;
  function bodyDist(o, x, z) {
    if (o.pose !== "seated") return Math.hypot(x - o.at[0], z - o.at[2]);
    const dx = Math.cos(o.face || 0) * SEAT_REACH, dz = Math.sin(o.face || 0) * SEAT_REACH;
    const t = Math.max(0, Math.min(1, ((x - o.at[0]) * dx + (z - o.at[2]) * dz) / (SEAT_REACH * SEAT_REACH)));
    return Math.hypot(x - (o.at[0] + dx * t), z - (o.at[2] + dz * t));
  }
  function crowded(who, from, nx, nz, sep = SEP) {
    for (const o of figures(true)) {
      if (o.who === who) continue;
      const d1 = bodyDist(o, nx, nz); if (d1 >= sep) continue;
      if (d1 < bodyDist(o, from[0], from[2])) return true;
    }
    return false;
  }
  // A figure's spot: where a fight left it, else its authored spot moved clear of props (a figure
  // never stands in a bench; the list of moved spots is tools/visual-check.mjs --marks).
  const homes = new Map();
  // A seated figure sits on the seat the plate shows near its mark (world/plateworld.mjs seatOf), facing
  // the way the chair faces; with no seat found, on its mark as written.
  const seats = new Map();
  function seatedAt(f) {
    const pj = cam.place(), geo = cam.geo(); if (!pj || !geo) return f.at;
    const k = `${pj.place}|${f.id}|${f.at.join(",")}`;
    if (!seats.has(k)) seats.set(k, seatOf(pj, geo.pos, f.at));
    const s = seats.get(k); if (!s) return f.at;
    if (s.face != null) S.face[f.id] = s.face;
    S.seatY[f.id] = s.seatY;
    return s.at;
  }
  function homeOf(f) {
    if (G.figureMoved && G.figureMoved[f.id]) return G.figureMoved[f.id];
    const A = cam.arena(), key = `${(cam.area() || {}).id}|${f.id}|${f.at.join(",")}`;
    if (!A) return f.at;
    if (!homes.has(key)) {
      let at = spotKind(A, f.at) === "void" ? f.at : f.pose === "seated" ? seatedAt(f) : clearSpot(A, f.at); // a seated figure sits on its chair's seat // behind a counter stays; in or on a prop moves
      // and never on top of someone already placed: the nearest clear spot SEP from every other home
      const taken = [...homes.values(), ...(lambAt() ? [lambAt()] : [])], near = (p) => taken.some((o) => Math.hypot(p[0] - o[0], p[2] - o[2]) < SEP);
      if (near(at)) for (let rad = 0.25; rad <= 1.5 && near(at); rad += 0.25) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, p = [at[0] + Math.cos(a) * rad, at[1], at[2] + Math.sin(a) * rad]; if (spotKind(A, p) === "clear" && !near(p)) { at = [p[0], groundAt(A, p[0], p[2]) ?? at[1], p[2]]; break; } }
      homes.set(key, at);
    }
    return homes.get(key);
  }
  // the nearest clear floor within 1.5 m that no one else stands too near (for stepping out of a margin)
  function settleSpot(A, pos) {
    const c = A.cell, q0 = Math.floor((pos[0] - A.origin[0]) / c), r0 = Math.floor((pos[2] - A.origin[1]) / c), R = Math.ceil(1.5 / c), cand = [];
    for (let dr = -R; dr <= R; dr++) for (let dq = -R; dq <= R; dq++) { const x = A.origin[0] + (q0 + dq + 0.5) * c, z = A.origin[1] + (r0 + dr + 0.5) * c, d = Math.hypot(x - pos[0], z - pos[2]); if (d <= 1.5 && spotKind(A, [x, 0, z]) === "clear" && propDistance(A, x, z) >= 0.3) cand.push([d, x, z]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, x, z] of cand) if (!crowded("lamb", pos, x, z)) return [x, groundAt(A, x, z) ?? pos[1], z];
    return null;
  }
  // what the body carries slows the walk (world/burden.mjs): never counted, only felt in the legs
  function gait() { return G.burden ? G.burden.gait() : 1; }
  // an echo's person <char> <posture> holds while the echo holds at this place (read twice a second, not per frame)
  let poseAt = 0, poses = new Map();
  function echoPose(who) {
    const now = performance.now();
    if (now - poseAt > 500) { poseAt = now; poses = new Map(G.echo ? G.echo.shows().filter((x) => x.kind === "person").map((x) => [x.id, { name: x.arg }]) : []); }
    return poses.get(who) || null;
  }
  function figures(all = false) {
    const out = [], a = lambAt(), gone = new Set(G.echo ? G.echo.absent() : []); // an echo's absent <char>: the one who no longer comes (world/echo.mjs)
    if (a) out.push({ who: "lamb", at: a, face: S.face.lamb ?? 0, walking: S.moving, running: S.moving && S.run });
    for (const f of G.world.figures()) { if (gone.has(f.id) || (f.char && gone.has(f.char))) continue; const w = S.wander[f.id]; out.push({ who: f.id, at: (w && w.at) || homeOf(f), face: S.face[f.id] ?? (+f.face < 0 ? Math.PI : 0), walking: !!(w && w.moving), pose: f.pose || null, seat: f.seat || null, mark: f.at }); }
    return all ? out : out.filter((f) => !S.hidden.has(f.who));
  }
  function gestureOf(who, dt) {
    const gs = S.gesture[who];
    if (gs) { gs.t += dt; if (gs.t < GESTURE_S) return gs; delete S.gesture[who]; }
    if (S.talking && (who === "lamb" || who === S.talking) && Math.random() < dt / 4) return (S.gesture[who] = { anim: TALK[Math.floor(Math.random() * TALK.length)], t: 0 });
    return null;
  }
  // One figure alone into a canvas the size of the layer (tools/visual-check.mjs reads silhouettes).
  function drawSolo(who) {
    const cv = document.createElement("canvas"); cv.width = canvas.width; cv.height = canvas.height;
    const f = figures(true).find((x) => x.who === who); if (!f || !cam.ready()) return cv;
    const pj = cam.place(), variant = (cam.area() && cam.area().variant) || (pj && pj.variants && pj.variants[0]), lights = [...((pj && pj.lights && pj.lights[variant]) || []), ...((pj && pj.figureLights && pj.figureLights[variant]) || [])], s = cam.toScreen(f.at);
    if (s) personDrawer()(cv.getContext("2d"), f, { x: s[0], y: s[1], ppm: cam.scaleAt(f.at), at: f.at, face: f.face, walking: f.walking, running: !!f.running, talking: false, gesture: null, cam: pj && pj.camera, plate: pj && pj.place, depth: cam.depthOf(f.at), depthAt: cam.depthAt, lights, darkness: cam.darkness(), pose: f.pose || null, seatY: f.pose === "seated" ? S.seatY[f.who] ?? null : null, reach: reachOf(f), room: roomOf(f), solo: true });
    return cv;
  }
  // How far a held tool may reach ahead: clear of props and walls (clearAhead) and short of anyone
  // standing in front within 0.4 m of the tool's line (0.35 m before their body)
  // the room either side as well (a pole held across the body): metres to the nearest prop or person on the left and right
  function roomOf(f) {
    const A = cam.arena(), face = f.face || 0, side = (a) => { let r = A ? clearAhead(A, f.at, a) : 2.2; const dx = Math.cos(a), dz = Math.sin(a); for (const o of figures(true)) { if (o.who === f.who) continue; const ox = o.at[0] - f.at[0], oz = o.at[2] - f.at[2], ahead = ox * dx + oz * dz, lat = Math.abs(ox * -dz + oz * dx); if (ahead > 0 && lat < 0.4) r = Math.min(r, Math.max(0.1, ahead - 0.35)); } return +r.toFixed(2); };
    // blocked(x, z): ground a prop stands on (a bench, a counter), for the shaft's own samples in every direction
    return { ahead: reachOf(f), left: side(face + Math.PI / 2), right: side(face - Math.PI / 2), behind: side(face + Math.PI), blocked: A ? (x, z) => groundAt(A, x, z) == null : null, arena: A || null };   // arena: the figure tool worker reads blocked from its cells (characters/runtime/fightdrawer.mjs cropBlocked)   // behind: a pole trailed back into a bench (brine-bar still, 2026-10-21)
  }
  function reachOf(f) {
    let r = cam.arena() ? clearAhead(cam.arena(), f.at, f.face) : 2.2;
    const dx = Math.cos(f.face || 0), dz = Math.sin(f.face || 0);
    for (const o of figures(true)) { if (o.who === f.who) continue; const ox = o.at[0] - f.at[0], oz = o.at[2] - f.at[2], ahead = ox * dx + oz * dz, side = Math.abs(ox * -dz + oz * dx); if (ahead > 0 && side < 0.4) r = Math.min(r, Math.max(0.2, ahead - 0.35)); }
    return +r.toFixed(2);
  }
  function draw(dt) {
    const r = host.getBoundingClientRect(); if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
    const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
    if (!cam.ready()) return;
    const pj = cam.place(), variant = (cam.area() && cam.area().variant) || (pj && pj.variants && pj.variants[0]), lights = [...((pj && pj.lights && pj.lights[variant]) || []), ...((pj && pj.figureLights && pj.figureLights[variant]) || []), ...(globalThis.__lwCarriedLights || [])];   // figureLights: the room's key on the figures only (render/bake2.mjs)   // carried lights (game/engine/paint/lightlayer.mjs: Lamb's lantern)
    { const fv = cam.frameNow && cam.frameNow(); if (fv) canvas.dataset.view = `${fv.left},${fv.top},${fv.zoom}`; }   // the camera these figures were drawn with (tools/visualcheck reads it)
    // the crowd tier (characters/runtime/crowd.mjs, P.crowd(c)): its cards sorted in with the full figures
    const list = figures().map((f) => ({ f, depth: cam.depthOf(f.at) }));
    // with the plate's depth planes (ui/platecam.mjs planes, ?planes=0 to leave them out) the far tier's cards are
    // drawn into their own canvas, far to near, and each band of the plate's occluders erases itself from the
    // cards deeper than it (clipped to their rectangles): what shows through is the plate as drawn, its light and
    // weather included. The cards go under the full figures (the near tier); without planes they sort in with them.
    let crowdT = 0;
    if (S.crowd) {
      const t0 = performance.now(), P = !/[?&]planes=0(&|$)/.test(location.search) && cam.planes ? cam.planes() : null, view = cam.frameNow && cam.frameNow(), cards = S.crowd.items(cam, { cull: !P });
      if (P && view) {
        const cc = (S.crowdCv ||= document.createElement("canvas")); if (cc.width !== canvas.width || cc.height !== canvas.height) { cc.width = canvas.width; cc.height = canvas.height; }
        const gc = cc.getContext("2d"), z = view.zoom, seq = [...cards];
        gc.clearRect(0, 0, cc.width, cc.height);
        for (const b of P) { const bx = (b.x0 - view.left) * z, by = (b.y0 - view.top) * z; if (bx > cc.width || by > cc.height || bx + b.w * z < 0 || by + b.h * z < 0) continue; seq.push({ depth: (b.d0 + b.d1) / 2, band: b, bx, by, bw: b.w * z, bh: b.h * z }); }
        seq.sort((a, b) => b.depth - a.depth);
        // which 64 px cells hold a card so far: a band's tile erases only where it meets one (no clip needed:
        // erasing touches only the cards already drawn, all deeper than the band)
        const C = 64, cw = Math.ceil(cc.width / C), ch = Math.ceil(cc.height / C), occ = (S.crowdOcc && S.crowdOcc.length === cw * ch ? S.crowdOcc : (S.crowdOcc = new Uint8Array(cw * ch))); occ.fill(0);
        const cells = (x, y, w, h, fn) => { const a = Math.max(0, Math.floor(x / C)), b = Math.min(cw - 1, Math.floor((x + w) / C)), c = Math.max(0, Math.floor(y / C)), d = Math.min(ch - 1, Math.floor((y + h) / C)); for (let r = c; r <= d; r++) for (let q = a; q <= b; q++) if (fn(r * cw + q)) return true; return false; };
        gc.globalCompositeOperation = "source-over";
        for (const it of seq) {
          if (!it.band) { it.draw(gc); const R = it.rect; cells(R[0], R[1], R[2], R[3], (k) => { occ[k] = 1; }); continue; }
          let on = false;
          for (const t of it.band.tiles) { const tx = (t.x0 - view.left) * z, ty = (t.y0 - view.top) * z, tw = t.w * z, th = t.h * z; if (tx > cc.width || ty > cc.height || tx + tw < 0 || ty + th < 0 || !cells(tx, ty, tw, th, (k) => occ[k] === 1)) continue;
            if (!on) { gc.globalCompositeOperation = "destination-out"; on = true; } gc.drawImage(t.img, tx, ty, tw, th); }
          if (on) gc.globalCompositeOperation = "source-over";
        }
        g.drawImage(cc, 0, 0);
      } else list.push(...cards);
      crowdT = performance.now() - t0;
    }
    list.sort((a, b) => b.depth - a.depth);
    for (const it of list) {
      if (it.draw) { const t1 = performance.now(); it.draw(g); crowdT += performance.now() - t1; continue; }
      const { f, depth } = it;
      const s = cam.toScreen(f.at); if (!s) continue;
      const talking = !!S.talking && (f.who === "lamb" || f.who === S.talking);
      // a held posture (world/senses.mjs: a cue's anim, an echo's person, the burden's bent back) bends the figure about its feet
      const ps = (G.senses && (G.senses.posture(f.who) || (f.who === "lamb" && G.senses.posture("player")))) || echoPose(f.who), pt = ps && postureTransform(ps.name, performance.now());
      if (pt) { g.save(); g.translate(s[0], s[1]); g.transform(...pt.m); g.translate(-s[0], -s[1]); }
      personDrawer()(g, f, { x: s[0], y: s[1], ppm: cam.scaleAt(f.at), at: f.at, face: f.face, walking: f.walking, running: !!f.running, talking, gesture: f.walking ? null : gestureOf(f.who, dt), cam: pj && pj.camera, plate: pj && pj.place, depth, depthAt: cam.depthAt, lights, darkness: cam.darkness(), pose: f.pose || null, seatY: f.pose === "seated" ? S.seatY[f.who] ?? null : null, reach: reachOf(f), room: roomOf(f) });
      if (pt) g.restore();
    }
    if (S.crowd && globalThis.__lwPerf) { const e = (globalThis.__lwPerf.crowd ||= { ms: 0, n: 0 }); e.ms += crowdT; e.n++; }   // read by tools/bench.mjs
  }
  // Passers-by: a figure with wander: r walks between points within r of its spot, stopping a
  // while at each, and stands still while it is the one Lamb is talking to. Live spots go to
  // G.figureAt for the fight's placement and for facing.
  function wanderStep(dt) {
    const A = cam.arena(), spots = (G.figureAt ||= {});
    if (!A) return; // the ground is not loaded yet: nobody starts walking from an authored spot inside a prop
    for (const f of G.world.figures()) {
      if (!f.wander) { delete S.wander[f.id]; spots[f.id] = homeOf(f); continue; } // a standing figure: on its clear spot
      const w = (S.wander[f.id] ||= { at: [...homeOf(f)], to: null, wait: 1 + (f.id.length % 3), moving: false });
      w.moving = false;
      if (S.talking === f.id || S.hidden.has(f.id)) { spots[f.id] = w.at; continue; }
      if (!w.to) { w.wait -= dt; if (w.wait <= 0) { const a = Math.random() * Math.PI * 2, r = f.wander * Math.sqrt(Math.random()), t = [f.at[0] + Math.cos(a) * r, f.at[2] + Math.sin(a) * r]; const tt = A ? clearSpot(A, [t[0], 0, t[1]], 0.6, { strict: true }) : null; if (!A) w.to = t; else if (tt) { const way = findPathVG(A, [w.at[0], w.at[2]], [tt[0], tt[2]], { waterY: waterY(A) }); if (way && way.length) { w.way = way.slice(1); w.to = way[0]; } else w.wait = 0.5; } else w.wait = 0.5; } } // wanderers only head for clear floor, round what is in the way
      else {
        const dx = w.to[0] - w.at[0], dz = w.to[1] - w.at[2], d = Math.hypot(dx, dz), sp = 1.1 * dt;
        if (d <= sp) { w.at = [w.to[0], A ? groundAt(A, w.to[0], w.to[1]) ?? w.at[1] : w.at[1], w.to[1]]; if (w.way && w.way.length) w.to = w.way.shift(); else { w.to = null; w.way = null; w.wait = 2 + Math.random() * 4; } }
        else { const nx = w.at[0] + (dx / d) * sp, nz = w.at[2] + (dz / d) * sp, y = A ? groundAt(A, nx, nz) : null; if ((A && (y == null || !bodyCan(A, [w.at[0], w.at[2]], nx, nz))) || crowded(f.id, w.at, nx, nz)) { w.to = null; w.way = null; w.wait = 1; } else { w.at = [nx, y ?? w.at[1], nz]; w.moving = true; S.face[f.id] = Math.atan2(dz, dx); } }
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
    if (S.crowd) { const A = cam.arena(); S.crowd.step(Math.min(dt, 0.1), A ? (x, z) => walkable(A, x, z) : null); }
    draw(dt);
    if (debugOn("nav")) { (S.nav ||= navDebug(host, cam, () => ({ lamb: lambAt(), path: S.path, wander: S.wander }))).draw(); } else if (S.nav) { S.nav.remove(); S.nav = null; }
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
    walkTo, figures, step, draw, drawSolo,
    walking: () => !!S.path,
    // Lamb faces the speaker; the speaker faces Lamb
    talkingWith(who) {
      S.talking = who || null; S.gesture = {};
      const f = who && G.world.figures().find((x) => x.id === who), a = lambAt(), fa = f && ((G.figureAt && G.figureAt[f.id]) || f.at);
      if (fa && a) { S.face.lamb = Math.atan2(fa[2] - a[2], fa[0] - a[0]); S.face[who] = Math.atan2(a[2] - fa[2], a[0] - fa[0]); }
    },
    get talkingWithWho() { return S.talking; },
    facing: () => S.face.lamb ?? 0,
    velocity: () => S.vel || [0, 0],
    // a figure stands somewhere new (where a fight left it); a wanderer walks on from there
    moveFigure(who, at) { (G.figureMoved ||= {})[who] = at; if (S.wander[who]) { S.wander[who].at = [...at]; S.wander[who].to = null; } },
    // after a conversation: the run button does nothing for a moment (LIVE-CONVERSATION A3: 0.5 s)
    lockRun(ms = 500) { S.runLock = performance.now() + ms; },
    hide(ids) { S.hidden = new Set(ids || []); },
    crowd(c) { S.crowd = c || null; },   // the wide lens's crowd tier (characters/runtime/crowd.mjs), or null
    stop() { S.stopped = true; cancelAnimationFrame(S.raf); host.removeEventListener("click", onClick); canvas.remove(); },
    canvas,
  };
}
