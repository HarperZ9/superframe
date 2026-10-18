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
// a pole held across the body kept inside the room to each side (args.room), and no pole tip under the floor
{ const { createCast } = await import("../runtime/actor.mjs"), L = await import("../cast/lamplighter.mjs");
  const timing = JSON.parse(await readFile(new URL("characters/anim/timing.json", root), "utf8")), cast = createCast({ timing, combat: null, members: { fewell: L.FEWELL, strand: L.STRAND } });
  const side = (a) => { const w = a.weapon(), fa = ((90 - a.facing) * Math.PI) / 180, fx = Math.cos(fa), fz = Math.sin(fa); return [w.tip, w.butt].map((e) => -(e[0] - a.pos[0]) * fz + (e[2] - a.pos[2]) * fx); };
  const f = cast.actor("fewell"); f.play("idle"); f.update(1 / 30);
  const free = side(f); for (let i = 0; i < 40; i++) draw.keepToolClear(f, { ahead: 2.2, left: 0.45, right: 0.45 });
  const kept = side(f);
  expect(Math.max(...free.map(Math.abs)) > 0.3 && Math.max(...kept.map(Math.abs)) <= 0.47, `Fewell's pole across the body kept inside 0.45 m each side (ends at ${free.map((v) => v.toFixed(2)).join(", ")} free, ${kept.map((v) => v.toFixed(2)).join(", ")} kept)`);
  const s2 = cast.actor("strand"); s2.play("idle"); s2.update(1 / 30); const y0 = s2.weapon().tip[1];
  for (let i = 0; i < 40; i++) draw.keepToolClear(s2, 2.2);
  expect(y0 < 0 && s2.weapon().tip[1] >= 0.04, `Strand's pole tip lifted out of the floor (${y0.toFixed(2)} m before, ${s2.weapon().tip[1].toFixed(2)} m after)`); }
// seated: hips fitted to the plate's seat height (args.seatY), soles on the floor
{ const { createCast } = await import("../runtime/actor.mjs"), { INDEX } = await import("../rig/skeleton.mjs"), { STAND } = await import("../anim/stances.mjs");
  const keel = await import("../cast/keel.mjs"), merrow = await import("../cast/merrow.mjs");
  const timing = JSON.parse(await readFile(new URL("characters/anim/timing.json", root), "utf8")), cast = createCast({ timing, combat: null, members: { keel: { ...keel }, merrow: { ...merrow } } });
  for (const [who, seatY] of [["keel", 0.487], ["merrow", 0.458]]) {
    const a = cast.actor(who); for (let i = 0; i < 30; i++) a.drive({ x: 0, z: 0, face: 0, pose: { anim: "sit", loop: true }, dt: 1 / 30 });
    const fit = draw.fitSeat(a, seatY), S = a.skeleton(), h0 = a.skeleton(STAND)[INDEX.footL].p[1];
    const hip = S[INDEX.pelvis].p[1], ank = (S[INDEX.footL].p[1] + S[INDEX.footR].p[1]) / 2;
    expect(Math.abs(hip - (seatY + 0.09)) < 0.01 && Math.abs(ank - h0) < 0.02, `${who} seated on a ${seatY} m seat: pelvis ${hip.toFixed(3)} m (seat + 0.09), ankles ${ank.toFixed(3)} m against ${h0.toFixed(3)} standing (thighs tilted ${fit.da.toFixed(0)} degrees)`);
  } }
// hit reactions: a contact on a tick the render skipped still lands (fxOf(W, since)), and a body in hit-stop holds
{ const { makeReactions } = await import("../runtime/feel.mjs");
  const log = [{ kind: "hit", id: "t", by: "s", power: 0.9, t: 12 }], seen = [];
  const fx = (W, since) => { seen.push(since); return { contacts: log.filter((c) => (since == null ? c.t === W.tick : c.t > since && c.t <= W.tick)), frozen: W.tick < 16 ? ["t"] : [] }; };
  const W = { tick: 10, byId: (id) => (id === "t" ? { x: 0, z: 0, face: 0 } : { x: 1, z: 0, face: Math.PI }) }, R = makeReactions(fx);
  R.read(W); W.tick = 14; R.read(W);   // ticks 11 to 14 drawn as one frame: the hit at 12 is in it
  const held = R.layer("t", 0); W.tick = 15; R.read(W); const stillHeld = R.layer("t", 0); W.tick = 20; R.read(W); const moving = R.layer("t", 0);
  expect(seen[1] === 10 && !!held, "a hit on a skipped tick (12, drawn at 14) still starts a reaction, read with fxOf(W, 10)");
  expect(JSON.stringify(held) === JSON.stringify(stillHeld) && JSON.stringify(moving) !== JSON.stringify(held), "the reaction holds while the body is in hit-stop (frozen to tick 15) and moves on after");
  expect(held.chest.bend < 0, `a blow from the front throws the chest back (bend ${held.chest.bend.toFixed(1)})`); }
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
