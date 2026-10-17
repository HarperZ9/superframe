// The figure drawer's body choice and its fallback for an id with no cast data (a content typo).
// node proto/drawer_test.mjs   (prints a log; exits non-zero on a failed expectation)
import { readFile } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
globalThis.fetch = async (u) => {   // the drawer fetches /characters/... and /engine/...; served here from disk
  const path = String(u).replace(/^\/engine\//, "game/engine/").replace(/^\//, "");
  try { const t = await readFile(new URL(path, root), "utf8"); return { ok: true, json: async () => JSON.parse(t) }; } catch { return { ok: false, status: 404, json: async () => null }; }
};
const { makeFightDrawer } = await import("../runtime/fightdrawer.mjs");
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
const warns = []; const warn0 = console.warn; console.warn = (...a) => warns.push(a.join(" "));
const draw = await makeFightDrawer({ poseOf: (W, F) => F.pose || { anim: "idle", loop: true }, actorOf: (W, F) => (F.person ? F.who : F.id) });
const W = { defs: {}, moves: {} };
expect(draw.bodyOf(W, { id: "sabine", who: "sabine", person: true }) === "sabine", "a cast member draws as its own body (sabine), not an archetype's");
expect(draw.bodyOf(W, { id: "keel", who: "keel", person: true }) === "keel", "keel draws as keel");
expect(draw.bodyOf(W, { id: "lamb", who: "lamb", person: true, team: "lamb" }) === "lamb", "lamb draws as lamb");
expect(draw.bodyOf(W, { id: "f.x#0", team: "foe" }) === "warden", "a foe with no body of its own takes the warden archetype");
// a typo'd person: drawn as the neutral placeholder, warned once, no throw
const calls = []; const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push(k)), set: (t, k, v) => { t[k] = v; return true; } });
const F = { id: "sabien", who: "sabien", person: true, team: "town", x: 0, z: 0, face: 0, pose: { anim: "idle", loop: true } };
const args = { x: 100, y: 200, ppm: 120, at: [0, 0, 0], cam: { yawDeg: 34, elevDeg: 34 }, W, lights: [] };
let r = null, threw = null; try { r = draw(g, F, args); draw(g, F, args); } catch (e) { threw = e; }
expect(!threw, `an unknown figure id does not throw${threw ? ` (${threw.message})` : ""}`);
expect(r === "placeholder" && calls.includes("ellipse") && calls.includes("arc"), "an unknown figure id draws the neutral placeholder (body, head and contact shadow)");
expect(warns.filter((w) => w.includes('"sabien"')).length === 1, `the unknown id is logged once (${warns.length} warning(s))`);
console.warn = warn0;
process.exit(fails ? 1 : 0);
