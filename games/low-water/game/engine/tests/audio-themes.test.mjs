// The themes (game/engine/audio/themes.mjs, design/audio/THEMES.md): every bar adds up, every chord parses,
// and the melody sits on its harmony (a downbeat note is a chord tone or a ninth, eleventh or thirteenth).
// The controls: a bar a beat short, and the same melody a semitone off, must both fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, layout } from "../audio/themes.mjs";
import { chord } from "../audio/theory.mjs";

function barsAddUp(T) {
  for (const part of ["melody", "chords"]) for (const sec of T[part]) for (const bar of sec.split("|")) {
    const toks = bar.trim().split(/\s+/);
    if (toks.length === 1 && !toks[0].includes(":")) continue;
    const sum = toks.reduce((s, t) => s + +t.split(":")[1], 0);
    if (Math.abs(sum - T.meter) > 1e-9) return `${part}: "${bar.trim()}" has ${sum} beats`;
  }
  return null;
}
// share of strong-beat melody notes that are chord tones or the usual tensions
function fit(L, shift = 0) {
  let good = 0, all = 0;
  for (const x of L.notes) {
    if (x.at % L.meter !== 0) continue;
    const c = L.chords.find((k) => k.at <= x.at && x.at < k.at + k.dur), pcs = chord(c.sym, 60).notes.map((p) => p % 12), root = chord(c.sym, 60).root;
    const ext = [2, 5, 9].map((iv) => (root + iv) % 12);
    all++; if ([...pcs, ...ext].includes((x.p + shift) % 12)) good++;
  }
  return good / all;
}

test("every theme's bars add up and every chord parses; a bar a beat short is caught", () => {
  for (const [id, T] of Object.entries(THEMES)) {
    assert.equal(barsAddUp(T), null, id);
    const L = layout(id);
    for (const c of L.chords) assert.doesNotThrow(() => chord(c.sym, 60), `${id}: ${c.sym}`);
    assert.ok(L.notes.length > 8, id);
  }
  const bad = { ...THEMES.town, melody: ["A3:2 F4:1 | E4:1 D4:1 E4:1 F4:1"] };
  assert.notEqual(barsAddUp(bad), null);
});

test("each melody sits on its harmony on the downbeats; the same melody a semitone off does not", () => {
  for (const id of Object.keys(THEMES)) {
    const L = layout(id);
    assert.ok(fit(L) >= 0.85, `${id}: ${fit(L).toFixed(2)}`);
    assert.ok(fit(L, 1) < 0.6, `control ${id}: ${fit(L, 1).toFixed(2)}`);
  }
});

test("an empty bowl is a rest: Tomas's note leaves the Haldane theme, and the bars stay the same length", () => {
  const full = layout("haldane"), four = layout("haldane", { missing: ["Tomas"] }), three = layout("haldane", { missing: ["Tomas", "Aaron"] });
  assert.equal(full.notes.length - four.notes.length, 3);
  assert.equal(four.notes.length - three.notes.length, 2);
  assert.equal(four.end, full.end);
  assert.ok(!four.notes.some((x) => x.bowl === "Tomas"));
});
