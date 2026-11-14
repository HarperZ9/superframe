// The animation bounds (characters/notes/ANIM-BOUNDS.md) as a test, with the controls that must fail.
//   node proto/anim_bounds_test.mjs        (about 40 s; exits non-zero on a failed expectation)
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { light } from "../render/shade.mjs";
import { BY_ID } from "../rig/materials.mjs";
import * as lamb from "../cast/lamb.mjs";

let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
const here = (p) => new URL(p, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
mkdirSync(here("../out/"), { recursive: true });
const run = (script, args, out) => { execFileSync(process.execPath, [here(script), ...args, "--json", here(out)], { stdio: "pipe" }); return JSON.parse(readFileSync(here(out), "utf8")); };

// 1. foot lock: at most 1 cm of slide in any planted step; planted feet within 1.5 cm of the ground on slopes
const who = ["--who", "lamb,tomas,aaron"];
const on = run("./footlock_check.mjs", who, "../out/footlock-ik.json"), off = run("./footlock_check.mjs", [...who, "--ik", "off"], "../out/footlock-ikoff.json");
const vert = Math.max(...on.rows.map((r) => r.vert)), steps = on.rows.reduce((s, r) => s + r.steps, 0);
expect(on.worst <= 0.01, `foot lock: worst step slide ${(on.worst * 100).toFixed(2)} cm over ${steps} steps (bound 1 cm)`);
expect(vert <= 0.015, `foot lock: worst planted-foot height error ${(vert * 100).toFixed(2)} cm, slopes included (bound 1.5 cm)`);
expect(on.rows.every((r) => r.steps >= 2), "every scenario has planted steps to measure (a lock that lifted every foot would show here)");
const hard = off.rows.filter((r) => /start|stop|turn|circle|slope|accel/.test(r.name)), offOver = hard.filter((r) => r.max > 0.01 || r.vert > 0.015);
expect(offOver.length === hard.length, `control, locks off: every start, stop, turn, curve, slope and acceleration scenario breaks a bound (${offOver.length} of ${hard.length}; worst ${(off.worst * 100).toFixed(1)} cm)`);

// 2 and 3. fades: no step in any joint's speed at the edges of a fade, every locomotion and combat pair
const T = ["--ang", "2", "--pos", "3"];
const sm = run("./blend_check.mjs", [...T, "--curve", "smooth"], "../out/blend-smooth.json"), lin = run("./blend_check.mjs", [...T, "--curve", "linear", "--wrap", "old"], "../out/blend-linear.json");
const ly = run("./blend_check.mjs", [...T, "--curve", "smooth", "--layer"], "../out/blend-layer.json");
expect(sm.over === 0, `cross-fades: ${sm.n} transitions, worst edge ${sm.worstAng.toFixed(2)} deg/frame^2 and ${sm.worstPos.toFixed(2)} cm/frame^2 (bounds 2 and 3); ${sm.over} over`);
expect(ly.over === 0, `upper-body layer fades: ${ly.n} transitions, worst edge ${ly.worstAng.toFixed(2)} deg/frame^2, ${ly.worstPos.toFixed(2)} cm/frame^2; ${ly.over} over`);
expect(lin.over > lin.n * 0.5, `control, the old linear fade and per-frame wrap: ${lin.over} of ${lin.n} over (worst ${lin.worstAng.toFixed(1)} deg/frame^2)`);

// 4. layering in the actor: the legs are the walk's, the arm is the strike's, the hit window is reported
const timing = JSON.parse(readFileSync(here("../anim/timing.json"), "utf8"));
import { existsSync } from "node:fs";
const cf = here("../../game/engine/combat/out/timing.combat.json"), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const mk = () => { const c = createCast({ timing, combat, members: { lamb } }), a = c.actor("lamb", { tool: "stick" }); a.play("walk", { force: true }); a.state.vWant = 1.5; return { a, L: c.library }; };
const { a: A, L } = mk(), { a: B } = mk();
let legDiff = 0, armDiff = 0, hits = 0, upperSeen = 0;
for (let f = 0; f < 150; f++) {
  if (f === 40) A.playUpper("light_1");
  const e = A.update(1 / 60); B.update(1 / 60);
  if (e.upper) { upperSeen++; if (e.upper.hit) hits++; }
  const SA = A.skeleton(), SB = B.skeleton(), d = (j) => Math.hypot(...[0, 1, 2].map((i) => A.toWorld(SA[INDEX[j]].p)[i] - B.toWorld(SB[INDEX[j]].p)[i]));
  legDiff = Math.max(legDiff, d("footL"), d("footR"), d("shinL"), d("shinR"), d("pelvis")); armDiff = Math.max(armDiff, d("handR"));
}
const Tl = L.timing("lamb", "light.light_1");
expect(legDiff < 0.001, `a strike over a walk leaves the legs and hips where the walk has them (largest difference ${(legDiff * 1000).toFixed(2)} mm)`);
expect(armDiff > 0.25, `the strike moves the tool hand (up to ${armDiff.toFixed(2)} m from the walk's)`);
expect(Math.abs(hits - 2 * Tl.active) <= 1, `the upper layer reports its hit window: ${hits} ticks at 60 Hz for ${Tl.active} active frames at 30`);
expect(A.state.up === null && upperSeen > 0, "the upper layer ends and clears itself after its fade-out");

// additive lean: into a curve, none on a straight line
let toCentre = 0;
const lean = (curve) => { const c = createCast({ timing, members: { lamb } }), a = c.actor("lamb"); let s = 0; for (let f = 0; f < 240; f++) { const t = f / 60, w = curve ? 3.6 / 4 : 0; const x = curve ? 4 * Math.cos(w * t) : 0, z = curve ? 4 * Math.sin(w * t) : 3.6 * t; a.drive({ x, z, face: curve ? w * t + Math.PI / 2 : Math.PI / 2, pose: { anim: "run", loop: true }, dt: 1 / 60 }); if (f > 120) { s += a.state.lean.state.side; if (curve) { const r = a.state.facing * Math.PI / 180, dx = -a.pos[0], dz = -a.pos[2]; toCentre += Math.cos(r) * dx - Math.sin(r) * dz; } } } return s / 119; };
const lc = lean(true), ls = lean(false);
expect(Math.abs(lc) > 3 && Math.sign(lc) === Math.sign(toCentre) && Math.abs(ls) < 0.5, `lean: ${lc.toFixed(1)} deg toward the centre of a 4 m curve at 3.6 m/s (the centre lies to the ${toCentre > 0 ? "left" : "right"}), ${ls.toFixed(2)} deg running straight`);

// 5. the shading table covers every material id (the Quota portraits crashed on ids 64 to 67)
const G = { w: 5, h: 1, id: new Uint8Array([64, 65, 66, 67, 4]), N: new Float32Array(15).fill(0.5), back: new Uint8Array(5) };
const rig = { amb: [0.2, 0.2, 0.2], ground: [0.1, 0.1, 0.1], key: { dir: [0, 1, 0], c: [1, 1, 1] } };
let ok = true; try { light(G, rig); } catch (e) { ok = false; console.log("  ", e.message); }
expect(ok && BY_ID.length > 64, `light() shades material ids 64 to 67 (table length ${BY_ID.length})`);
let threw = ""; try { light({ ...G, id: new Uint8Array([200, 4, 4, 4, 4]) }, rig); } catch (e) { threw = e.message; }
expect(/material id 200/.test(threw), "control: an id with no entry is named in the error, not a TypeError");

console.log(fails ? `${fails} failed` : "anim bounds: all pass"); process.exit(fails ? 1 : 0);
