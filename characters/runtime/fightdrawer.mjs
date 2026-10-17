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
    const pose = poseOf(W, F, clipsFor(who));
    a.drive({ x: F.x, z: F.z, face: face ?? F.face, pose: { ...pose, anim: down && !pose.anim ? "knockdown" : pose.anim }, dt: 1 / 60 });
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
    const vis = new Uint8Array(n).fill(1), dbg = globalThis.__lwFigureDebug ? new Float32Array(n).fill(NaN) : null;
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
    // telegraph: an opponent's wind-up on a move combat marks with a tell gets a pale ring at the feet
    const m = F.act && W.moves ? W.moves[F.act.id] : null;
    if (F.team !== "lamb" && m && m.tell && F.act.f >= m.tell.at[0] && F.act.f < m.tell.at[1]) {
      const k = (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]);
      g.strokeStyle = `rgba(240,232,214,${0.35 + 0.5 * k})`; g.lineWidth = Math.max(1.5, truePpm * 0.03); g.beginPath(); g.ellipse(x, y, 0.6 * truePpm * (1.3 - 0.3 * k), 0.6 * truePpm * (1.3 - 0.3 * k) * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.drawImage(c, ox, oy); g.restore();
  };
}
