import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, evaluate, compileEffects, runEffects, toMin } from "../core/expr.mjs";

const scope = (vals = {}) => {
  const S = { vals: { ...vals }, calls: [],
    get: (n) => S.vals[n],
    assign: (n, v) => { S.vals[n] = v; },
    call: (name, args) => { S.calls.push([name, args.map((a) => a.name ?? a.v)]); return name === "has" ? args[0].name === "yes" : 0; } };
  return S;
};

test("LWD/0 conditions: has, comparisons, words, and, or, not", () => {
  const S = scope({ tide: -0.4, "power.quay": "off" });
  assert.equal(evaluate(compile("tide < -0.27"), S), true);
  assert.equal(evaluate(compile("power.quay == off"), S), true, "an unknown bare word compares as its spelling");
  assert.equal(evaluate(compile("has(yes) & !has(no)"), S), true);
  assert.equal(evaluate(compile("has(no) | tide > 0"), S), false);
  assert.equal(evaluate(compile("tide <= -0.4 and not (tide > 1)"), S), true);
});

test("times read on the night's clock: before noon is after midnight", () => {
  assert.equal(toMin("23:30"), 23 * 60 + 30);
  assert.equal(toMin("00:15"), 24 * 60 + 15);
  const S = scope({ clock: toMin("01:00") });
  assert.equal(evaluate(compile("clock >= 23:30"), S), true);
  assert.equal(evaluate(compile("clock < 00:30"), S), false);
});

test("arithmetic and precedence", () => {
  const S = scope({ a: 2, b: 3 });
  assert.equal(evaluate(compile("a + b * 2 == 8"), S), true);
  assert.equal(evaluate(compile("-a + 5 == 3"), S), true);
  assert.equal(evaluate(compile("(a + b) / 0 == 0"), S), true, "division by zero is 0, not Infinity");
});

test("syntax errors name the source", () => {
  assert.throws(() => compile("tide <"), /in: tide </);
  assert.throws(() => compile("has(x"), /expected "\)"/);
});

test("effects: assignments and calls in order", () => {
  const S = scope({ coins: 3 });
  runEffects(compileEffects("coins += 2; mood = rattled; set(seen.lamp); coins *= 2"), S);
  assert.equal(S.vals.coins, 10);
  assert.equal(S.vals.mood, "rattled");
  assert.deepEqual(S.calls, [["set", ["seen.lamp"]]]);
  assert.throws(() => compileEffects("coins + 2"), /assignment or a call/);
});

test("names() lists ids and calls for the validator", () => {
  const c = compile("has(met.keel) & tide < 0 & skill.eye >= 3");
  assert.ok(c.ids.has("tide") && c.ids.has("skill.eye"));
  assert.deepEqual(c.calls.get("has"), [["met.keel"]]);
});

test("a word a variable declares means the word, even when it is also a skill's name", async () => {
  const { loadContent, createGame } = await import("../game.mjs");
  const G = createGame({ content: loadContent([{ file: "w.lwd", text: "@attr nose\nname: Nose\n@skill dark\nname: The Dark\nattr: nose\n@var fate\ndefault: crown\nvalues: crown, dark\n@var read\ndefault: flatfish\nvalues: flatfish, nose\n@node a\ndo: fate = dark; read = nose\nend: x\n" }]) });
  G.state.sheet.attrs.nose = 3;
  assert.equal(G.scope.get("dark"), 3, "a bare dark elsewhere is still the skill");
  G.talk("a");
  assert.equal(G.scope.get("fate"), "dark");
  assert.equal(G.scope.get("read"), "nose");
  const { compile, evaluate } = await import("../core/expr.mjs");
  assert.equal(evaluate(compile("fate == dark & var.read == nose"), G.scope), true);
  assert.equal(evaluate(compile("dark == 3"), G.scope), true, "no variable on the other side: the skill");
});
