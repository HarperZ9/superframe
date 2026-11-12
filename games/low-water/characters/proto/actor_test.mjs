// Drives the actor runtime both ways (combat's clock, the actor's own clock) and checks what it reports.
// node proto/actor_test.mjs   (prints a log; exits non-zero on a failed expectation)
import { readFileSync, existsSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import * as lamb from "../cast/lamb.mjs";
import * as fennick from "../cast/fennick.mjs";
import * as marrow from "../cast/marrow.mjs";
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const cast = createCast({ timing, combat, members: { lamb, fennick, marrow } }), L = cast.library, dt = 1 / 30;
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
expect(!!combat, "combat's timing export is present and read");
const Tl = L.timing("lamb", "light.light_1");
expect(combat ? Tl.startup === combat.lamb["light.light_1"].startup : true, `light.light_1 takes combat's startup (${Tl.startup} frames at 30 fps)`);
// own clock: a stick string with cancel windows
const a = cast.actor("lamb", { tool: "stick" });
expect(a.play("light_1"), "light_1 starts from idle and resolves to the stick's class clip");
expect(a.state.clip === "light.light_1", `clip is ${a.state.clip}`);
const log = []; for (let i = 0; i < Tl.startup + Tl.active + 1; i++) { const e = a.update(dt); log.push(e.phase[0] + (e.hit ? "*" : "")); }
console.log("light.light_1 phases:", log.join(" "));
expect(log.filter((p) => p.endsWith("*")).length === Tl.active, `hit frames = active (${Tl.active})`);
// combat's clock: drive with t, the art follows; facing converts from combat's radians
const b = cast.actor("lamb", { tool: "boathook" }), table = cast.clips("lamb"), clip = table["lamb.long.heavy"];
expect(!!clip && clip.phases.some((p) => p.name === "windup"), "the clip table names phases windup, active, recovery for drive.mjs");
for (let i = 0; i < 20; i++) b.drive({ x: 2, z: 3, face: 0, pose: { clip: "lamb.heavy", anim: "heavy", t: clip.phases[0].to } });   // past the 5-frame fade in; the windup phase ends on the held top (the sweep follows)
expect(b.state.clip === "long.heavy" && Math.abs(b.state.frame - clip.phases[0].to * 30) < 1e-6, "drive shows long.heavy at the held top, the end of its windup phase (the sweep carries the arc after it)");
expect(Math.abs(b.facing - 90) < 1e-9 && b.pos[0] === 2 && b.pos[2] === 3, "combat face 0 (toward +x) is art facing 90; position taken from combat");
const w = b.weapon(); expect(w.cls === "long" && w.tip[1] > 1.8, `at the held top the boathook's tip is overhead (y ${w.tip[1].toFixed(2)} m)`);
// two-handed grip: the left wrist ends on the shaft
const S = b.skeleton(), hl = S[17 - 4], dL = Math.hypot(...[0, 1, 2].map((k) => S[9].p[k] - (S[13].p[k])));
expect(dL < 0.9, `left and right wrists within the grip span on the boathook (${dL.toFixed(2)} m)`);
// directional dodges exist for every combat dodge
for (const m of ["step", "roll_dash", "roll", "roll_hop", "lurch"]) for (const d of "fblr") if (!L.clips[`${m}_${d}`]) expect(false, `missing ${m}_${d}`);
expect(true, "every combat dodge has f, b, l and r clips");
// every clip combat lists for lamb resolves to an art clip
if (combat) { const miss = Object.keys(combat.lamb).filter((n) => !L.clips[n] && !L.clips[n.replace(/_[fblr]$/, "")] && !["step", "roll_dash", "roll", "roll_hop", "lurch"].includes(n)); expect(miss.length === 0, `combat's Lamb clips all have art (${miss.join(", ") || "none missing"})`); }
// retiming: change combat's startup; the clip length follows with no re-keying
const c2 = JSON.parse(JSON.stringify(combat || { lamb: {} })); c2.lamb["light.light_1"] = { ...(c2.lamb["light.light_1"] || {}), startup: 14, active: 2, recovery: 11 };
expect(createCast({ timing, combat: c2, members: { lamb } }).library.length("lamb", "light.light_1") === 27, "a startup change in combat's numbers changes the clip, no re-keying");
// every clip of every member samples finite
for (const who of ["lamb", "fennick", "marrow"]) for (const name of Object.keys(L.clips)) {
  const n = L.length(who, name); let bad = false;
  for (let f = 0; f < n; f += 3) { const p = L.pose(who, name, f); for (const [j, c] of Object.entries(p)) if (!Array.isArray(c)) for (const v of Object.values(c)) if (!Number.isFinite(v)) bad = true; }
  if (bad) expect(false, `${who} ${name} has a non-finite channel`);
}
expect(true, `all ${Object.keys(L.clips).length} clips sample finite for all three members`);
process.exitCode = fails ? 1 : 0;
