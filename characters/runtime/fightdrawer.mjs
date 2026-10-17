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
const CAST = { lamb, fennick, marrow, warden, salvor, keel, sabine, wenna, merrow, gorm: GORM, hobb: HOBB, fewell: FEWELL, strand: STRAND, bright: BRIGHT, coe: COE, ...Object.fromEntries(Object.entries(FOLK).map(([k, m]) => [k.toLowerCase(), m])) };

const MEMBERS = CAST;
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

  function bodyOf(W, F) {
    const d = (W.defs && W.defs[F.id]) || {}, id = actorOf ? actorOf(W, F) : (F.team === "lamb" ? "lamb" : d.char || d.style || d.kind);
    return BODY[id] || (d.style === "skirmisher" ? "salvor" : F.team === "lamb" ? "lamb" : "warden");
  }
  function toolOfDef(W, F, who) {
    const d = (W.defs && W.defs[F.id]) || {}, t = d.tool || d.weapon || null;
    return t ? String(t).replace(/^w\./, "") : MEMBERS[who].info.tool;
  }

  // The plate's own lights at the figure's position (place.json lights: at, kind, I, reach), dimmed as
  // the plate goes to its blackout; a cool sky rim always, so a figure reads against dark ground.
  const KIND = { sodium: [1.0, 0.62, 0.26], paraffin: [1.0, 0.76, 0.46], window: [1.0, 0.76, 0.46], white: [0.9, 0.95, 1.0], arc: [0.9, 0.95, 1.0], beam: [0.95, 0.97, 1.0], lantern: [1.0, 0.8, 0.5] };
  function rigAt(at, lights, darkness = 0) {
    if (!at || !lights || !lights.length) return { rig, tone };
    const near = lights.map((L) => ({ L, d: Math.hypot(L.at[0] - at[0], L.at[2] - at[2]) })).filter((q) => q.d < (q.L.reach || 6) * 1.6).sort((a, b) => a.d - b.d).slice(0, 4);
    const lit = 1 - darkness, lamps = near.map(({ L }) => ({ pos: L.at, c: KIND[L.kind] || KIND.paraffin, power: 0, d: Math.hypot(L.at[0] - at[0], L.at[1] - 1 - at[1], L.at[2] - at[2]), I: L.I || 1, kind: L.kind }));
    // which light rules here, weighted by what reaches the figure: sodium's ramp only where sodium wins
    // the plate's own falloff, I (1 - d / reach)^2, matched at the figure's chest (the rasteriser's
    // inverse square then shapes it across the body)
    for (const q of lamps) { const reach = near.find((n) => n.L.at === q.pos).L.reach || 6, f = Math.max(0, 1 - q.d / reach); q.power = q.I * f * f * (q.d * q.d + 0.3) * 0.75 * lit; }
    const share = lamps.reduce((acc, q) => { const e = q.I / (q.d * q.d + 1); acc[q.kind === "sodium" ? 0 : 1] += e; return acc; }, [0, 0]);
    const sod = share[0] > share[1] && lit > 0.3;
    return {
      tone: sod ? tone : null,
      rig: { amb: [0.09 + 0.04 * darkness, 0.08 + 0.04 * darkness, 0.13 + 0.06 * darkness], ground: [0.025, 0.02, 0.035], key: { dir: [-0.3, 0.8, 0.5], c: [0.05, 0.05, 0.08], wrap: 0.3 }, lamps,
        fresnel: { c: near.length && lit > 0.3 ? (KIND[near[0].L.kind] || KIND.paraffin).map((v) => v * 0.5) : [0.2, 0.24, 0.34], pow: 2.2 } },
    };
  }
  const D2R = Math.PI / 180, fwdOf = (cam) => { const y = cam.yawDeg * D2R, e = cam.elevDeg * D2R; return [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)]; };
  // Silhouette treatment, chosen by testing at 1080p gameplay zoom (characters/PROGRESS.md step 55);
  // globalThis.__lwFigureLook overrides it for tests: any of lift, outline, shadow, pool, comma-separated.
  const LIFT_IDS = new Set(["skin", "cheek", "jawcool", "lip"].map((n) => MATS[n].id));
  const LOOK_DEFAULT = "lift,outline";   // the test: outline read best on dark ground, lift added faces and hands; shadow and pool vanished on dark ground
  return function drawFighter(g, F, args) {
    const look = new Set(String(globalThis.__lwFigureLook ?? LOOK_DEFAULT).split(",").map((x) => x.trim()).filter(Boolean));
    const { x, y, ppm, face, down, W, at, depth, depthAt, lights, darkness } = args;
    const cam = args.cam || camera, who = bodyOf(W, F);
    let a = actors.get(F.id);
    if (!a) { a = cast.actor(who, { tool: toolOfDef(W, F, who) }); actors.set(F.id, a); }
    const pose = poseOf(W, F, clipsFor(who));
    a.drive({ x: F.x, z: F.z, face: face ?? F.face, pose: { ...pose, anim: down && !pose.anim ? "knockdown" : pose.anim }, dt: 1 / 60 });
    // render in the actor's own frame at the plate camera's orientation and scale, feet on (x, y)
    const cosE2 = Math.cos(cam.elevDeg * D2R), truePpm = ppm / cosE2, hM = 2.9, h = Math.ceil(hM * truePpm), w = Math.ceil(h * 0.95), P = a.pos;
    const R = rigAt(at, lights, darkness || 0);
    const r = a.render({ yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, height: hM, centre: [P[0], P[1] + 1.05, P[2]] }, w, h, R.rig, { ss, tone: R.tone });
    const feetDown = 1.05 * cosE2 * truePpm, ox = Math.round(x - r.w / 2), oy = Math.round(y - feetDown - r.h / 2);
    const img = new ImageData(r.w, r.h), d = img.data, G = r.G, fw = fwdOf(cam);
    for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) {
      const i = py * r.w + px, al = r.rgba[i * 4 + 3]; if (al <= 0) continue;
      // hidden where the painted room stands in front: the pixel's own depth from the figure's
      if (depthAt && depth != null) {
        const gi = py * ss * G.w + px * ss, dz = G.id[gi] && at ? depth + (G.wp[gi * 3] - at[0]) * fw[0] + (G.wp[gi * 3 + 1] - at[1]) * fw[1] + (G.wp[gi * 3 + 2] - at[2]) * fw[2] : depth;
        if (depthAt(ox + px, oy + py) < dz - 0.35) continue;
      }
      let lift = 1;
      if (look.has("lift")) { const gi = py * ss * G.w + px * ss; if (LIFT_IDS.has(G.id[gi])) lift = 1.75; }   // faces and hands catch the light
      for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(Math.max(0, Math.min(1, r.rgba[i * 4 + k] * lift + (lift > 1 ? 0.05 : 0))) * 255); d[i * 4 + 3] = Math.round(al * 255);
    }
    if (look.has("outline")) {   // a thin line of the ruling light just outside the silhouette
      const rc = R.rig.fresnel ? R.rig.fresnel.c.map((v) => Math.min(1, v * 2.4)) : [0.9, 0.8, 0.6], src = new Uint8ClampedArray(d), wpx = Math.max(1, Math.round(truePpm / 70));
      for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) { const i = py * r.w + px; if (src[i * 4 + 3] > 40) continue; let hit = false;
        for (let dy = -wpx; dy <= wpx && !hit; dy++) for (let dx = -wpx; dx <= wpx; dx++) { const X = px + dx, Y = py + dy; if (X < 0 || Y < 0 || X >= r.w || Y >= r.h) continue; if (src[(Y * r.w + X) * 4 + 3] > 200) { hit = true; break; } }
        if (hit) { d[i * 4] = rc[0] * 255; d[i * 4 + 1] = rc[1] * 255; d[i * 4 + 2] = rc[2] * 255; d[i * 4 + 3] = 170; } }
    }
    const c = (drawFighter.scratch ||= new OffscreenCanvas(8, 8)); c.width = r.w; c.height = r.h; c.getContext("2d").putImageData(img, 0, 0);
    g.save();
    const sr = look.has("shadow") ? 0.62 : 0.42, sa = look.has("shadow") ? 0.72 : 0.45;
    if (look.has("pool")) { const gr = g.createRadialGradient(x, y, 0, x, y, 0.9 * truePpm); gr.addColorStop(0, "rgba(255,220,170,0.28)"); gr.addColorStop(1, "rgba(255,220,170,0)"); g.save(); g.scale(1, Math.sin(cam.elevDeg * D2R)); g.fillStyle = gr; g.beginPath(); g.arc(x, y / Math.sin(cam.elevDeg * D2R), 0.9 * truePpm, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.fillStyle = `rgba(8,4,10,${sa})`; g.beginPath(); g.ellipse(x, y, sr * truePpm, sr * truePpm * Math.sin(cam.elevDeg * D2R), 0, 0, Math.PI * 2); g.fill();   // contact shadow
    // telegraph: an opponent's wind-up on a move combat marks with a tell gets a pale ring at the feet
    const m = F.act && W.moves ? W.moves[F.act.id] : null;
    if (F.team !== "lamb" && m && m.tell && F.act.f >= m.tell.at[0] && F.act.f < m.tell.at[1]) {
      const k = (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]);
      g.strokeStyle = `rgba(240,232,214,${0.35 + 0.5 * k})`; g.lineWidth = Math.max(1.5, truePpm * 0.03); g.beginPath(); g.ellipse(x, y, 0.6 * truePpm * (1.3 - 0.3 * k), 0.6 * truePpm * (1.3 - 0.3 * k) * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.drawImage(c, ox, oy); g.restore();
  };
}
