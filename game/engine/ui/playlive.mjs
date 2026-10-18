// The play screen's live world and fights on the plate (split from ui/play.mjs): the real-time
// clock, interruptions, interrogation lines, voice barks, and the plate arena a fight runs on.
import { hudEl, meterMarks } from "./scene.mjs";
import { toast } from "./dom.mjs";
import { plateArena, snapClear } from "../combat/sim/plate.mjs";
import { PLATE_OF } from "../combat/data/plates.mjs";
import { fightFromScene, hardenGround, GROUND_CELL } from "../world/plateworld.mjs";

// Fights on a painted plate run on the plate's ground: the plate's arena handed to combat, laid
// where the scene stands (world/plateworld.mjs fightFromScene). Returns the figure ids it takes over.
export function usePlateFor(G, cam, id) {
  const C = G.ext.combat, enc = C && C.defs[id], pj = cam && cam.place && cam.place(), geo = cam && cam.geo && cam.geo();
  if (!enc || !pj || !geo || PLATE_OF[enc.area] !== pj.place) return { taken: [], aliases: {} };
  const S = fightFromScene(G, pj, id);
  try {
    const A = plateArena(pj, geo.pos, geo.ids, { datum: pj.datum || null, fight: S.fight, cell: GROUND_CELL });
    A.collision = hardenGround(A, pj, geo.pos, geo.ids, { margin: "soft" }); // props and tops closed; the body margin marked (cell.margin), not closed, so a fight has the plate's whole walkable ground (coordinator, 2026-10-17)
    A.spawns = { lamb: snapClear(A, A.spawns.lamb), foes: A.spawns.foes.map((f) => snapClear(A, f)) }; // clear of what hardening closed
    C.usePlate(enc.area, A);
  }
  catch (e) { console.warn(`fight ${id}: no plate arena on ${pj.place}: ${e.message}`); return { taken: [], aliases: {} }; }
  return S;
}

// The live world (author, 2026-10-17: "It should not be turn based, it should be live action").
// The night's clock runs in real time on the play screen (@rules world-clock-rate, real seconds a
// game minute, default 8 as in fights); a fight, sneak or run sets its own rate while it plays, and
// stepped mode (an accessibility setting) keeps the old standing world. As each minute passes: in a
// conversation at its menu, a due event or a filled meter cuts in at once (talk.interrupt); with no
// conversation, it plays; otherwise the HUD's clock and meters are redrawn.
export function liveWorld(ctx, P, api, root) {
  const G = ctx.G, rate = () => ((G.state.runMode || "full") === "stepped" ? 0 : +G.rs.rules["world-clock-rate"] || 8);
  const busy = () => root.classList.contains("fighting") || (G.runs && G.runs.current) || (G.sneaks && G.sneaks.current);
  const off = G.loop.add("worldclock", () => { if (!busy()) G.loop.clockRate = rate(); }, { order: 85 });
  const offTime = G.on("time", () => {
    if (busy()) return;
    if (P.talk && P.beat && P.beat.options && !P.ended) { const b = P.talk.interrupt(); if (b) return api.take(b); }
    else if (!P.talk && !P.ended) { const s = G.nextScene(); if (s) return api.startTalk(s.node); }
    api.els.hud.replaceChildren(hudEl(G)); api.els.edge.replaceChildren(...meterMarks(G));
  });
  // An interrogation is live: what the person says on their own clock (lies, tells) goes into the
  // panel as it is said; an outcome the clock reaches (silence ran out) plays without a press.
  const offBark = G.on("voice.bark", (e) => toast(e.name.toUpperCase(), e.text, 4200)); // a passive voice in the open
  const offSay = G.on("interrog.say", (L) => { if (!P.talk) return; P.log.push(L); api.render(); });
  const relie = () => { if (P.talk && P.beat && P.beat.interrogation && P.talk.interrogRefresh()) { P.beat = P.talk.beat; api.render(); } };
  const offLie = G.on("interrog.lie", relie), offLieClosed = G.on("interrog.lieclosed", relie);
  const offStart = G.on("interrog.start", (e) => { if (api.people && e.who) api.people.talkingWith(e.who); });
  const offEnd = G.on("interrog.end", () => queueMicrotask(() => { if (P.talk && P.beat && P.beat.interrogation && G.interrog.current && G.interrog.outcome()) { const b = P.talk.interrogResolve(); if (b) api.take(b); } }));
  return () => { off(); offTime(); offBark(); offSay(); offLie(); offLieClosed(); offStart(); offEnd(); G.loop.clockRate = 0; };
}
