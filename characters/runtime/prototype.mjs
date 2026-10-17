// The people layer of the Canvas 2D prototype (game/main.mjs): the built cast drawn as skinned
// figures through draw2d.mjs, the rest of the cast still as figures.mjs cutouts until their bodies
// exist. Walking and idling outside fights (the actor plays its loops by the ground covered, so feet
// stay planted at the shell's walking speed), a talk gesture now and then while a conversation is
// open. In a fight the combat layer drives each actor with drive({ x, z, face, pose }).
//   const people = await createPeople();
//   people.step(dt, figs, { talking, speaker })   figs: [{ who, pos, walking, face }]
//   people.draw(g, scratch, figs, { room, world, W, H, cam, view, fallback, light, fade })
import { createCast } from "./actor.mjs";
import { drawActor } from "./draw2d.mjs";
import { RIGS } from "../render/rigs.mjs";
import * as lamb from "../cast/lamb.mjs";
import * as fennick from "../cast/fennick.mjs";
import * as marrow from "../cast/marrow.mjs";
import * as warden from "../cast/warden.mjs";
import * as salvor from "../cast/salvor.mjs";

const D2R = 180 / Math.PI, TALK = ["talk_a", "talk_b", "talk_c"];
// rigs by room; the lamp room is lit by the arc (white) or by paraffin when it is dark
const DARK = { amb: [0.05, 0.045, 0.07], ground: [0.02, 0.02, 0.03], key: { dir: [0.3, 0.8, -0.5], c: [0.06, 0.06, 0.09], wrap: 0.3 } };
const LAMP_ROOM = { amb: [0.12, 0.12, 0.11], ground: [0.04, 0.05, 0.04], key: { dir: [-0.4, 0.7, 0.4], c: [0.7, 0.72, 0.68], wrap: 0.3 }, fresnel: { c: [0.15, 0.2, 0.16], pow: 3 } };

export async function createPeople({ base = "/characters/", combatUrl = "/engine/combat/out/timing.combat.json" } = {}) {
  const timing = await (await fetch(base + "anim/timing.json")).json();
  let combat = null; try { const r = await fetch(combatUrl); if (r.ok) combat = await r.json(); else console.warn("people: no combat timing at", combatUrl, r.status); } catch (e) { console.warn("people: combat timing not loaded:", e.message); }
  const cast = createCast({ timing, combat, members: { lamb, fennick, marrow, warden, salvor } }), actors = {}, last = {}, gesture = {}, st = {};
  const actorOf = (who) => (cast.library && { lamb, fennick, marrow, warden, salvor }[who] ? (actors[who] ||= cast.actor(who)) : null);

  function step(dt, figs, { talking = false, speaker = null } = {}) {
    for (const f of figs) {
      const a = actorOf(f.who); if (!a) continue;
      const prev = last[f.who] || f.pos, dx = f.pos[0] - prev[0], dz = f.pos[2] - prev[2];
      if (Math.hypot(dx, dz) > 1e-4) a.facing = Math.atan2(dx, dz) * D2R;
      else if (f.faceDeg != null) a.facing = f.faceDeg;
      a.state.pos[1] = f.pos[1];
      // a gesture plays on the actor's own clock; loops follow the ground the shell moved the figure
      const g = gesture[f.who];
      if (g && g.left > 0 && !f.walking) { g.left -= dt; a.update(dt); a.state.pos[0] = f.pos[0]; a.state.pos[2] = f.pos[2]; }
      else {
        if (talking && !f.walking && (f.who === "lamb" || f.who === speaker) && Math.random() < dt / 4) {
          a.state.pos[0] = f.pos[0]; a.state.pos[2] = f.pos[2]; a.play(TALK[Math.floor(Math.random() * TALK.length)], { force: true, fade: 6 });
          gesture[f.who] = { left: a.library.length(f.who, a.state.clip) / 30 };
        } else {
          // walk under about 2 m/s, run above: the loop plays by the ground covered either way
          const v = dt > 0 ? Math.hypot(dx, dz) / dt : 0, sp = (st[f.who] = (st[f.who] ?? v) * 0.8 + v * 0.2);
          a.drive({ x: f.pos[0], z: f.pos[2], pose: { anim: f.walking ? (sp > 2.0 ? "run" : "walk") : "idle", loop: true }, dt });
        }
      }
      last[f.who] = [...f.pos];
    }
  }

  function draw(g, scratch, figs, ctx) {
    const out = [];
    for (const f of figs) {
      const a = actorOf(f.who);
      if (!a) { out.push(ctx.fallback(f)); continue; }
      const room = RIGS[ctx.room] ? ctx.room : "brine", R = ctx.room === "lamp" ? { rig: LAMP_ROOM, tone: null } : ctx.fade > 0.5 ? { rig: DARK, tone: null } : RIGS[room];
      out.push(drawActor(g, scratch, a, { world: ctx.world, W: ctx.W, H: ctx.H, cam: ctx.cam, rig: R.rig, tone: R.tone, view: ctx.view }));
    }
    return out;
  }
  return { step, draw, actors, cast, has: (who) => !!actorOf(who) };
}
