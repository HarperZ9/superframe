import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assert, near } from "./h.mjs";
import { lensSpace, parameterSpace, propose, replay, session, widthAt } from "../tools/steer.js";
import { SH } from "../core/shapes.js";

const gold = JSON.parse(readFileSync(new URL("./golden/minds-eye-core.json", import.meta.url)));
const H = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const meSpace = parameterSpace({ id: "minds-eye", genes: gold.genes.map(([name, , wrap]) => ({ name, wrap: !!wrap })) });

test("over Mind's Eye's genes, every candidate equals the source page's", () => {
  let parent = null,
    bits = 0;
  gold.rows.forEach((want, d) => {
    const K = d % 3 ? 2 : 4;
    const p = propose(meSpace, 7, d, parent, K, widthAt(bits));
    assert.equal(H(p.cands), want, `draw ${d}`);
    parent = p.cands[d % K];
    bits += Math.log2(K);
  });
  assert.equal(H(parent), gold.finalHash);
});

// A person who sees a target, simulated: picks the candidate nearest in settings, normalised per gene.
const lens = lensSpace();
const target = lens.genes.map((_, i) => (i === 0 ? 0.31 : [0.2, 0.7, 0.4, 0.6, 0.35, 0.8, 0.55][i - 1]));
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
function run(picker, seed, K = 2, steps = 200) {
  const s = session(lens, { seed, K });
  for (let i = 0; i < steps; i++) s.choose(picker(s.candidates(), i));
  return s;
}
const toward = (c) => c.reduce((m, v, i) => (dist(v, target) < dist(c[m], target) ? i : m), 0);
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const median = (v) => v.slice().sort((a, b) => a - b)[v.length >> 1];

test("steering by a planted target gets close; a random picker does not", () => {
  const steered = median(seeds.map((s) => dist(run(toward, s).best, target)));
  const random = median(seeds.map((s) => dist(run((c, i) => (i * 2654435761 + s) % c.length, s).best, target)));
  assert.ok(steered < 0.12, `steered ${steered}`);
  assert.ok(random > 3 * steered, `random ${random}, steered ${steered}`);
});
test("planted: steering toward a decoy does not reach the target", () => {
  const decoy = target.map((v) => 1 - v);
  const away = (c) => c.reduce((m, v, i) => (dist(v, decoy) < dist(c[m], decoy) ? i : m), 0);
  assert.ok(median(seeds.map((s) => dist(run(away, s).best, target))) > 0.8);
});
test("bits are counted per choice, and a saved session replays without the person", () => {
  const s = run(toward, 3, 4, 20);
  near(s.bits, 40, 1e-9, "log2(4) each");
  const rec = JSON.parse(JSON.stringify(s.record()));
  assert.deepEqual(replay(lens, rec), s.best);
});
test("settings stay inside the page's ranges and name a real shape", () => {
  for (const u of [0, 0.5, 0.999]) {
    const st = lens.toSettings(lens.genes.map(() => u));
    assert.ok(SH[st.shape]);
    assert.ok(st.n >= 1 && st.n <= 2.6);
    assert.ok(st.size >= 0.25 && st.size <= 1.8);
  }
});
test("any registered space steers, and a bad one is refused", () => {
  const sp = parameterSpace({ id: "t", genes: [{ name: "a" }], toSettings: (g) => ({ a: g[0] }) });
  const s = session(sp, { seed: 1 });
  s.candidates();
  s.choose(0);
  assert.equal(s.record().rows.length, 1);
  assert.throws(() => parameterSpace({ id: "x", genes: [] }), /genes/);
  assert.throws(() => session(sp, { K: 1 }), /two/);
  assert.throws(() => session(sp).choose(0), /candidates/);
});
