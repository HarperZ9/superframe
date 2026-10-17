// The clip library and its timing: one place the renderer, the reel and the game read from.
//   const L = await library();   L.clip("light_1"), L.timing("lamb", "light_1"), L.pose("lamb", "light_1", frame)
import { sample, events, layout } from "./pose.mjs";
import { solve, INDEX } from "../rig/skeleton.mjs";
import { applyGait, gaitSpeed, GAITS, blendGait } from "./gait.mjs";
import * as loco from "./locomotion.mjs";
import { COMBAT } from "./combat.mjs";
import { FRAY, GUARDS, STYLE_OF } from "./fray.mjs";
import { SPECIALS } from "./specials.mjs";
import { ART_CLIPS } from "./arts.mjs";

export const CLIPS = Object.fromEntries([loco.idle, loco.walk, loco.run, loco.turn, loco.stop, loco.talkA, loco.talkB, loco.talkC, loco.examine, loco.wade, loco.turnRun, ...COMBAT, ...FRAY].map((c) => [c.name, c]));
// Strike shaping, for every phased attack: the swing launches before the hit window opens (the end
// of the windup is already a third of the way into the swing, the held windup pose moves back to
// 70 % of startup), and it carries through after it closes (a follow-through key past the contact
// pose early in recovery). Without this a fast build's two- or three-frame active window covered
// the whole arc in a frame or two.
const mixPose = (a, b, t) => { const o = {}; for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) { if (Array.isArray(a[j]) || Array.isArray(b[j])) { o[j] = (t < 0.5 ? a[j] : b[j]) ?? a[j] ?? b[j]; continue; } o[j] = {}; for (const k of new Set([...Object.keys(a[j] || {}), ...Object.keys(b[j] || {})])) o[j][k] = (a[j]?.[k] ?? 0) * (1 - t) + (b[j]?.[k] ?? 0) * t; } return o; };
function shapeStrike(c) {
  if (!c.phases || !c.tags?.includes("attack") || c.shaped) return c;
  const keys = c.keys.map((k) => ({ ...k })), at = (k) => (Array.isArray(k.at) ? k.at : null);
  const iTop = keys.findIndex((k) => at(k) && at(k)[0] === "s" && at(k)[1] === 1), act = keys.filter((k) => at(k) && at(k)[0] === "a");
  if (iTop < 0 || !act.length) return c;
  const top = keys[iTop].pose, hit = act[0].pose, last = act[act.length - 1].pose;
  // the swing ramps up over the last third of the windup (16 % of the arc by 0.86, 48 % by its end),
  // so the hand accelerates over several frames instead of leaving a hold at full speed
  // Most of the arc travels in the last frames of the wind-up (20 % by 0.76, 52 % by 0.9, 82 % at its
  // end), so the 2 to 3 active frames cover only the contact part of the swing. Combat's frame counts
  // are unchanged; its warp still lands the windup's end on its last startup frame.
  // With combat's sweep (its last wind-up frames, where the arc travels), the clip gets a `sweep` phase:
  // the windup ends on the held top, the sweep carries the arc (20 %, 52 %, 82 %), active is contact.
  keys[iTop] = { at: ["s", 1], pose: top };
  keys.push({ at: ["w", 0.33], pose: mixPose(top, hit, 0.2) }, { at: ["w", 0.66], pose: mixPose(top, hit, 0.52) }, { at: ["w", 1], pose: mixPose(top, hit, 0.82) });
  c = { ...c, phases: ["startup", "sweep", "active", "recovery"] };
  // follow-through: the swing carries on past contact and slows over several frames, rather than
  // stopping dead on the last active frame
  if (!keys.some((k) => at(k) && at(k)[0] === "r" && at(k)[1] < 0.3)) keys.push({ at: ["r", 0.14], pose: mixPose(last, top, -0.12) });
  return { ...c, keys, shaped: true, smooth: true };
}
for (const [k, c] of Object.entries(CLIPS)) CLIPS[k] = shapeStrike(c);
// The opponent archetypes' own moves (anim/specials.mjs).
for (const c of SPECIALS) CLIPS[c.name] = shapeStrike(c);
for (const c of ART_CLIPS) CLIPS[c.name] = shapeStrike(c);   // tool specials and running strikes (anim/arts.mjs)
// Combat's actor ids for the art's cast (an @foe's char: id, else its archetype; NOTES, combat engineer).
export const COMBAT_ACTOR = { lamb: "lamb", warden: "holder", salvor: "skirmisher", fennick: "fennick", marrow: "marrow" };

// timing: the art's timing.json (lengths for calm clips, first guesses for combat). combat: combat's
// export (game/engine/combat/out/timing.combat.json), authoritative for every clip it names. A
// directional clip (roll_l) takes its move's numbers (roll).
// Foot sliding: a loop's ground speed is measured from the clip itself. Over one cycle, the planted
// foot (the lower one) moves backward under the body; the body must travel forward at that rate for
// the foot to stay put. bodies: { who: proportions } (the cast's P records).
function plantedSpeed(clip, T, P, base = {}) {
  const n = 60, len = layout(clip, T).length, fps = 30, smp = [];
  for (let k = 0; k <= n; k++) { const S = solve(P, sample(clip, T, (k / n) * len, base)); smp.push({ L: S[INDEX.footL].p, R: S[INDEX.footR].p, y: S[0].p[1] }); }
  // a foot counts as planted when it is within 3 cm of the lowest any foot gets over the cycle
  // (heights relative to the root, since the root bobs and the clip is rendered with feet on the floor)
  const rel = (q, f) => q[f][1] - q.y + smp[0].y, lo = Math.min(...smp.flatMap((q) => [rel(q, "L"), rel(q, "R")]));
  let dist = 0, time = 0;
  for (let k = 1; k <= n; k++) for (const f of ["L", "R"]) {
    if (rel(smp[k], f) < lo + 0.03 && rel(smp[k - 1], f) < lo + 0.03) { dist += smp[k - 1][f][2] - smp[k][f][2]; time += len / n / fps; }
  }
  return time > 0 ? Math.max(0, dist / time) : 0;
}
export function makeLibrary(timing, styles = {}, combat = null, bodies = {}) {
  const speeds = {};
  const art = (who, name) => ({ ...(timing.default[name] || {}), ...((timing[who] || {})[name] || {}) });
  const T = (who, name) => {
    const a = art(who, name), base = name.replace(/_[fblr]$/, ""), cw = combat && (combat[COMBAT_ACTOR[who]] || combat.lamb);
    const c = cw && (cw[name] || cw[base]); if (c) return { ...c, art: a.startup != null ? a : art(who, base) };
    if (GAITS[name] && bodies[who]) return { ...a, speed: gaitSpeed(bodies[who], GAITS[name], a.frames || CLIPS[name].frames), speedTiming: a.speed };
    if (CLIPS[name]?.loop && a.speed != null && bodies[who] && !a.speedFixed) {
      const k = who + "|" + name; if (speeds[k] == null) speeds[k] = plantedSpeed(CLIPS[name], a, bodies[who]) || a.speed;
      return { ...a, speed: speeds[k], speedTiming: a.speed };
    }
    return a;
  };
  return {
    clips: CLIPS, timing: T,
    length: (who, name) => layout(CLIPS[name], T(who, name)).length,
    // pose at a frame, with root motion resolved (zf, xf times move) and the character's style applied
    pose(who, name, f) {
      const c = CLIPS[name], t = T(who, name), p = sample(c, t, f), r0 = p.root || (p.root = {}), mv = t.move || 0;
      if (GAITS[name] && bodies[who]) applyGait(p, GAITS[name], bodies[who], f, t.frames || c.frames);
      const r = p.root;
      r.z = (r.z || 0) + (r.zf || 0) * mv; r.x = (r.x || 0) + (r.xf || 0) * mv; delete r.zf; delete r.xf;
      const st = styles[who]; return st ? st(p, c) : p;
    },
    // locomotion at speed v (m/s), cycle phase u (0..1): the walk and run clips' upper bodies blended
    // by speed, the legs solved from the blended gait. Returns { pose, cycle } (cycle: metres per cycle).
    loco(who, v, u) {
      const P = bodies[who], { g, w, cycle } = blendGait(P, v), cw = CLIPS.walk, cr = CLIPS.run;
      const tw = T(who, "walk"), tr = T(who, "run"), pw = sample(cw, tw, u * layout(cw, tw).length), pr = sample(cr, tr, u * layout(cr, tr).length), p = {};
      for (const j of new Set([...Object.keys(pw), ...Object.keys(pr)])) { p[j] = {}; for (const k of new Set([...Object.keys(pw[j] || {}), ...Object.keys(pr[j] || {})])) p[j][k] = (pw[j]?.[k] ?? 0) * (1 - w) + (pr[j]?.[k] ?? 0) * w; }
      // the gait solves the legs in the hip's plane; a turning pelvis would swing a planted foot sideways,
      // so the twist moves up to the chest (counter-rotation stays visible) and the pelvis stays square
      if (p.pelvis) { p.chest = { ...(p.chest || {}), turn: (p.chest?.turn || 0) + (p.pelvis.turn || 0) * 0.6 }; p.pelvis = { ...p.pelvis, turn: 0, side: 0 }; }
      applyGait(p, g, P, u * 24, 24); p.root.x = 0; p.root.z = 0;
      const st = styles[who]; return { pose: st ? st(p, cw) : p, cycle, w };
    },
    events: (who, name, f) => events(CLIPS[name], T(who, name), f),
  };
}
// Node only: read timing.json beside this file. (The browser fetches it and calls makeLibrary.)
export function library(styles, bodies = {}) {
  const fs = globalThis.process?.getBuiltinModule?.("node:fs"); if (!fs) throw new Error("library() reads timing.json from disk; in a browser call makeLibrary(await (await fetch(url)).json())");
  const combatFile = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url);   // combat's export, read only
  const combat = fs.existsSync(combatFile) ? JSON.parse(fs.readFileSync(combatFile, "utf8")) : null;
  return makeLibrary(JSON.parse(fs.readFileSync(new URL("./timing.json", import.meta.url), "utf8")), styles, combat, bodies);
}
