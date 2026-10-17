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

  return function drawFighter(g, F, { x, y, ppm, face, down, W }) {
    const who = bodyOf(W, F);
    let a = actors.get(F.id);
    if (!a) { a = cast.actor(who, { tool: toolOfDef(W, F, who) }); actors.set(F.id, a); }
    const pose = poseOf(W, F, clipsFor(who)), at = arguments[2].at;   // at: the fighter's world point, when the layer passes it
    a.drive({ x: F.x, z: F.z, face: face ?? F.face, pose: { ...pose, anim: down && !pose.anim ? "knockdown" : pose.anim }, dt: 1 / 60 });
    // render in the actor's own frame at the plate camera's orientation and scale, feet on (x, y)
    const truePpm = ppm / cosE, hM = 2.9, h = Math.ceil(hM * truePpm), w = Math.ceil(h * 0.95), P = a.pos;
    const r = a.render({ yawDeg: camera.yawDeg, elevDeg: camera.elevDeg, height: hM, centre: [P[0], P[1] + 1.05, P[2]] }, w, h, rig, { ss, tone });
    const feetDown = 1.05 * cosE * truePpm, ox = Math.round(x - r.w / 2), oy = Math.round(y - feetDown - r.h / 2);
    const img = new ImageData(r.w, r.h), d = img.data;
    for (let i = 0; i < r.w * r.h; i++) { for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(Math.max(0, Math.min(1, r.rgba[i * 4 + k])) * 255); d[i * 4 + 3] = Math.round(r.rgba[i * 4 + 3] * 255); }
    const c = (drawFighter.scratch ||= new OffscreenCanvas(8, 8)); c.width = r.w; c.height = r.h; c.getContext("2d").putImageData(img, 0, 0);
    g.save();
    // contact shadow
    g.fillStyle = "rgba(8,4,10,0.45)"; g.beginPath(); g.ellipse(x, y, 0.42 * truePpm, 0.42 * truePpm * Math.sin((camera.elevDeg * Math.PI) / 180), 0, 0, Math.PI * 2); g.fill();
    // telegraph: an opponent's wind-up on a move combat marks with a tell gets a pale ring at the feet
    const m = F.act && W.moves ? W.moves[F.act.id] : null;
    if (F.team !== "lamb" && m && m.tell && F.act.f >= m.tell.at[0] && F.act.f < m.tell.at[1]) {
      const k = (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]);
      g.strokeStyle = `rgba(240,232,214,${0.35 + 0.5 * k})`; g.lineWidth = Math.max(1.5, truePpm * 0.03); g.beginPath(); g.ellipse(x, y, 0.6 * truePpm * (1.3 - 0.3 * k), 0.6 * truePpm * (1.3 - 0.3 * k) * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.drawImage(c, ox, oy); g.restore();
  };
}
