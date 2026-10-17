import { test } from "node:test";
import assert from "node:assert/strict";
import { loadContent } from "../game.mjs";
import { lint } from "../tools/lint.mjs";
import { testSources } from "./helpers.mjs";

// A small act with one of each fault, so a clean report on real content means something.
const BROKEN = `@meta
start: a
@skill eye
name: Eye
@node a
nar: Start.
opt: "Go nowhere." -> missing.node
opt: "Undefined." -> b ? weather_mood > 2
opt: "Flag never set." -> b ? has(never.set)
opt: "Bad call." -> b ? frobnicate(x)
check: "Unknown skill." -> b / c {skill: nose, dc: 5}
opt: "Item." -> b ? count(no_such_item) > 0
@node b
nar: Runs out.
@node c
nar: C.
cmd: launch rockets
go: a
@node orphan
nar: Nobody comes here.
end: x
`;

test("the validator finds each planted fault", () => {
  const r = lint(loadContent([{ file: "broken.lwd", text: BROKEN }]));
  const msgs = r.issues.map((i) => `${i.level}: ${i.msg}`);
  const expect = [
    "error: opt to missing node missing.node",
    "warn: undefined name weather_mood",
    "warn: flag never.set is read but never set",
    "error: unknown function frobnicate()",
    "error: check on unknown skill nose",
    "warn: count(no_such_item): no item no_such_item",
    "warn: dead end: runs out with no go, option, end, exit or return",
    "warn: unknown command launch",
    "warn: unreachable from @meta start a",
  ];
  for (const e of expect) assert.ok(msgs.includes(e), `missing: ${e}\n got: ${msgs.join("\n")}`);
  assert.ok(r.errors >= 3);
});

test("the placeholder content validates clean", () => {
  const r = lint(loadContent(testSources()));
  assert.deepEqual(r.issues, []);
  assert.equal(r.reachable, r.nodes);
});

test("fight(e.x) links to the encounter's outcome nodes; combat's flags are not 'never set'", () => {
  const r = lint(loadContent([{ file: "f.lwd", text: `@meta
start: a
@encounter e.x
name: X
win: w
down: d
@node a
do: fight(e.x)
@node w
opt: "Back." -> a ? has(struck.keel) | has(fought.e.x) | has(book.violence)
@node d
end: down
` }]));
  const msgs = r.issues.map((i) => i.msg);
  assert.ok(!msgs.some((m) => /unreachable|dead end|never set|unknown function/.test(m)), msgs.join("\n"));
  assert.equal(r.reachable, 3);
});

test("a fight's talk exits are reachable from the fight; fight_* names are known", () => {
  const r = lint(loadContent([{ file: "t.lwd", text: `@meta
start: a
@encounter e.x
name: X
win: w
down: w
talk: parley | Put it down ? fight_struck >= 1 & fight_lamb_standing >= 4
@node a
do: fight(e.x)
@node parley
nar: Talked out.
go: w
@node w
end: done
` }]));
  assert.deepEqual(r.issues.map((i) => i.msg), []);
  assert.equal(r.reachable, 3);
});

test("--carry: flags and variables an earlier act sets count as set in the next", () => {
  const act1 = lint(loadContent([{ file: "a1.lwd", text: "@meta\nstart: a\n@node a\ndo: set(gut.spratt_seen); feint = 1\nend: x\n" }]));
  const act2src = [{ file: "a2.lwd", text: "@meta\nstart: b\n@node b\nalt: c ? has(gut.spratt_seen) & feint == 1\nend: y\n@node c\nend: z\n" }];
  const alone = lint(loadContent(act2src)).issues.map((i) => i.msg);
  assert.ok(alone.some((m) => /gut.spratt_seen is read but never set/.test(m)) && alone.some((m) => /undefined name feint/.test(m)));
  assert.deepEqual(lint(loadContent(act2src), { carry: act1 }).issues, []);
});

test("carry through two earlier acts: Act 3 reads Act 1's and Act 2's flags and visited scenes", () => {
  const L = (text, carry) => lint(loadContent([{ file: "x.lwd", text }]), { carry });
  const merge = (a, r) => ({ sets: [...new Set([...(a ? a.sets : []), ...r.sets])], declared: [...new Set([...(a ? a.declared : []), ...r.declared])], nodes: [...new Set([...(a ? a.nodes : []), ...r.nodeIds])] });
  const a1 = L("@meta\nstart: a\n@node a\ndo: set(one.done)\nend: x\n");
  let carry = merge(null, a1);
  const a2 = L("@meta\nstart: b\n@node b\nalt: b2 ? has(one.done)\nend: y\n@node b2\ndo: set(two.done)\nend: z\n", carry);
  assert.deepEqual(a2.issues, []);
  carry = merge(carry, a2);
  const act3 = "@meta\nstart: c\n@node c\nalt: d ? has(one.done) & has(two.done) & seen(b2)\nend: w\n@node d\nend: v\n";
  assert.ok(L(act3, merge(null, a1)).issues.length >= 2, "with Act 1 alone, Act 2's flag and scene are unknown");
  assert.deepEqual(L(act3, carry).issues, []);
});
