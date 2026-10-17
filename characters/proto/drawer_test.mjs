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
// a held pole kept inside the clear reach ahead: Gorm's staff against a wall 0.3 m ahead
{ const { createCast } = await import("../runtime/actor.mjs"), { GORM } = await import("../cast/lamplighter.mjs");
  const timing = JSON.parse(await readFile(new URL("characters/anim/timing.json", root), "utf8")), cast = createCast({ timing, combat: null, members: { gorm: GORM } });
  const a = cast.actor("gorm"); a.play("idle"); a.update(1 / 30);
  const f = (a.facing * Math.PI) / 180, ahead = () => { const w = a.weapon(); return (w.tip[0] - a.pos[0]) * Math.sin(f) + (w.tip[2] - a.pos[2]) * Math.cos(f); };
  const free = ahead(); let k = 0; for (let i = 0; i < 40; i++) k = draw.keepToolClear(a, 0.3);
  expect(free > 0.3 && ahead() <= 0.32, `Gorm's pole pulled inside a 0.3 m reach (tip ahead ${free.toFixed(2)} m free, ${ahead().toFixed(2)} m clamped, wrist ${k.toFixed(0)} degrees)`);
  for (let i = 0; i < 40; i++) k = draw.keepToolClear(a, 2.2);
  expect(Math.abs(k) < 1 && Math.abs(ahead() - free) < 0.02, "with room again the wrist eases back to the clip's own pose"); }
// solo: the visual check draws a figure alone and reads back its per-pixel depth
{ const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.ImageData ||= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
  globalThis.OffscreenCanvas ||= class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return { putImageData() {} }; } };
  const P = { id: "keel", who: "keel", person: true, team: "town", x: 0, z: 0, face: 0, pose: { anim: "idle", loop: true } };
  const res = draw(ctx, P, { x: 400, y: 500, ppm: 120, at: [0, 0, 0], depth: 30, cam: { yawDeg: 34, elevDeg: 34 }, W, lights: [], solo: true });
  const vals = res && res.depth ? [...res.depth].filter((v) => v === v) : [];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  expect(!!res && res.depth.length === res.w * res.h && vals.length > 500, `solo returns a per-pixel depth image (${res ? res.w + "x" + res.h : "none"}, ${vals.length} drawn pixels)`);
  expect(vals.length && lo > 28.5 && hi < 31, `drawn depths sit round the figure's own (30): ${lo.toFixed(2)} to ${hi.toFixed(2)} (the head nearer than the feet)`); }
process.exit(fails ? 1 : 0);
