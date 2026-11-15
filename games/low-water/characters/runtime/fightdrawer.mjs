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
import { plateCtx } from "./platectx.mjs";
import { exposure } from "./expose.mjs";
import { oilInk, INK_RGB, inkWidth } from "./oilink.mjs";
import { queueShadow, queueMask, footprintBox, footprintMask, gridCrop } from "./groundshadow.mjs";
import { makeReactions, queueLambOutline } from "./feel.mjs";
import { STAND } from "../anim/stances.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { tick, tock } from "./perf.mjs";
import { toolStep, toolOff } from "./toolclear.mjs";
import { finishFigure, SEAT_SLACK, OCC_BIAS } from "./figure-core.mjs";
import { toneName, renderJob } from "./figjob.mjs";
import { figPool } from "./figpool.mjs";
import { CAST } from "./castmap.mjs";

const MEMBERS = CAST;
// every figure id with cast data, read by game/engine/tools/cast.mjs (the validator flags any other id)
export const CAST_IDS = Object.keys(CAST);
// combat's actor ids (lamb, an @foe char, else an archetype) to the art's bodies
const BODY = { lamb: "lamb", holder: "warden", skirmisher: "salvor", fennick: "fennick", marrow: "marrow", keel: "keel", merrow: "merrow", lamplighter: "fewell", gorm: "gorm", hobb: "hobb", fewell: "fewell", strand: "strand", bright: "bright", coe: "coe" };

// Until the drawer is told each fighter's world point (asked in NOTES, A4), the lamps cannot be
// placed, so fights use an even sodium light from above with a lamp rim: every fighter reads.
const FIGHT_RIG = { amb: [0.09, 0.07, 0.13], ground: [0.03, 0.025, 0.04], key: { dir: [-0.35, 0.85, 0.4], c: [0.95, 0.6, 0.26], wrap: 0.35 }, fill: { dir: [0.5, 0.3, -0.6], c: [0.2, 0.12, 0.06], wrap: 0.5 }, fresnel: { c: [0.34, 0.2, 0.08], pow: 3 } };
export async function makeFightDrawer({ poseOf, actorOf = null, hourOf = () => 23, camera = { yawDeg: 26, elevDeg: 30 }, rig = FIGHT_RIG, tone = RIGS.quay.tone, base = "/characters/", combatUrl = "/engine/combat/out/timing.combat.json", ss = 1 } = {}) {
  const timing = await (await fetch(base + "anim/timing.json")).json();
  let combat = null; try { const r = await fetch(combatUrl); if (r.ok) combat = await r.json(); } catch (e) { console.warn("fight figures: combat timing not loaded:", e.message); }
  // a figure's build summary from a figure worker (actor.mjs metaOfBuilt), so this thread never builds a
  // mesh (a new figure's far mesh cost 50 to 160 ms here); a figure waits, undrawn, the few frames until it comes
  const metas = new Map();
  const metaOf = (who, tool) => {
    const pool = !asyncOff && typeof Worker !== "undefined" ? asyncPool() : null; if (!pool || !pool.meta) return undefined;
    const k = `${who}|${tool}`; if (metas.has(k)) return metas.get(k);
    metas.set(k, null); pool.meta(who, tool).then((m) => metas.set(k, m), (e) => { console.warn(`figures: no build summary for ${k} (${e.message}); building here`); metas.set(k, undefined); });
    return null;
  };
  const cast = createCast({ timing, combat, members: MEMBERS, metaOf }), actors = new Map(), tables = {};
  // combat's per-frame contacts (anim/fx.mjs, pure) drive the hit reactions; without it, none
  let fxOf = null; try { ({ fxOf } = await import(combatUrl.replace(/out\/timing\.combat\.json$/, "anim/fx.mjs"))); } catch (e) { console.warn("fight figures: no combat fx, so no hit reactions:", e.message); }
  const reactions = makeReactions(fxOf);
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
  // Readability without an outline, as the reference does it (cleanroom/spec/NRFTW-PRESENTATION-2.md
  // section 2; author 2026-10-21 "Make it more like No Rest for the Wicked"): every figure carries a soft
  // light only figures receive (about 2 m reach, no shadow), and a rim from behind in a cool pale
  // blue-grey, so a figure separates from warm painted ground by an edge of the other temperature
  const CARRY = { up: 1.3, toward: 1.0, power: 0.25, c: [1.0, 0.93, 0.82] }, RIM = { c: [0.34, 0.4, 0.54], pow: 2.0, directionality: 2.0, lift: 0.6 };
  function carry(R, at, cam) {
    if (!at || !R || !R.rig || globalThis.__lwNoCarry) return R;
    const f = fwdOf(cam), hl = Math.hypot(f[0], f[2]) || 1, bx = f[0] / hl, bz = f[2] / hl;   // camera forward, level
    const lamps = [...(R.rig.lamps || []), { pos: [at[0] - bx * CARRY.toward, at[1] + CARRY.up, at[2] - bz * CARRY.toward], c: CARRY.c, power: CARRY.power, kind: "carried" }];
    const dl = Math.hypot(bx, RIM.lift, bz), fr = R.rig.fresnel || {};
    // the rim keeps a little of the ruling lamp's colour and takes the cool back light
    const rc = RIM.c.map((v, k) => v + 0.3 * ((fr.c || [0, 0, 0])[k] || 0));
    return { ...R, rig: { ...R.rig, lamps, fresnel: { c: rc, pow: RIM.pow, dir: [bx / dl, RIM.lift / dl, bz / dl], directionality: RIM.directionality } } };
  }
  const D2R = Math.PI / 180, fwdOf = (cam) => { const y = cam.yawDeg * D2R, e = cam.elevDeg * D2R; return [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)]; };
  // Silhouette treatment, chosen by testing at 1080p gameplay zoom (characters/PROGRESS.md step 55);
  // globalThis.__lwFigureLook overrides it for tests: any of lift, outline, shadow, pool, comma-separated.
  const oilFor = {}, CAP_X = 1.9;   // linear: about 1.34x in display values
  const LINB = Float32Array.from({ length: 256 }, (_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const ENCB = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.min(1, v) ** (1 / 2.4) - 0.055));
  const LIFT_IDS = new Set(["skin", "cheek", "jawcool", "lip"].map((n) => MATS[n].id));
  const LOOK_DEFAULT = "lift,outline,oil";   // outline: the plates' ink line on the silhouette, which the plates themselves carry (not a readability halo)   // oil: Oil and Ink shadow planes and skin halftones (runtime/oilink.mjs, author's pick 2026-10-18)   // the test: outline read best on dark ground, lift added faces and hands; shadow and pool vanished on dark ground
  const SEAT_SLACK = 0.22, LIFT = 1.25, OCC_BIAS = 0.14, EXPOSE_MODE = "both", LIT_X = 3, SURROUND_X = 2.5;   // the lit third counts up to 3x the ground's median (Merrow beside the fire pool read 2.2x his surroundings)   // face lift in linear light; occlusion slack in metres
  // A held staff or pole kept inside the room around the figure (args.room: metres to the nearest prop
  // or person ahead, left and right, from the engine; args.reach alone means ahead only). Both ends of
  // the shaft are tested, and neither may go under the floor; the whole shaft keeps BODY_R off every
  // other body this drawer drew in the last frames (the room is measured at the feet, a pole is not). When one breaks a limit, the wrist turns
  // (bend in 10 and side in 15 degree steps to 60, both arms drawn in by 0, 15 or 30 when the wrist alone cannot; the smallest change first) to the nearest pose that
  // fits; the angle eases over a few frames so the tool never snaps, and a pose that still fits is kept.
  // The limits and the search itself: runtime/toolclear.mjs. With module workers the search runs whole in
  // the tool worker (runtime/toolworker.mjs): each figure has at most one question out, asked with this
  // frame's pose, and the answer is the target the wrist eases toward from the frame it arrives; here it
  // costs one pose and a message a frame. ?toolsearch=main (and Node) searches here, TOOL_STEP candidates a
  // frame (each costs a skeleton solve), so a limit tripping never stalls a frame.
  const TOOL_EASE = 0.25, TOOL_STEP = 64;
  const toolHere = !(typeof Worker !== "undefined" && !(globalThis.location && /[?&]toolsearch=main(&|$)/.test(globalThis.location.search || "")));
  // two tool workers (the brawl's nine armed figures ask about every frame, about 1.2 ms each); a figure
  // keeps its worker, whose stand-in actors and meshes stay built
  const TOOL_WORKERS = 2; let toolWs = null, toolSeq = 0, toolNext = 0;
  const toolWorker = (a) => {
    if (toolHere || toolFailed) return null;
    if (!toolWs) try {
      toolWs = Array.from({ length: TOOL_WORKERS }, () => {
        const w = new Worker(new URL("./toolworker.mjs", import.meta.url), { type: "module" });
        w.postMessage({ type: "init", timing, combat });
        w.onmessage = (e) => { const m = e.data, a = actors.get(m.id), TS = (globalThis.__lwToolSearch ||= { asked: 0, answered: 0, ms: 0, tries: 0, wait: 0, failed: 0 }); if (!a || !a.clear) return; const st = a.clear; if (st.asked !== m.seq) return; st.asked = 0;
          if (m.error) { TS.failed++; console.warn(`figures: tool search failed (${m.error})`); return; }
          TS.answered++; TS.ms += m.ms; TS.tries += m.tries; TS.wait += performance.now() - st.askedAt; st.tb = m.tb; st.ts = m.ts; st.to = m.to; };
        w.onerror = (e) => { console.warn(`figures: tool worker failed (${e.message}); searching here`); toolFailed = true; };
        return w;
      });
    } catch (e) { console.warn(`figures: no tool worker (${e.message}); searching here`); toolFailed = true; return null; }
    if (a.toolIdx == null) a.toolIdx = toolNext++ % TOOL_WORKERS;
    return toolWs[a.toolIdx];
  };
  let toolFailed = false;
  // the walk grid's cells round the figure, for the worker's blocked(x, z) (ui/peoplelayer.mjs roomOf passes the arena)
  function cropBlocked(A, pos, reach = 3.5) {
    const c = A.cell, [ox, oz] = A.origin, W = A.grid.w, H = A.grid.h;
    const c0 = Math.max(0, Math.floor((pos[0] - reach - ox) / c)), c1 = Math.min(W - 1, Math.floor((pos[0] + reach - ox) / c)), r0 = Math.max(0, Math.floor((pos[2] - reach - oz) / c)), r1 = Math.min(H - 1, Math.floor((pos[2] + reach - oz) / c));
    const cw = Math.max(0, c1 - c0 + 1), ch = Math.max(0, r1 - r0 + 1), bits = new Uint8Array(cw * ch);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const cell = A.grid.cells[(r0 + j) * W + c0 + i]; bits[j * cw + i] = (cell ? cell.h : null) == null ? 1 : 0; }
    return { ox, oz, c, w: W, h: H, c0, r0, cw, ch, bits };
  }
  function keepToolClear(a, room, face = null) {
    const st = (a.clear ||= { b: 0, s: 0, tb: 0, ts: 0 });
    const R = room == null ? null : typeof room === "number" ? { ahead: room, left: 9, right: 9, behind: null } : room;
    const fa = face ?? ((90 - a.facing) * Math.PI) / 180, fx = Math.cos(fa), fz = Math.sin(fa);
    const now = performance.now(), near = [...actors.values()].filter((o) => o !== a && now - (o.seen || -1e9) < 600 && Math.hypot(o.pos[0] - a.pos[0], o.pos[2] - a.pos[2]) < 2.6).map((o) => o.pos);
    const W = !toolFailed && a.fid != null && actors.get(a.fid) === a && (!R || !R.blocked || R.arena) ? toolWorker(a) : null;
    a.adjust(null, "tool");
    if (W) {
      if (!st.asked) {
        const TS = (globalThis.__lwToolSearch ||= { asked: 0, answered: 0, ms: 0, tries: 0, wait: 0, failed: 0 }); TS.asked++;
        st.asked = ++toolSeq; st.askedAt = now;
        W.postMessage({ type: "tool", id: a.fid, seq: st.asked, who: a.body, tool: a.tool, base: a.pose(), locks: a.locksLocal(), facing: a.facing, pos: [...a.pos], fx, fz,
          R: R && { ahead: R.ahead, left: R.left, right: R.right, behind: R.behind }, crop: R && R.blocked && R.arena ? cropBlocked(R.arena, a.pos) : null, near: near.map((p) => [...p]), st: { tb: st.tb, ts: st.ts, to: st.to || 0 } });
      } else if (now - st.askedAt > 1000) st.asked = 0;   // an answer lost: ask again
    } else {
      const env = { measure: (off) => { a.adjust(off ? toolOff(off[0], off[1], off[2]) : null, "tool"); const S = a.skeleton(); return { w: a.weapon && a.weapon(S), S, toWorld: a.toWorld }; }, pos: a.pos, fx, fz, R, blocked: R && R.blocked ? R.blocked : null, near };
      toolStep(env, st, TOOL_STEP);
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
  drawFighter.actorOf = (id) => actors.get(id) || null;   // a figure's actor (tools/crowd-cards.mjs reads the walk cycle's phase)
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
  // Off-thread drawing (runtime/figpool.mjs): on wherever module workers run, unless a test or tool
  // needs this thread's results (solo, debug, the painter's trace or screen control) or ?figs=sync asks
  let asyncOff = !!(globalThis.location && /[?&]figs=sync(&|$)/.test(globalThis.location.search || "")), poolV;
  const verifyOn = !!(globalThis.location && /[?&]figs=verify(&|$)/.test(globalThis.location.search || ""));
  const skinWorker = !(globalThis.location && /[?&]figskin=main(&|$)/.test(globalThis.location.search || ""));   // ?figskin=main: skin on this thread, for measuring
  // one pool for every drawer (a fight's camera has its own drawer, and a figure keeps one worker and so one painter history)
  const FIRST_WAIT = 1500;
  const asyncPool = () => (poolV === undefined ? (poolV = asyncOff ? null : (globalThis.__lwFigPool ??= figPool(poolOpts()))) : poolV);
  const asyncOK = (args, look, tone) => !asyncOff && !args.solo && !globalThis.__lwFigureDebug && !globalThis.__lwFigsSync && !globalThis.__lwPaintDebug && !globalThis.__lwPaintTrace
    && !(globalThis.__lwPainter && globalThis.__lwPainter.anchor !== "bind") && toneName(tone) !== undefined && !!asyncPool();
  drawFighter.pool = () => poolV || null;
  // ?figw=N workers, ?figst=1|2 stages, ?figbudget=N (0: none), ?figlane=0, ?figsplit=1 (split at any frame rate) and ?figadapt=1 (the share under load, off by default) (runtime/figpool.mjs), for measuring
  function poolOpts() { const q = (globalThis.location && globalThis.location.search) || "", o = {}, w = /[?&]figw=(\d+)/.exec(q), st = /[?&]figst=(\d)/.exec(q); if (w) o.size = +w[1]; if (st) o.stages = +st[1]; const b = /[?&]figbudget=(\d+)/.exec(q); if (b) o.budget = +b[1] || Infinity; if (/[?&]figlane=0/.test(q)) o.lanes = false; if (/[?&]figsplit=1/.test(q)) o.splitMs = Infinity; if (/[?&]figadapt=1/.test(q)) o.adapt = true; return o; }
  drawFighter.bodyOf = bodyOf;   // for proto/drawer_test.mjs
  return drawFighter;
  function drawFighter(g, F, args) {
    const look = new Set(String(globalThis.__lwFigureLook ?? LOOK_DEFAULT).split(",").map((x) => x.trim()).filter(Boolean));
    const { x, y, ppm, face, down, W, at, depth, depthAt, lights, darkness } = args;
    const cam = args.cam || camera, who = bodyOf(W, F);
    if (!who) return placeholder(g, args, cam);
    let t = tick(); const tAll = t;
    let a = actors.get(F.id);
    if (!a) { a = cast.actor(who, { tool: toolOfDef(W, F, who) }); a.fid = F.id; a.body = who; actors.set(F.id, a); }
    if (!a.ready()) return;   // its build summary is on its way from a worker (metaOf above)
    // a scene person marked `pose: seated` (args.pose, or the figure's own pose field) sits
    const seated = F.person && (args.pose === "seated" || F.seated || (F.def && F.def.pose === "seated"));
    const pose = seated ? { anim: "sit", loop: true } : poseOf(W, F, clipsFor(who));
    a.drive({ x: F.x, z: F.z, face: face ?? F.face, pose: { ...pose, anim: down && !pose.anim ? "knockdown" : pose.anim }, dt: 1 / 60 });
    if (seated) { if (args.seatY != null) fitSeat(a, args.seatY); } else if (a.seatFit) fitSeat(a, null);
    a.seen = performance.now();
    tock("d.pose", t); let td = tick();
    // weight on contact: the struck body snaps away from the blow, a heavy striker recoils (runtime/feel.mjs)
    if (W && W.byId) { reactions.read(W); const proto = Object.getPrototypeOf(F), cid = proto && Object.prototype.hasOwnProperty.call(proto, "id") ? proto.id : F.id; a.adjust(reactions.layer(cid, face ?? F.face ?? 0), "hit"); }
    tock("d.react", td); td = tick();
    const toolK = keepToolClear(a, args.room || args.reach, args.face ?? face ?? null);
    tock("d.tool", td); td = tick();
    (globalThis.__lwToolStats ||= {})[F.id] = { room: args.room || args.reach, wrist: [+(a.clear?.b || 0).toFixed(1), +(a.clear?.s || 0).toFixed(1)], target: [a.clear?.tb, a.clear?.ts], k: +toolK.toFixed(1), pos: a.pos.map((v) => +v.toFixed(2)), ...(globalThis.__lwFigureDebug ? (() => { const w = a.weapon && a.weapon(), S = a.skeleton(), r3 = (v) => v.map((q) => +q.toFixed(2)); return { tip: w && r3(w.tip), butt: w && w.butt && r3(w.butt), handL: r3(a.toWorld(S[INDEX.handL].p)), handR: r3(a.toWorld(S[INDEX.handR].p)), head: r3(a.toWorld(S[INDEX.head].p)) }; })() : {}) };   // read by proto/markup.mjs
    // Glyph mode (game/engine/paint/glyph): the posed skeleton is handed to the glyph renderer and nothing is rasterised here
    if (globalThis.__lwGlyphFigure) { const SK = a.skeleton(), M0 = MEMBERS[who] || {}, dy = at ? at[1] - a.pos[1] : 0, up = (p) => (p ? [p[0] + (at ? at[0] - a.pos[0] : 0), p[1] + dy, p[2] + (at ? at[2] - a.pos[2] : 0)] : p), /* the glyph lead's fix (design/state/glyph.md): on a plate with no arena the stage offsets fight coordinates; move the skeleton to where the painted figure stands */ wp = a.weapon ? a.weapon() : null; globalThis.__lwGlyphFigure({ id: F.id, who, team: F.team, person: !!F.person, down: !!down, joints: SK.map((jt) => up(a.toWorld(jt.p))), weapon: wp && { ...wp, tip: up(wp.tip), butt: up(wp.butt), grip: up(wp.grip) }, P: M0.P, palette: M0.palette, info: M0.info, offhand: M0.info && M0.info.offhand, face: face ?? F.face ?? 0, tell: args.tell || (() => { const m = F.act && W && W.moves ? W.moves[F.act.id] : null; return F.team !== "lamb" && m && m.tell && F.act.f >= m.tell.at[0] && F.act.f < m.tell.at[1] ? { kind: m.tell.kind || "swing", answer: null, k: (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]), unstoppable: m.parryable === false && m.blockable === false } : null; })(), solo: !!args.solo }); return "glyph"; }
    // render in the actor's own frame at the plate camera's orientation and scale, feet on (x, y)
    const cosE2 = Math.cos(cam.elevDeg * D2R), truePpm = ppm / cosE2, hM = 2.9, h = Math.ceil(hM * truePpm), w = Math.ceil(h * 0.95), P = a.pos;
    const R = carry(rigAt(at, lights, darkness || 0), at, cam);
    tock("drive", t); t = tick();
    const feetDown = 1.05 * cosE2 * truePpm, fw = fwdOf(cam), view = { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, height: hM, centre: [P[0], P[1] + 1.05, P[2]] };
    // exposure from the painting around the figure's feet: the light that reaches the spot it stands on
    const PC = plateCtx(args);
    // The light the figure stands in, from the painted ground within 1.5 m (EXPOSE_MODE, chosen by
    // testing in PROGRESS step 58): "both" matches the brighter of the ground's brightest third (lamp
    // pools and candle light round the figure) and a floor that rises inside a lamp's reach (0.03 at
    // its edge to 0.15 under it); "lit" and "mid" (the median, step 57) stay for tests
    const mode = globalThis.__lwExposeMode || EXPOSE_MODE, R15 = 1.5 * truePpm;
    // read only for a frame that is drawn (sent to a worker, or drawn here): a figure whose worker is busy
    // skips it (the same values when it is read: the plate, the place and the lights of this frame)
    let LST = null;
    const lightStats = () => { if (LST) return LST;
    const stats0 = PC && PC.lumaStats([[x - R15, y - R15 * Math.sin(cam.elevDeg * D2R), x + R15, y + R15 * Math.sin(cam.elevDeg * D2R)]], 28, { at: at || [0, 0, 0], r: 1.5 });
    const reachF = (R.rig.lamps || []).reduce((m, q) => Math.max(m, q.f2 || 0), 0);   // 1 under a lamp, 0 at the edge of its reach
    const floorAt = 0.03 + 0.1 * reachF;
    // the lit pool counts up to SURROUND_X times the painting all round the figure (walls and props too,
    // 1.6 m either side, 2.3 m up): a fire pool beside a dark room lifts a figure, but not past the room;
    // the lamp floor is not capped by it (the quay's dark stretches under a lamp)
    const sur = PC && PC.lumaStats([[x - 1.6 * ppm, y - 2.3 * ppm, x + 1.6 * ppm, y + 0.4 * ppm]], 24);
    const stats1 = stats0 && (mode === "lit" ? { ...stats0, mid: stats0.lit } : mode === "floor" ? { ...stats0, mid: Math.max(stats0.mid, floorAt) } : mode === "both" ? { ...stats0, mid: Math.max(Math.min(stats0.lit, LIT_X * stats0.mid, sur ? SURROUND_X * sur.mid : 1), floorAt) } : stats0);
    return (LST = { stats0, sur, stats: stats1 }); };
    // Off the main thread (runtime/figpool.mjs): the frame's job goes to this figure's worker when its
    // last one is back, and the newest finished image is drawn at the feet as they are now
    // A starved worker (no image yet half a second after the first ask, or none newer than a second while one
    // is under way: a loaded machine) gives way to this thread for the frame, so a figure is never missing
    // or a second stale; counted in globalThis.__lwFigStarved
    const asyncWanted = asyncOK(args, look, R.tone), nowT = performance.now(), L0 = asyncWanted ? asyncPool().latest(F.id) : null;
    // (measured from the first frame actually sent: a figure waiting for the plate's data is not starved)
    // A figure's first image waits FIRST_WAIT ms (1.5 s) before this thread draws it: a new place's figures
    // build their meshes in the workers under the ink blot, and drawing them here meant building them here too
    // (a 190 ms frame in a move, perf/PROGRESS.md 21)
    // A main thread already slow (frames over 40 ms) takes no such figure, and at most one figure is drawn
    // here each 50 ms: drawing many here would slow the frames, age every image past the limit, and feed itself
    let starved = asyncWanted && !verifyOn && (L0 ? nowT - L0.t > 1000 && asyncPool().busy(F.id) : !!a.firstSent && nowT - a.firstSent > FIRST_WAIT);
    if (starved) { const S = (globalThis.__lwStarveGate ||= { at: -1e9 }); if ((a.frameMs || 16.7) > 40 || nowT - S.at < 50) starved = false; else S.at = nowT; }
    if (starved) globalThis.__lwFigStarved = (globalThis.__lwFigStarved || 0) + 1;
    const async = asyncWanted && !starved;
    let src = null, sw = 0, sh = 0, solo = null;
    // the plate's occlusion data (the worker answers the test from it): a job waits for it, so no image is
    // drawn unoccluded
    const pool = asyncWanted ? asyncPool() : null, occ = pool && depthAt && depthAt.occlusion ? depthAt.occlusion() : null;
    const canSend = !!pool && !pool.busy(F.id) && (occ || !depthAt);
    if (pool) { if (a.lastDraw) a.frameMs = a.frameMs ? a.frameMs * 0.9 + Math.min(200, nowT - a.lastDraw) * 0.1 : Math.min(200, nowT - a.lastDraw); a.lastDraw = nowT; }   // the frames' interval, smoothed
    // the contact shadow's footprint (runtime/groundshadow.mjs): worked out with the frame's job in its worker,
    // here when the frame is drawn here
    const rule = (R.rig.lamps || []).reduce((b, q) => { const w = q.power / ((q.pos[0] - at[0]) ** 2 + (q.pos[2] - at[2]) ** 2 + 1); return w > b.w ? { w, q } : b; }, { w: 0, q: null }).q;
    const away = rule && at ? (() => { const dx = at[0] - rule.pos[0], dz = at[2] - rule.pos[2], l = Math.hypot(dx, dz); return l > 0.05 ? [dx / l, dz / l] : null; })() : null;
    const fp = PC && at ? { x, y, at, ppm: truePpm, r: down ? 0.8 : 0.5, dir: away, len: away ? 1.2 : 0 } : null;
    function dispatch(job) {
      if (typeof job.tone === "function") job.tone = toneName(job.tone);
      const { stats, sur, stats0 } = lightStats(); a.sentStats = { stats, n: stats0 && stats0.n };   // reported with the images (globalThis.__lwFigureStats)
      const post = { ss, stats, sur, look: [...look], seated, depth, at, fw, ox: Math.round(x - w / 2), oy: Math.round(y - feetDown - h / 2), truePpm, yawDeg: cam.yawDeg, solo: false, keepDepth: false, who, team: F.team, person: !!F.person,
        paint: !!globalThis.__lwPainter, paintInfo: { key: F.id, ppm: truePpm, cam: { ...cam }, plate: args.plate, lamps: R.rig.lamps || null }, hour: hourOf(), perf: !!globalThis.__lwPerf };
      // ?figs=verify: the same job drawn here as well, and the worker's image compared byte for byte
      const want = verifyOn ? (() => { const jc = structuredClone(job), r2 = renderJob(jc, a.mesh(jc), (a.vbuf ||= {})), d2 = new Uint8ClampedArray(r2.w * r2.h * 4);
        post.verify = true; const Z2 = finishFigure(r2, { ...post, look: new Set(post.look), depthAt, painter: post.paint ? globalThis.__lwPainter : null }, (a.vpb ||= {}), d2); let hid = 0; for (let i = 0; i < Z2.vis.length; i++) hid += Z2.vis[i] ? 0 : 1; d2.hidden = hid; d2.preHash = Z2.preHash; return d2; })() : null;
      a.firstSent ||= performance.now();
      let sb = [], wantShadow = null;
      if (fp && PC.grid && PC.grid.pos) { const W = g.canvas.width, H = g.canvas.height, crop = gridCrop(PC.grid, footprintBox(fp, W, H)); post.shadow = { fp: { ...fp }, W, H, crop }; sb = [crop.pos.buffer, crop.valid.buffer]; if (verifyOn) wantShadow = footprintMask({ ...fp }, PC.grid, W, H); }
      try { pool.send(F.id, job, post, occ, [...(job.S ? [job.S.pos.buffer, job.S.nrm.buffer] : []), ...sb], { feetDown, want, wantShadow, fx: x, fy: y }, { frameMs: a.frameMs || 16.7, lane: who === "lamb" || F.team === "lamb" }); }
      catch (e) { console.warn(`figures: off-thread drawing stopped (${e.message}); drawing here`); asyncOff = true; }
    }
    if (async) {
      if (canSend) dispatch(a.prepare(view, w, h, R.rig, { ss, tone: R.tone, skinAt: skinWorker ? "worker" : "here" }));   // skinned in the worker (?figskin=main: here)
      const L = pool.latest(F.id);
      if (L) { src = L.canvas; sw = L.w; sh = L.h; (globalThis.__lwFigureStats ||= {})[F.id] = { gain: +L.gain.toFixed(3), ceil: +L.ceil.toFixed(4), mid: a.sentStats && a.sentStats.stats && +a.sentStats.stats.mid.toFixed(4), hi: a.sentStats && a.sentStats.stats && +a.sentStats.stats.hi.toFixed(4), n: a.sentStats && a.sentStats.n, mode, plate: !!PC, async: true };   // the light of the last frame sent
        if (L.paintStats) (globalThis.__lwPaintStats ||= {})[F.id] = L.paintStats;
        // the first frame an image is drawn: how long since its frame's pose was sent (read by tools/bench.mjs)
        if (L.seq !== a.shownSeq && L.sentAt != null) { a.shownSeq = L.seq; const Q = ((globalThis.__lwFigShown ||= {})[F.id] ||= { n: 0, ms: 0 }); Q.n++; Q.ms += nowT - L.sentAt; }
        if (verifyOn && L.d && L.meta && L.meta.want && L.seq !== a.verSeq) { a.verSeq = L.seq; const V = (globalThis.__lwFigVerify ||= { frames: 0, bytes: 0, differ: 0, max: 0 }), p = L.d, q = L.meta.want; V.frames++; V.bytes += p.length; if (!L.occluded) V.unoccluded = (V.unoccluded || 0) + 1; if (L.preHash !== q.preHash) { V.preDiff = (V.preDiff || 0) + 1; V.preFirst ||= V.frames; } if (L.hidden !== q.hidden) { V.visDiff = (V.visDiff || 0) + 1; V.visFirst ||= V.frames; } if (V.why === undefined && depthAt && !depthAt.occlusion) V.why = "depthAt without occlusion source";
          if (p.length !== q.length) V.differ += p.length; else for (let i = 0; i < p.length; i++) { const e = Math.abs(p[i] - q[i]); if (e) { V.differ++; if (e > V.max) V.max = e; (V.by ||= {})[F.id] = (V.by[F.id] || 0) + 1; if (!V.first) V.first = { fid: F.id, frame: V.frames, i }; } } }
        if (verifyOn && L.shadow && L.meta && L.meta.wantShadow && L.seq !== a.verShadowSeq) { a.verShadowSeq = L.seq; const V = (globalThis.__lwFigVerify ||= { frames: 0, bytes: 0, differ: 0, max: 0 }), p = L.shadow, q = L.meta.wantShadow; V.shadows = (V.shadows || 0) + 1;
          if (p.x0 !== q.x0 || p.y0 !== q.y0 || p.w !== q.w || p.h !== q.h || p.mask.some((v, i) => v !== q.mask[i])) V.shadowDiffer = (V.shadowDiffer || 0) + 1; }
        if (L.perf && L.seq !== a.perfSeq && globalThis.__lwPerf) { a.perfSeq = L.seq; for (const [k, e] of Object.entries(L.perf)) { const q = (globalThis.__lwPerf["w." + k] ||= { ms: 0, n: 0 }); q.ms += e.ms; q.n += e.n; } } }
      else (globalThis.__lwFigureStats ||= {})[F.id] = { async: true, pending: true };
      t = tick();
    } else {
    // starved: drawn here, and the frame still goes to the worker, so it catches up
    let r; if (starved && canSend) { const job = a.prepare(view, w, h, R.rig, { ss, tone: R.tone }), jt = job.tone; job.tone = toneName(jt); const jc = structuredClone(job); job.tone = jt; dispatch(jc); r = renderJob(job, a.mesh(job), (a.state.buf ||= {})); }
    else r = a.render(view, w, h, R.rig, { ss, tone: R.tone, pool: true });
    const ox = Math.round(x - r.w / 2), oy = Math.round(y - feetDown - r.h / 2);
    tock("render", t); if (globalThis.__lwPerf) { const e = (globalThis.__lwPerf.kpx ||= { ms: 0, n: 0 }); e.ms += (r.w * r.h) / 1000; e.n++; } t = tick();
    const img = a.img && a.img.width === r.w && a.img.height === r.h ? a.img : (a.img = new ImageData(r.w, r.h)), d = img.data.fill(0), G = r.G, n = r.w * r.h;
    const pb = (a.drawBuf ||= {});   // this actor's reused arrays (exposure, masks, the image)
    const { stats, sur, stats0 } = lightStats();
    const Z = finishFigure(r, { ss, stats, sur, look, seated, depth, at, fw, depthAt, ox, oy, truePpm, yawDeg: cam.yawDeg, solo: !!args.solo, keepDepth: !!(globalThis.__lwFigureDebug || args.solo), who, team: F.team, person: !!F.person,
      painter: globalThis.__lwPainter || null, paintInfo: { key: F.id, ppm: truePpm, cam, plate: args.plate, lamps: R.rig.lamps || null } }, pb, d);
    const vis = Z.vis, dbg = Z.dbg;
    (globalThis.__lwFigureStats ||= {})[F.id] = { gain: +Z.gain.toFixed(3), ceil: +Z.ceil.toFixed(4), mid: stats && +stats.mid.toFixed(4), hi: stats && +stats.hi.toFixed(4), n: stats0 && stats0.n, mode, plate: !!PC };   // read by characters/proto/plate_proof.py
    if (dbg) (globalThis.__lwFigureDepth ||= {})[F.id] = { ox, oy, w: r.w, h: r.h, dz: dbg, vis };   // per-pixel depth for checking the visual check (globalThis.__lwFigureDebug)
    t = tick();
    const c = (drawFighter.scratch ||= new OffscreenCanvas(8, 8)); c.width = r.w; c.height = r.h; c.getContext("2d").putImageData(img, 0, 0);
    src = c; sw = r.w; sh = r.h;
    // solo (the visual check draws each figure alone): the per-pixel depth of what was drawn, NaN where
    // nothing was or where the painting hid it, in the image's own pixels placed at (ox, oy) on screen
    if (args.solo && dbg) { for (let i = 0; i < n; i++) if (!vis[i] || d[i * 4 + 3] === 0) dbg[i] = NaN; solo = { depth: dbg, w: r.w, h: r.h, ox, oy }; if (globalThis.__lwFigureDebug) (globalThis.__lwSolo ||= {})[F.id] = solo; }
    tock("upload", t); t = tick();
    }
    g.save();
    if (look.has("pool")) { const gr = g.createRadialGradient(x, y, 0, x, y, 0.9 * truePpm); gr.addColorStop(0, "rgba(255,220,170,0.28)"); gr.addColorStop(1, "rgba(255,220,170,0)"); g.save(); g.scale(1, Math.sin(cam.elevDeg * D2R)); g.fillStyle = gr; g.beginPath(); g.arc(x, y / Math.sin(cam.elevDeg * D2R), 0.9 * truePpm, 0, Math.PI * 2); g.fill(); g.restore(); }
    // contact shadow: queued into the canvas's shared mask (runtime/groundshadow.mjs), laid on the
    // plate's ground only; without the plate's geo yet, a small soft ellipse
    (globalThis.__lwFigureStats[F.id] || {}).away = away;
    const LS = async && src ? asyncPool().latest(F.id) : null;
    if (LS && LS.shadow && LS.meta && LS.meta.fx != null) queueMask(g, LS.shadow, x - LS.meta.fx, y - LS.meta.fy);   // as the image: worked out with its frame, placed with the feet now
    else if (fp) queueShadow(g, PC, fp);
    else { g.fillStyle = "rgba(8,4,10,0.35)"; g.beginPath(); g.ellipse(x, y, 0.32 * truePpm, 0.32 * truePpm * Math.sin(cam.elevDeg * D2R), 0, 0, Math.PI * 2); g.fill(); }
    // telegraph: an opponent's wind-up, from combat's fxOf tell (args.tell: kind, answer, k, unstoppable)
    // or, without it, the move's tell window. One pale ink, told apart by shape (drawTell)
    let tell = args.tell || null;
    if (!tell) { const m = F.act && W.moves ? W.moves[F.act.id] : null; if (F.team !== "lamb" && m && m.tell && F.act.f >= m.tell.at[0] && F.act.f < m.tell.at[1]) tell = { kind: m.tell.kind || "swing", answer: null, k: (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]), unstoppable: m.parryable === false && m.blockable === false }; }
    if (tell && F.team !== "lamb") drawTell(g, tell, x, y, truePpm, cam, face ?? F.face ?? 0);
    tock("tells", t); t = tick();
    if (src) g.drawImage(src, Math.round(x - sw / 2), Math.round(y - feetDown - sh / 2)); g.restore();
    tock("blit", t); tock("figure", tAll);
    if (solo) return solo;
  };
}
