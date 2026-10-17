// The character pipeline's figures for the engine's in-world fights (game/engine/ui/fightlayer.mjs
// setFigureDrawer). One actor per fighter, driven by combat's own pose each frame (combat/anim/
// drive.mjs poseOf, warped against our clip table), drawn at the plate camera's scale with the same
// mesh, shading and light as exploring and talking.
//   const draw = await makeFightDrawer({ poseOf, camera: { yawDeg, elevDeg }, rig, tone });
//   setFigureDrawer(draw);
// fn(g, F, { x, y, ppm, face, down, W }): (x, y) the feet on screen, ppm the screen height of one
// vertical metre there (the plate camera's scaleAt), F combat's fighter, W combat's world.
import { createCast } from "./actor.mjs";
import { RIGS } from "../render/rigs.mjs";
import { MATS } from "../rig/materials.mjs";
import * as lamb from "../cast/lamb.mjs";
import * as fennick from "../cast/fennick.mjs";
import * as marrow from "../cast/marrow.mjs";
import * as warden from "../cast/warden.mjs";
import * as salvor from "../cast/salvor.mjs";
import * as keel from "../cast/keel.mjs";
import * as sabine from "../cast/sabine.mjs";
import * as wenna from "../cast/wenna.mjs";
import * as merrow from "../cast/merrow.mjs";
import { GORM, HOBB, FEWELL, STRAND, BRIGHT, COE } from "../cast/lamplighter.mjs";
import * as FOLK from "../cast/folk.mjs";
import { plateCtx } from "./platectx.mjs";
import { exposure } from "./expose.mjs";
import { queueShadow } from "./groundshadow.mjs";
import { STAND } from "../anim/stances.mjs";
import { INDEX } from "../rig/skeleton.mjs";
const CAST = { lamb, fennick, marrow, warden, salvor, keel, sabine, wenna, merrow, gorm: GORM, hobb: HOBB, fewell: FEWELL, strand: STRAND, bright: BRIGHT, coe: COE, ...Object.fromEntries(Object.entries(FOLK).map(([k, m]) => [k.toLowerCase(), m])) };

const MEMBERS = CAST;
// every figure id with cast data, read by game/engine/tools/cast.mjs (the validator flags any other id)
export const CAST_IDS = Object.keys(CAST);
// combat's actor ids (lamb, an @foe char, else an archetype) to the art's bodies
const BODY = { lamb: "lamb", holder: "warden", skirmisher: "salvor", fennick: "fennick", marrow: "marrow", keel: "keel", merrow: "merrow", lamplighter: "fewell", gorm: "gorm", hobb: "hobb", fewell: "fewell", strand: "strand", bright: "bright", coe: "coe" };

// Until the drawer is told each fighter's world point (asked in NOTES, A4), the lamps cannot be
// placed, so fights use an even sodium light from above with a lamp rim: every fighter reads.
const FIGHT_RIG = { amb: [0.09, 0.07, 0.13], ground: [0.03, 0.025, 0.04], key: { dir: [-0.35, 0.85, 0.4], c: [0.95, 0.6, 0.26], wrap: 0.35 }, fill: { dir: [0.5, 0.3, -0.6], c: [0.2, 0.12, 0.06], wrap: 0.5 }, fresnel: { c: [0.34, 0.2, 0.08], pow: 3 } };
export async function makeFightDrawer({ poseOf, actorOf = null, camera = { yawDeg: 26, elevDeg: 30 }, rig = FIGHT_RIG, tone = RIGS.quay.tone, base = "/characters/", combatUrl = "/engine/combat/out/timing.combat.json", ss = 1 } = {}) {
  const timing = await (await fetch(base + "anim/timing.json")).json();
  let combat = null; try { const r = await fetch(combatUrl); if (r.ok) combat = await r.json(); } catch (e) { console.warn("fight figures: combat timing not loaded:", e.message); }
  const cast = createCast({ timing, combat, members: MEMBERS }), actors = new Map(), tables = {};
  const clipsFor = (who) => tables[who] || (tables[who] = cast.clips(who));
  const cosE = Math.cos((camera.elevDeg * Math.PI) / 180);

  // the body for a figure: combat's archetypes map through BODY, any cast member by its own id, a foe
  // with no body of its own takes its archetype's (warden, or salvor for a skirmisher); a scene person
  // whose id has no cast data (a content typo) gets null, and the drawer draws a neutral placeholder
  const unknown = new Set();
  function bodyOf(W, F) {
    const d = (W.defs && W.defs[F.id]) || {}, id = actorOf ? actorOf(W, F) : (F.team === "lamb" ? "lamb" : d.char || d.style || d.kind);
    if (BODY[id]) return BODY[id];
    if (id && MEMBERS[id]) return id;
    if (F.team === "lamb") return "lamb";
    if (!F.person) return d.style === "skirmisher" ? "salvor" : "warden";
    if (!unknown.has(id)) { unknown.add(id); console.warn(`fight figures: no cast data for figure "${id}"; drawing a neutral placeholder`); }
    return null;
  }
  function toolOfDef(W, F, who) {
    const d = (W.defs && W.defs[F.id]) || {}, t = d.tool || d.weapon || null;
    return t ? String(t).replace(/^w\./, "") : MEMBERS[who].info.tool;
  }

  // The plate's own lights at the figure's position (place.json lights: at, kind, I, reach), dimmed as
  // the plate goes to its blackout; a cool sky rim always, so a figure reads against dark ground.
  const KIND = { sodium: [1.0, 0.62, 0.26], paraffin: [1.0, 0.76, 0.46], window: [1.0, 0.76, 0.46], white: [0.9, 0.95, 1.0], arc: [0.9, 0.95, 1.0], beam: [0.95, 0.97, 1.0], lantern: [1.0, 0.8, 0.5] };
  // the night's blue fill; while the lamps burn, half of it is turned to the ruling lamp's colour (a
  // figure lifted in shadow read as a flat blue-grey); the blackout keeps the full blue
  const AMB_LIT = [0.09, 0.08, 0.13], AMB_DARK = [0.13, 0.12, 0.19];
  function rigAt(at, lights, darkness = 0) {
    if (!at || !lights || !lights.length) return { rig, tone };
    const near = lights.map((L) => ({ L, d: Math.hypot(L.at[0] - at[0], L.at[2] - at[2]) })).filter((q) => q.d < (q.L.reach || 6) * 1.6).sort((a, b) => a.d - b.d).slice(0, 4);
    const lit = 1 - darkness, lamps = near.map(({ L }) => ({ pos: L.at, c: KIND[L.kind] || KIND.paraffin, power: 0, d: Math.hypot(L.at[0] - at[0], L.at[1] - 1 - at[1], L.at[2] - at[2]), I: L.I || 1, kind: L.kind }));
    // Each lamp's share of the light at the chest, I (1 - d / reach)^2 (the plate's own falloff), scaled so
    // the sum reaches the chest at a moderate 0.7: the renderer then never saturates, and the drawer
    // sets the figure's absolute exposure from the painting around it (exposeToPlate below). A lamp
    // closer than 1.4 m is moved back along its own direction, so the body's near side does not take
    // an inverse-square spike the painting never shows.
    let Etot = 0;
    for (const q of lamps) { const reach = near.find((n) => n.L.at === q.pos).L.reach || 6, f = Math.max(0, 1 - q.d / reach); q.e = q.I * f * f; q.f2 = f * f; Etot += q.e; }
    const norm = Etot > 0 ? 0.7 / Etot : 0;
    for (const q of lamps) {
      const dx = q.pos[0] - at[0], dy = q.pos[1] - (at[1] + 1), dz = q.pos[2] - at[2], dl = Math.hypot(dx, dy, dz) || 1, D = Math.max(1.4, dl);
      q.pos = [at[0] + (dx / dl) * D, at[1] + 1 + (dy / dl) * D, at[2] + (dz / dl) * D];
      q.power = q.e * norm * (D * D + 0.3) * lit;
    }
    const share = lamps.reduce((acc, q) => { const e = q.I / (q.d * q.d + 1); acc[q.kind === "sodium" ? 0 : 1] += e; return acc; }, [0, 0]);
    const sod = share[0] > share[1] && lit > 0.3;
    return {
      tone: sod ? tone : null,
      rig: { amb: AMB_LIT.map((v, k) => AMB_DARK[k] * darkness + (v * 0.45 + (near.length ? (KIND[near[0].L.kind] || KIND.paraffin)[k] * 0.06 : v * 0.55)) * (1 - darkness)), ground: [0.025, 0.02, 0.035], key: { dir: [-0.3, 0.8, 0.5], c: [0.05, 0.05, 0.08], wrap: 0.3 }, lamps,
        fresnel: { c: near.length && lit > 0.3 ? (KIND[near[0].L.kind] || KIND.paraffin).map((v) => v * 0.5) : [0.2, 0.24, 0.34], pow: 2.2 } },
    };
  }
  const D2R = Math.PI / 180, fwdOf = (cam) => { const y = cam.yawDeg * D2R, e = cam.elevDeg * D2R; return [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)]; };
  // Silhouette treatment, chosen by testing at 1080p gameplay zoom (characters/PROGRESS.md step 55);
  // globalThis.__lwFigureLook overrides it for tests: any of lift, outline, shadow, pool, comma-separated.
  const LIFT_IDS = new Set(["skin", "cheek", "jawcool", "lip"].map((n) => MATS[n].id));
  const LOOK_DEFAULT = "lift,outline";   // the test: outline read best on dark ground, lift added faces and hands; shadow and pool vanished on dark ground
  const LIFT = 1.6, OCC_BIAS = 0.14, EXPOSE_MODE = "both", LIT_X = 3, SURROUND_X = 2.5;   // the lit third counts up to 3x the ground's median (Merrow beside the fire pool read 2.2x his surroundings)   // face lift in linear light; occlusion slack in metres
  // A held staff or pole kept inside the room around the figure (args.room: metres to the nearest prop
  // or person ahead, left and right, from the engine; args.reach alone means ahead only). Both ends of
  // the shaft are tested, and neither may go under the floor; the whole shaft keeps BODY_R off every
  // other body this drawer drew in the last frames (the room is measured at the feet, a pole is not). When one breaks a limit, the wrist turns
  // (bend in 10 and side in 15 degree steps to 60, both arms drawn in by 0, 15 or 30 when the wrist alone cannot; the smallest change first) to the nearest pose that
  // fits; the angle eases over a few frames so the tool never snaps, and a pose that still fits is kept.
  const BODY_R = 0.5, BODY_TOP = 2.1,   // a standing body with its arms, coat and hat brim (0.36 and 0.45 let a pole and an arm graze a hat and a coat: PROGRESS 62)
    TOOL_EASE = 0.25, TOOL_STEP = 64, TOOL_TRY = (() => { const o = []; for (const arm of [0, -15, -30]) for (let b = -60; b <= 60; b += 10) for (let sd = -60; sd <= 60; sd += 15) o.push([b, sd, arm]); return o.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) + 1.5 * Math.abs(p[2]) - Math.abs(q[0]) - Math.abs(q[1]) - 1.5 * Math.abs(q[2])); })();
  function keepToolClear(a, room, face = null) {
    const st = (a.clear ||= { b: 0, s: 0, tb: 0, ts: 0 });
    const R = room == null ? null : typeof room === "number" ? { ahead: room, left: 9, right: 9 } : room;
    const fa = face ?? ((90 - a.facing) * Math.PI) / 180, fx = Math.cos(fa), fz = Math.sin(fa);
    const now = performance.now(), near = [...actors.values()].filter((o) => o !== a && now - (o.seen || -1e9) < 120 && Math.hypot(o.pos[0] - a.pos[0], o.pos[2] - a.pos[2]) < 2.6);
    const excess = () => {   // metres by which the shaft's ends break the limits (0: it fits)
      const w = a.weapon && a.weapon(); if (!w) return 0; let x = 0;
      for (const e of [w.tip, w.butt]) {
        if (!e) continue;
        const dx = e[0] - a.pos[0], dz = e[2] - a.pos[2], ahead = dx * fx + dz * fz, left = -dx * fz + dz * fx;
        x += Math.max(0, 0.05 - (e[1] - a.pos[1]));
        if (R) x += Math.max(0, ahead - R.ahead) + Math.max(0, left - R.left) + Math.max(0, -left - R.right);
      }
      // and the whole shaft clear of every other body drawn this frame (a standing capsule BODY_R round, to BODY_TOP with the hat)
      if (near.length) {   // the hands and forearms that hold it, too (a two-handed grip reaches across)
        const S = a.skeleton();
        for (const sd of ["L", "R"]) {   // each forearm, elbow to hand, sampled
          const e = a.toWorld(S[INDEX["fore" + sd]].p), h = a.toWorld(S[INDEX["hand" + sd]].p);
          for (let i = 0; i <= 4; i++) { const t = i / 4, q = [e[0] + (h[0] - e[0]) * t, e[1] + (h[1] - e[1]) * t, e[2] + (h[2] - e[2]) * t];
            for (const o of near) { const qy = q[1] - o.pos[1]; if (qy >= 0 && qy <= BODY_TOP) x += Math.max(0, BODY_R - Math.hypot(q[0] - o.pos[0], q[2] - o.pos[2])) / 5; } }
        }
      }
      if (w.butt) for (const o of near) for (let i = 0; i <= 8; i++) {
        const t = i / 8, px = w.butt[0] + (w.tip[0] - w.butt[0]) * t, py = w.butt[1] + (w.tip[1] - w.butt[1]) * t - o.pos[1], pz = w.butt[2] + (w.tip[2] - w.butt[2]) * t;
        if (py < 0 || py > BODY_TOP) continue; x += Math.max(0, BODY_R - Math.hypot(px - o.pos[0], pz - o.pos[2])) / 8;
      }
      return x;
    }, fits = () => excess() < 1e-3;
    a.adjust(null, "tool");
    const w = a.weapon && a.weapon(), long = w && Math.hypot(w.tip[0] - w.grip[0], w.tip[1] - w.grip[1], w.tip[2] - w.grip[2]) > 0.8;
    const set = (b, sd, o) => a.adjust({ handR: { bend: b, side: sd }, armR: { out: o }, armL: { out: o } }, "tool");
    if (!long || fits()) { st.tb = 0; st.ts = 0; st.to = 0; st.search = null; }
    else {
      set(st.tb, st.ts, st.to || 0);
      if (!(st.tb || st.ts || st.to) || !fits()) {
        // the first pose that fits, else the one that breaks the limits least; searched TOOL_STEP candidates a
        // frame (each costs a skeleton solve), so a limit tripping never stalls a frame
        const q = (st.search ||= { i: 0, best: [0, 0, 0], low: (set(0, 0, 0), excess()) });
        for (let n = 0; n < TOOL_STEP && q.i < TOOL_TRY.length; n++, q.i++) {
          const [b, sd, o] = TOOL_TRY[q.i]; if (!b && !sd && !o) continue; set(b, sd, o); const x = excess();
          if (x < q.low - 0.02) { q.low = x; q.best = [b, sd, o]; } if (x < 1e-3) { q.i = TOOL_TRY.length; break; }
        }
        if (q.i >= TOOL_TRY.length) { [st.tb, st.ts, st.to] = q.best; st.search = null; }
      } else st.search = null;
    }
    st.b += (st.tb - st.b) * TOOL_EASE; st.s += (st.ts - st.s) * TOOL_EASE; st.o = (st.o || 0) + ((st.to || 0) - (st.o || 0)) * TOOL_EASE;
    a.adjust(Math.abs(st.b) + Math.abs(st.s) + Math.abs(st.o) > 0.5 ? { handR: { bend: st.b, side: st.s }, armR: { out: st.o }, armL: { out: st.o } } : null, "tool");
    return Math.hypot(st.b, st.s);
  }
  drawFighter.keepToolClear = keepToolClear;
  // Hips fitted to a seat (args.seatY, the seat's top above the floor, from the plate): the root is
  // raised or lowered so the pelvis sits SEAT_PELVIS above the seat, and the thighs tilt (the shins
  // with them, so they stay upright) until the ankles stand at their standing height, soles on the floor.
  const SEAT_PELVIS = 0.09;
  function fitSeat(a, seatY) {
    if (seatY == null) { a.adjust(null, "seat"); a.seatFit = null; return null; }
    const settled = a.state && a.state.clip === "sit" && !(a.state.fade > 0);
    if (a.seatFit && a.seatFit.y === seatY && a.seatFit.settled) return a.seatFit;
    a.adjust(null, "seat");
    const S0 = a.skeleton(), st = a.skeleton(STAND), h0 = (st[INDEX.footL].p[1] + st[INDEX.footR].p[1]) / 2;
    const dy = seatY + SEAT_PELVIS - S0[INDEX.pelvis].p[1];
    const ankle = (da) => { a.adjust({ root: { y: dy }, thighL: { fwd: -da }, thighR: { fwd: -da }, shinL: { bend: -da }, shinR: { bend: -da } }, "seat"); const S = a.skeleton(); return (S[INDEX.footL].p[1] + S[INDEX.footR].p[1]) / 2; };
    let da = 0;
    for (let i = 0; i < 6; i++) { const f0 = ankle(da) - h0, f1 = ankle(da + 1) - h0, d = f1 - f0; if (Math.abs(f0) < 0.003 || Math.abs(d) < 1e-5) break; da = Math.max(-35, Math.min(45, da - f0 / d)); }
    const err = ankle(da) - h0;
    return (a.seatFit = { y: seatY, dy, da, err, settled });
  }
  drawFighter.fitSeat = fitSeat;   // for proto/drawer_test.mjs
  // Tell shapes, all in one pale ink (alpha rising with k, 0..1 through the tell), drawn on the ground:
  //   swing   a ring that tightens;
  //   grab    four chevrons on the ring closing inward (hands reaching);
  //   throw   a short arc ahead and an aim line toward the facing;
  //   answer "lunge"   a wedge along the facing that runs out to the lunge's reach as k grows;
  //   answer "throw"   a dashed aim line ending in a cross;
  //   unstoppable      a doubled ring with outward teeth (the drag and the rope cannot be caught).
  function drawTell(g, t, x, y, ppm, cam, face) {
    const k = Math.max(0, Math.min(1, t.k || 0)), yaw = cam.yawDeg * D2R, el = cam.elevDeg * D2R, sE = Math.sin(el);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), hx = -Math.sin(yaw), hz = -Math.cos(yaw);   // camera right and its horizontal forward
    const scr = (dx, dz, m) => [x + (dx * rx + dz * rz) * m * ppm, y + (dx * hx + dz * hz) * m * ppm * sE];   // a ground offset (metres) to screen
    const fx = Math.cos(face), fz = Math.sin(face), lx = -fz, lz = fx;
    const ink = (a) => `rgba(240,232,214,${a})`, R = 0.6 * (1.3 - 0.3 * k), lw = Math.max(1.5, ppm * 0.03), al = 0.35 + 0.5 * k;
    g.save(); g.lineWidth = lw; g.strokeStyle = ink(al); g.fillStyle = ink(al);
    const ring = (r) => { g.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, [px, py] = scr(Math.cos(a) * r, Math.sin(a) * r, 1); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); };
    const line = (pts) => { g.beginPath(); pts.forEach(([dx, dz], i) => { const [px, py] = scr(dx, dz, 1); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
    if (t.unstoppable) {
      ring(R); ring(R + 0.12);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, b = a + Math.PI / 16; line([[Math.cos(a) * (R + 0.12), Math.sin(a) * (R + 0.12)], [Math.cos(a + Math.PI / 32) * (R + 0.26), Math.sin(a + Math.PI / 32) * (R + 0.26)], [Math.cos(b) * (R + 0.12), Math.sin(b) * (R + 0.12)]]); }
    } else if (t.kind === "grab") {
      ring(R);
      for (let i = 0; i < 4; i++) { const a = face + Math.PI / 4 + (i * Math.PI) / 2, cx = Math.cos(a), cz = Math.sin(a), px = -cz, pz = cx, o = R + 0.25 * (1 - k), w = 0.12;
        line([[cx * (o + 0.14) + px * w, cz * (o + 0.14) + pz * w], [cx * o, cz * o], [cx * (o + 0.14) - px * w, cz * (o + 0.14) - pz * w]]); }
    } else if (t.kind === "throw") {
      g.beginPath(); for (let i = 0; i <= 16; i++) { const a = face - 0.6 + (i / 16) * 1.2, [px, py] = scr(Math.cos(a) * R, Math.sin(a) * R, 1); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      line([[fx * R, fz * R], [fx * (R + 1.2), fz * (R + 1.2)]]);
    } else ring(R);
    if (t.answer === "lunge") {   // a wedge that runs out along the facing
      const L = R + 0.4 + 1.4 * k, w = 0.22;
      g.globalAlpha = 0.8; g.beginPath(); for (const [dx, dz] of [[fx * R + lx * w, fz * R + lz * w], [fx * L, fz * L], [fx * R - lx * w, fz * R - lz * w]]) { const [px, py] = scr(dx, dz, 1); g.lineTo(px, py); } g.closePath(); g.fill(); g.globalAlpha = 1;
    } else if (t.answer === "throw") {   // a dashed aim line ending in a cross
      g.setLineDash([lw * 3, lw * 3]); line([[fx * R, fz * R], [fx * (R + 2.4), fz * (R + 2.4)]]); g.setLineDash([]);
      const ex = fx * (R + 2.4), ez = fz * (R + 2.4), c = 0.14; line([[ex - c, ez - c], [ex + c, ez + c]]); line([[ex - c, ez + c], [ex + c, ez - c]]);
    }
    g.restore();
  }
  drawFighter.drawTell = drawTell;   // for proto/tell_sheet.mjs
  // the neutral placeholder: a plain ink body with a pale edge and a small contact shadow
  function placeholder(g, { x, y, ppm }, cam) {
    const hgt = 1.75 * ppm, wid = 0.5 * ppm, sE = Math.sin(cam.elevDeg * D2R);
    g.save(); g.fillStyle = "rgba(8,4,10,0.35)"; g.beginPath(); g.ellipse(x, y, wid * 0.7, wid * 0.7 * sE, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = Math.max(1, ppm * 0.03); g.strokeStyle = "rgba(233,227,212,0.85)"; g.fillStyle = "rgba(29,20,24,0.85)";
    g.beginPath(); g.ellipse(x, y - hgt / 2, wid / 2, hgt / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(x, y - hgt - wid * 0.35, wid * 0.32, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    return "placeholder";
  }
  drawFighter.bodyOf = bodyOf;   // for proto/drawer_test.mjs
  return drawFighter;
  function drawFighter(g, F, args) {
    const look = new Set(String(globalThis.__lwFigureLook ?? LOOK_DEFAULT).split(",").map((x) => x.trim()).filter(Boolean));
    const { x, y, ppm, face, down, W, at, depth, depthAt, lights, darkness } = args;
    const cam = args.cam || camera, who = bodyOf(W, F);
    if (!who) return placeholder(g, args, cam);
    let a = actors.get(F.id);
    if (!a) { a = cast.actor(who, { tool: toolOfDef(W, F, who) }); actors.set(F.id, a); }
    // a scene person marked `pose: seated` (args.pose, or the figure's own pose field) sits
    const seated = F.person && (args.pose === "seated" || F.seated || (F.def && F.def.pose === "seated"));
    const pose = seated ? { anim: "sit", loop: true } : poseOf(W, F, clipsFor(who));
    a.drive({ x: F.x, z: F.z, face: face ?? F.face, pose: { ...pose, anim: down && !pose.anim ? "knockdown" : pose.anim }, dt: 1 / 60 });
    if (seated) { if (args.seatY != null) fitSeat(a, args.seatY); } else if (a.seatFit) fitSeat(a, null);
    a.seen = performance.now();
    const toolK = keepToolClear(a, args.room || args.reach, args.face ?? face ?? null);
    (globalThis.__lwToolStats ||= {})[F.id] = { room: args.room || args.reach, wrist: [+(a.clear?.b || 0).toFixed(1), +(a.clear?.s || 0).toFixed(1)], target: [a.clear?.tb, a.clear?.ts], k: +toolK.toFixed(1), pos: a.pos.map((v) => +v.toFixed(2)), ...(globalThis.__lwFigureDebug ? (() => { const w = a.weapon && a.weapon(), S = a.skeleton(), r3 = (v) => v.map((q) => +q.toFixed(2)); return { tip: w && r3(w.tip), butt: w && w.butt && r3(w.butt), handL: r3(a.toWorld(S[INDEX.handL].p)), handR: r3(a.toWorld(S[INDEX.handR].p)), head: r3(a.toWorld(S[INDEX.head].p)) }; })() : {}) };   // read by proto/markup.mjs
    // render in the actor's own frame at the plate camera's orientation and scale, feet on (x, y)
    const cosE2 = Math.cos(cam.elevDeg * D2R), truePpm = ppm / cosE2, hM = 2.9, h = Math.ceil(hM * truePpm), w = Math.ceil(h * 0.95), P = a.pos;
    const R = rigAt(at, lights, darkness || 0);
    const r = a.render({ yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, height: hM, centre: [P[0], P[1] + 1.05, P[2]] }, w, h, R.rig, { ss, tone: R.tone });
    const feetDown = 1.05 * cosE2 * truePpm, ox = Math.round(x - r.w / 2), oy = Math.round(y - feetDown - r.h / 2);
    const img = new ImageData(r.w, r.h), d = img.data, G = r.G, fw = fwdOf(cam), n = r.w * r.h;
    // exposure from the painting around the figure's feet: the light that reaches the spot it stands on
    const PC = plateCtx(args);
    // The light the figure stands in, from the painted ground within 1.5 m (EXPOSE_MODE, chosen by
    // testing in PROGRESS step 58): "both" matches the brighter of the ground's brightest third (lamp
    // pools and candle light round the figure) and a floor that rises inside a lamp's reach (0.03 at
    // its edge to 0.15 under it); "lit" and "mid" (the median, step 57) stay for tests
    const mode = globalThis.__lwExposeMode || EXPOSE_MODE, R15 = 1.5 * truePpm;
    const stats0 = PC && PC.lumaStats([[x - R15, y - R15 * Math.sin(cam.elevDeg * D2R), x + R15, y + R15 * Math.sin(cam.elevDeg * D2R)]], 28, { at: at || [0, 0, 0], r: 1.5 });
    const reachF = (R.rig.lamps || []).reduce((m, q) => Math.max(m, q.f2 || 0), 0);   // 1 under a lamp, 0 at the edge of its reach
    const floorAt = 0.03 + 0.1 * reachF;
    // the lit pool counts up to SURROUND_X times the painting all round the figure (walls and props too,
    // 1.6 m either side, 2.3 m up): a fire pool beside a dark room lifts a figure, but not past the room;
    // the lamp floor is not capped by it (the quay's dark stretches under a lamp)
    const sur = PC && PC.lumaStats([[x - 1.6 * ppm, y - 2.3 * ppm, x + 1.6 * ppm, y + 0.4 * ppm]], 24);
    const stats1 = stats0 && (mode === "lit" ? { ...stats0, mid: stats0.lit } : mode === "floor" ? { ...stats0, mid: Math.max(stats0.mid, floorAt) } : mode === "both" ? { ...stats0, mid: Math.max(Math.min(stats0.lit, LIT_X * stats0.mid, sur ? SURROUND_X * sur.mid : 1), floorAt) } : stats0);
    const stats = stats1;
    const X = exposure(r.rgba, n, stats, r.albedo, (i) => ((i / r.w) | 0) * ss * G.w + (i % r.w) * ss);
    (globalThis.__lwFigureStats ||= {})[F.id] = { gain: +X.gain.toFixed(3), ceil: +X.ceil.toFixed(4), mid: stats && +stats.mid.toFixed(4), hi: stats && +stats.hi.toFixed(4), n: stats0 && stats0.n, mode, plate: !!PC };   // read by characters/proto/plate_proof.py
    // hidden where the painted room stands in front: each pixel's own depth against the painting's
    // (OCC_BIAS of slack for the geo buffer's half resolution), a hard mask first, then a one-pixel
    // feather at its edge, so a figure behind a post or a counter is cut cleanly and never ghosted;
    // props in the hands go through the same test
    const vis = new Uint8Array(n).fill(1), dbg = globalThis.__lwFigureDebug || args.solo ? new Float32Array(n).fill(NaN) : null;
    // each figure pixel's depth along the camera's forward axis (metres, the plate's depthOf scale):
    // kept for args.solo (the visual check compares true depths) and the debug flag
    const dzAt = (px, py) => { const gi = py * ss * G.w + px * ss; return G.id[gi] && at ? (depth ?? 0) + (G.wp[gi * 3] - at[0]) * fw[0] + (G.wp[gi * 3 + 1] - at[1]) * fw[1] + (G.wp[gi * 3 + 2] - at[2]) * fw[2] : NaN; };
    if (dbg && !(depthAt && depth != null)) for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) { const i = py * r.w + px; if (r.rgba[i * 4 + 3] > 0) dbg[i] = dzAt(px, py); }
    if (depthAt && depth != null) for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) {
      const i = py * r.w + px; if (r.rgba[i * 4 + 3] <= 0) continue;
      const gi = py * ss * G.w + px * ss, dz = G.id[gi] && at ? depth + (G.wp[gi * 3] - at[0]) * fw[0] + (G.wp[gi * 3 + 1] - at[1]) * fw[1] + (G.wp[gi * 3 + 2] - at[2]) * fw[2] : depth;
      if (dbg) dbg[i] = dz;
      if (dz - depthAt(ox + px, oy + py) > OCC_BIAS) vis[i] = 0;
    }
    if (dbg) (globalThis.__lwFigureDepth ||= {})[F.id] = { ox, oy, w: r.w, h: r.h, dz: dbg, vis };   // per-pixel depth for checking the visual check (globalThis.__lwFigureDebug)
    for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) {
      const i = py * r.w + px; let al = r.rgba[i * 4 + 3]; if (al <= 0 || !vis[i]) continue;
      let s9 = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X2 = px + dx, Y2 = py + dy; s9 += X2 < 0 || Y2 < 0 || X2 >= r.w || Y2 >= r.h ? 1 : vis[Y2 * r.w + X2]; }
      al *= Math.min(1, s9 / 7);
      const lift = look.has("lift") && LIFT_IDS.has(G.id[py * ss * G.w + px * ss]) ? LIFT : 1;   // faces and hands catch the light, under the ceiling
      const c = X.apply(i, lift); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = Math.round(al * 255);
    }
    if (look.has("outline")) {   // a thin line of the ruling light just outside the silhouette, no brighter than the room's highlights
      const rc = X.cap(R.rig.fresnel ? R.rig.fresnel.c.map((v) => Math.min(1, v * 2.4)) : [0.9, 0.8, 0.6]), src = new Uint8ClampedArray(d), wpx = Math.max(1, Math.round(truePpm / 70));
      for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) { const i = py * r.w + px; if (src[i * 4 + 3] > 40) continue; let hit = 0;
        for (let dy = -wpx; dy <= wpx && !hit; dy++) for (let dx = -wpx; dx <= wpx; dx++) { const X2 = px + dx, Y2 = py + dy; if (X2 < 0 || Y2 < 0 || X2 >= r.w || Y2 >= r.h) continue; if (src[(Y2 * r.w + X2) * 4 + 3] > 200) { hit = src[(Y2 * r.w + X2) * 4 + 3]; break; } }
        if (hit) { d[i * 4] = rc[0]; d[i * 4 + 1] = rc[1]; d[i * 4 + 2] = rc[2]; d[i * 4 + 3] = Math.round(170 * hit / 255); } }
    }
    const c = (drawFighter.scratch ||= new OffscreenCanvas(8, 8)); c.width = r.w; c.height = r.h; c.getContext("2d").putImageData(img, 0, 0);
    g.save();
    if (look.has("pool")) { const gr = g.createRadialGradient(x, y, 0, x, y, 0.9 * truePpm); gr.addColorStop(0, "rgba(255,220,170,0.28)"); gr.addColorStop(1, "rgba(255,220,170,0)"); g.save(); g.scale(1, Math.sin(cam.elevDeg * D2R)); g.fillStyle = gr; g.beginPath(); g.arc(x, y / Math.sin(cam.elevDeg * D2R), 0.9 * truePpm, 0, Math.PI * 2); g.fill(); g.restore(); }
    // contact shadow: queued into the canvas's shared mask (runtime/groundshadow.mjs), laid on the
    // plate's ground only; without the plate's geo yet, a small soft ellipse
    const rule = (R.rig.lamps || []).reduce((b, q) => { const w = q.power / ((q.pos[0] - at[0]) ** 2 + (q.pos[2] - at[2]) ** 2 + 1); return w > b.w ? { w, q } : b; }, { w: 0, q: null }).q;
    const away = rule && at ? (() => { const dx = at[0] - rule.pos[0], dz = at[2] - rule.pos[2], l = Math.hypot(dx, dz); return l > 0.05 ? [dx / l, dz / l] : null; })() : null;
    (globalThis.__lwFigureStats[F.id] || {}).away = away;
    if (PC && at) queueShadow(g, PC, { x, y, at, ppm: truePpm, r: down ? 0.8 : 0.5, dir: away, len: away ? 1.2 : 0 });
    else { g.fillStyle = "rgba(8,4,10,0.35)"; g.beginPath(); g.ellipse(x, y, 0.32 * truePpm, 0.32 * truePpm * Math.sin(cam.elevDeg * D2R), 0, 0, Math.PI * 2); g.fill(); }
    // telegraph: an opponent's wind-up, from combat's fxOf tell (args.tell: kind, answer, k, unstoppable)
    // or, without it, the move's tell window. One pale ink, told apart by shape (drawTell)
    let tell = args.tell || null;
    if (!tell) { const m = F.act && W.moves ? W.moves[F.act.id] : null; if (F.team !== "lamb" && m && m.tell && F.act.f >= m.tell.at[0] && F.act.f < m.tell.at[1]) tell = { kind: m.tell.kind || "swing", answer: null, k: (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]), unstoppable: m.parryable === false && m.blockable === false }; }
    if (tell && F.team !== "lamb") drawTell(g, tell, x, y, truePpm, cam, face ?? F.face ?? 0);
    g.drawImage(c, ox, oy); g.restore();
    // solo (the visual check draws each figure alone): the per-pixel depth of what was drawn, NaN where
    // nothing was or where the painting hid it, in the image's own pixels placed at (ox, oy) on screen
    if (args.solo && dbg) { for (let i = 0; i < n; i++) if (!vis[i] || d[i * 4 + 3] === 0) dbg[i] = NaN; const res = { depth: dbg, w: r.w, h: r.h, ox, oy }; if (globalThis.__lwFigureDebug) (globalThis.__lwSolo ||= {})[F.id] = res; return res; }
  };
}
