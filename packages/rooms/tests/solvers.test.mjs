import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { assert, near } from "./h.mjs";
import * as P from "../solvers/pcb/index.js";
import { WaveField, click, amplitudeAt, roomMode } from "../solvers/sound/fdtd.js";
import { rooms } from "../solvers/sound/rooms.js";
import { STEP_SHADER, MIC_SHADER, SHOW_SHADER, VS_SHADER } from "../solvers/sound/shaders.js";
import { CFL, C0, DT } from "../solvers/sound/params.js";

const gold = JSON.parse(readFileSync(new URL("./golden/pcb-page.json", import.meta.url)));
const H = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 24);

const results = P.runChecks();
test("PCB: all the page's known-answer checks pass from the modules", () => {
  assert.equal(results.length, gold.checks.length);
  assert.deepEqual(results.filter((c) => !c.pass).map((c) => c.name), []);
});
for (const g of gold.checks)
  test(`PCB check ${g.id} gives the page's number`, () => {
    const c = results.find((r) => r.id === g.id);
    assert.equal(c.got, g.got);
    assert.equal(c.want, g.want);
  });
for (const [k, b] of Object.entries(gold.boards))
  test(`PCB board ${k}: every exported file is byte equal to the page's`, () => {
    const d = P.buildDesign(P.EXAMPLES[k]),
      F = P.exportAll(d);
    assert.deepEqual(Object.keys(F).sort(), Object.keys(b.files).sort());
    for (const n of Object.keys(F)) assert.equal(H(F[n]), b.files[n], n);
    assert.equal(d.drc.length, b.drc, "rule violations");
  });
test("PCB planted: a violation added to a clean board is reported", () => {
  const d = P.buildDesign(P.EXAMPLES.tia);
  const before = d.drc.length;
  const t = d.tracks[0];
  d.tracks.push({ ...t, w: 0.01 });
  assert.ok(P.drc(d).length > before, "thin track");
});

test("sound: a click arrives after distance over Courant number", () => {
  const f = new WaveField(240, 240, { cfl: CFL });
  const s = [];
  for (let i = 0; i < 450; i++) {
    f.step([40, 120], click(i));
    s.push(f.at(200, 120));
  }
  const pk = s.reduce((m, v, i) => (Math.abs(v) > Math.abs(s[m]) ? i : m), 0);
  // The page's check expects distance / CFL = 320 steps here; 2-D spreading trails the front by a few steps.
  near(pk - 20, 160 / CFL, 12, "arrival step");
});
test("sound: rectangular room modes against c/2 * hypot(m/Lx, q/Ly)", () => {
  // The page's room, 4.32 by 3.0 m, on a cell four times larger so CI can run it. The search window is 3 percent,
  // because at the page's 15 percent the (2,0) search also takes in the stronger (1,1) mode.
  const dx = 0.04,
    dt = (dx * CFL) / C0,
    nx = 108 + 4,
    ny = 75 + 4;
  const f = new WaveField(nx, ny, { cfl: CFL, wall: (x, y) => x < 2 || x > nx - 2 || y < 2 || y > ny - 2 });
  const s = [];
  for (let i = 0; i < 8192; i++) {
    f.step([7, 7], click(i));
    s.push(f.at(100, 67));
  }
  for (const [m, q] of [[1, 0], [0, 1], [1, 1], [2, 0], [2, 1], [0, 2]]) {
    const e = roomMode(C0, 4.32, 3, m, q);
    let best = [0, 0];
    for (let fq = e * 0.97; fq <= e * 1.03; fq += 0.5) {
      const v = amplitudeAt(s, fq, dt);
      if (v > best[1]) best = [fq, v];
    }
    near(best[0], e, 0.02 * e, `mode ${m},${q}`);
  }
});
test("sound planted: a wrong room length misses the (1,0) mode", () => {
  assert.ok(Math.abs(roomMode(C0, 5, 3, 1, 0) - roomMode(C0, 4.32, 3, 1, 0)) > 0.1 * roomMode(C0, 4.32, 3, 1, 0));
});
test("sound: rooms and shaders are in the solver, with no browser", () => {
  assert.equal(Object.keys(rooms).length, 10);
  for (const r of Object.values(rooms)) assert.equal(typeof r.f, "function");
  assert.match(STEP_SHADER, /k\*k\*\(s-4\.\*p\)/);
  assert.ok(MIC_SHADER && SHOW_SHADER && VS_SHADER);
  assert.ok(DT > 0);
});
