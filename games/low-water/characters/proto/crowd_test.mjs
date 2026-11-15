// The crowd tier (runtime/crowd.mjs): a card for the facing and phase nearest the person's, scaled from the
// baked metre to the one at its feet and placed by its feet; walkers move on and turn back from closed
// ground; a person whose middle is behind the room is left out. A control breaks the facing.
//   node characters/proto/crowd_test.mjs        (exits non-zero on any failure)
const { makeCrowd } = await import("../runtime/crowd.mjs");
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
// 2 bodies, 4 facings, 4 walk phases, 2 idle phases; rect i = [sx, sy, w, h, ax, ay] with sx = i
const rects = Array.from({ length: 2 * 4 * 6 }, (_, i) => [i, 0, 10, 20, 5, 18]);
let id = 0; const body = () => ({ walk: Array.from({ length: 4 }, () => [id++, id++, id++, id++]), idle: Array.from({ length: 4 }, () => [id++, id++]) });
const meta = { ppm: 40, facings: 4, phases: 4, idlePhases: 2, rects, bodies: { a: body(), b: body() } };
const calls = []; const g = { drawImage: (...x) => calls.push(x) }, atlas = {};
const cam = { toScreen: (p) => [p[0] * 100, p[2] * 100], scaleAt: () => 80, depthOf: (p) => p[2], depthAt: (sx, sy) => (sx > 900 ? 0 : 1e9) };
const C = makeCrowd({ meta, atlas }, [{ at: [1, 0, 2], face: Math.PI / 2, who: "a", walk: 1, u: 0.3 }, { at: [2, 0, 3], face: 0, who: "b", walk: 0 }, { at: [10, 0, 5], face: 0, who: "a" }]);
const items = C.items(cam); for (const it of items) it.draw(g);
expect(items.length === 2, `the person behind the room is left out (${items.length} of 3 drawn)`);
const w = calls[0], idx = meta.bodies.a.walk[1][1];
expect(w[1] === idx, `a walker facing 90 degrees at phase 0.3 gets facing 1, phase 1 (card ${w[1]}, want ${idx})`);
expect(w[3] === 10 && w[7] === 20 && w[8] === 40 && w[5] === 100 - 5 * 2 && w[6] === 200 - 18 * 2, `scaled 2x from the baked metre and placed by its feet (${w.slice(5).join(", ")})`);
expect(calls[1][1] === meta.bodies.b.idle[0][0], `a stander gets an idle card (${calls[1][1]})`);
const open = (x, z) => x < 1.15; const p0 = C.people[0], f0 = p0.face; p0.face = 0; C.step(0.1, open); const moved = p0.at[0];
C.step(0.1, open); expect(moved > 1 && p0.at[0] === moved && p0.face !== 0, `a walker stops at closed ground and turns (x ${moved.toFixed(2)}, face ${p0.face.toFixed(2)})`);
{ const D = makeCrowd({ meta, atlas }, [{ at: [1, 0, 2], face: Math.PI, who: "a", walk: 1, u: 0.3 }]); calls.length = 0; for (const it of D.items(cam)) it.draw(g); expect(calls[0][1] !== idx, "control: another facing gets another card"); }
if (fails) { console.log(`${fails} failed`); process.exit(1); }
