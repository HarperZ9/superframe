// Ground, decay, combat, dreams, post and transitions: tied to state, deterministic, both forms. node --test game/engine/fx/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildScene } from "../../light/scene.mjs";
import { fxContext, runEffects, fxSettings } from "../core.mjs";
import "../weather.mjs"; import "../fire.mjs"; import "../ground.mjs"; import "../decay.mjs"; import "../combat.mjs"; import "../dream.mjs";
import { eraPost, hazeRamp } from "../post.mjs";
import { TRANSITIONS } from "../transitions.mjs";
import { loosen } from "../dream.mjs";

const dir = new URL("../../../capture/light/plates/q_square_wide/", import.meta.url), have = existsSync(new URL("place.json", dir));
const load = () => { const pj = JSON.parse(readFileSync(new URL("place.json", dir), "utf8")), b = readFileSync(new URL("geo-pos.f32", dir)); return { pj, geo: { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(new URL("geo-id.u8", dir))) } }; };
const count = (r, k) => r.prims.filter((p) => p.k === k).length;
test("decay is staged by the street's index; notices thicken with the carrier's volume", { skip: !have && "no proof plate" }, () => {
  const { pj, geo } = load(), set = fxSettings(new URLSearchParams("fx=high"));
  const run = (vals) => { const read = (n, s) => vals[`${n}|${s}`] ?? vals[n]; const S = buildScene({ pj, geo, hour: 11, read }); return runEffects(fxContext({ M: S.M, F: S.F, pj, t: 1 }), set); };
  const rich = run({ light: 0.9, "volume.notices": 0.05 }), poor = run({ light: 0.1, "volume.notices": 0.8 });
  assert.ok(count(poor, "peel") > count(rich, "peel") && count(poor, "sootstreak") > count(rich, "sootstreak"), "peeling and soot come with a falling index");
  assert.ok(count(poor, "notice") > count(rich, "notice"), `notices ${count(rich, "notice")} -> ${count(poor, "notice")}`);
});
test("combat: a ring only while winding up, blood only for heavy hits and kept to a few drops", { skip: !have && "no proof plate" }, () => {
  const { pj, geo } = load(), S = buildScene({ pj, geo, hour: 23 }), set = fxSettings(new URLSearchParams("fx=high"));
  const at = (t, events) => { const c = fxContext({ M: S.M, F: S.F, pj, t }); c.events = events; return runEffects(c, set); };
  const w = [{ type: "windup", at: [0, 0, 0], dir: [0, 1], t0: 1, dur: 0.6 }];
  assert.ok(count(at(1.3, w), "ring") > 0 && count(at(2, w), "ring") === 0);
  const light = at(1.1, [{ type: "hit", at: [0, 0, 0], dir: [0, 1], t0: 1, power: 0.4 }]), heavy = at(1.1, [{ type: "hit", at: [0, 0, 0], dir: [0, 1], t0: 1, power: 0.9 }]);
  assert.equal(count(light, "drop"), 0); assert.ok(count(heavy, "drop") >= 2 && count(heavy, "drop") <= 3);
});
test("post and transitions: era looks change the frame and repeat; transitions cover 0 at the start and all at the end", () => {
  const img = () => ({ width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 251)) });
  for (const era of [1, 2, 3, 4, 5]) { const a = eraPost(img(), era, { t: 1 }), b = eraPost(img(), era, { t: 1 }); assert.deepEqual(a.data, b.data); assert.notDeepEqual(a.data, img().data, `era ${era}`); }
  for (const [n, f] of Object.entries(TRANSITIONS)) { let a0 = 0, a1 = 0; for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) { a0 += f(x, y, 0, 40, 30, 3).a; a1 += f(x, y, 1, 40, 30, 3).a; } assert.ok(a0 < 60 && a1 > 1140, `${n}: ${a0} ${a1}`); }
  assert.deepEqual(loosen(img(), 0, 0).data, img().data, "a dream at zero is the frame");
});
test("the light in the air is drawn: a shaft by day in a room with a window, the fog layer in fog", { skip: !existsSync(new URL("../../../capture/light/plates/q_haldane/place.json", import.meta.url)) && "no proof plate" }, async () => {
  await import("../shafts.mjs"); await import("../fog.mjs");
  const d = new URL("../../../capture/light/plates/q_haldane/", import.meta.url), pj = JSON.parse(readFileSync(new URL("place.json", d), "utf8")), b = readFileSync(new URL("geo-pos.f32", d));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(new URL("geo-id.u8", d))) };
  const S = buildScene({ pj, geo, hour: 8.4 }), r = runEffects(fxContext({ M: S.M, F: S.F, pj, t: 1, sync: true }), fxSettings(new URLSearchParams("fx=high")));
  const sh = r.prims.find((p) => p.id === "shafts"); assert.ok(sh, "a shaft layer"); let lit = 0; for (let i = 3; i < sh.rgba.length; i += 4) if (sh.rgba[i] > 20) lit++; assert.ok(lit > 50, `${lit} shaft pixels`);
});
