// The weighted devices (design/DEVICE-AUDIT.md; the author, 2026-10-23): the sensory cue system (world/senses.mjs),
// weight and encumbrance (world/burden.mjs), the world-state echo (world/echo.mjs), a hand on a prop (world/props.mjs
// touch:), and the device check (tools/devicecheck.mjs) with one planted fault for each of its rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, loadContent } from "../game.mjs";
import { testSources } from "./helpers.mjs";
import { checkDevices } from "../tools/devicecheck.mjs";
import { gaitOf, postureOf } from "../world/burden.mjs";
import { postureTransform } from "../ui/senseplayer.mjs";

const EXTRA = `
@sense t.thread.cut
screen: shake 0.2 0.3
sound: snip 0.5 near
caption: a blade through thread
rumble: 0.1 0.7 120
anim: player flinch 0.8

@sense burden.shoulder
sound: thud 0.6 near
caption: a sack landing on a shoulder
rumble: 0.5 0.2 160

@sense burden.bent
anim: player stoop

@sense scale.tip
sound: creak 0.5 near
caption: the arm of the scale moving
rumble: 0.3 0.1 300

@sense t.echo.chair
sound: chair 0.3 near
caption: a chair scraped back

@load t.sack
name: A sack of barley
weight: 30

@load t.wedge
name: An iron wedge
weight: 4

@scale t.scale
name: The exchange scale
sense: scale.tip

@echo t.e.chair
place: t.room
when: has(t.gone)
tells: flag t.gone
show: seat stool empty
show: person t.mother slump
show: absent t.boy
line: Nobody has pushed the fourth stool back against the wall.
sense: t.echo.chair

@prop t.thread
name: The thread
place: t.room
tells: era
carries: touch
state: 1 worn | A blue thread round her wrist, gone grey with handling.
touch: hold "Hold her wrist" | The thread is soft as hair and warm from her. {sense: t.thread.cut}
touch: cut "Cut the thread" | It parts at the first pull of the blade. {sense: t.thread.cut, do: set(t.cut)}


@node t.go
place: t.room
nar: The room. {sense: t.thread.cut}
opt: "Shoulder the sack." -> t.go2 {do: shoulder(t.sack); sense(t.thread.cut)}

@node t.go2
place: t.room
nar: Heavier now.
end: done
`;
const content = loadContent([...testSources(), { file: "senses.lwd", text: EXTRA }]);
const game = () => createGame({ content, seed: 3 });

test("the systems load with no errors from their records", () => {
  assert.deepEqual(content.errors.filter((e) => /^(sense|load|scale|echo|prop t\.)/.test(e.msg)), []);
  assert.ok(content.story.cues["t.thread.cut"]);
  assert.equal(content.story.burden.loads["t.sack"].weight, 30);
  assert.equal(content.story.echoes["t.e.chair"].show.length, 3);
});

test("a cue fired from a line, an effect and an option is recorded on the run and handed to the shell", () => {
  const G = game(), seen = [];
  G.on("sense.cue", (c) => seen.push(c.id));
  const talk = G.talk("t.go");
  assert.ok(G.senses.fired("t.thread.cut"), "the narration's cue");
  talk.choose(0);
  assert.ok(seen.filter((x) => x === "t.thread.cut").length >= 2, "the option's cue() effect fired too");
  assert.ok(G.senses.log().every((c) => typeof c.at === "number"));
  assert.throws(() => G.senses.fire("t.nope"), /no @sense/);
});

test("the burden is felt and never counted: the walk slows, the body bends, the scale tips by weight", () => {
  const G = game(), events = [];
  G.on("burden", (e) => events.push(e));
  assert.equal(G.burden.gait(), 1);
  G.burden.shoulder("t.sack");
  assert.equal(G.burden.posture(), "bent");
  assert.ok(G.burden.gait() < 0.7 && G.burden.gait() > 0.3, `gait ${G.burden.gait()}`);
  assert.ok(G.senses.fired("burden.shoulder") && G.senses.fired("burden.bent"));
  assert.equal(G.senses.posture("player").name, "bent");
  G.burden.shoulder("t.sack");
  assert.equal(G.burden.posture(), "stagger");
  G.burden.setdown("all");
  assert.equal(G.burden.gait(), 1);
  // the scale: a light sack and a wedge under its pan against the weights; the arm drops on the side that is heavier
  G.burden.pan("t.scale", "left", "t.sack"); G.burden.pan("t.scale", "right", "t.sack");
  assert.equal(G.burden.tip("t.scale"), "level");
  G.burden.pan("t.scale", "left", "t.wedge");
  assert.equal(G.burden.tip("t.scale"), "left");
  assert.ok(G.senses.fired("scale.tip"));
  assert.equal(gaitOf(0), 1); assert.equal(gaitOf(500), 0.3); assert.equal(postureOf(14), "upright");
  assert.ok(events.length >= 3);
});

test("an echo is felt once an era on coming in, while its condition holds, and shows its changes", () => {
  const G = game();
  G.setPlace("t.room");
  assert.deepEqual(G.echo.enter("t.room"), [], "nothing has happened yet");
  G.setFlag("t.gone", true);
  const lines = G.echo.enter("t.room");
  assert.equal(lines.length, 1); assert.match(lines[0].text, /fourth stool/);
  assert.ok(G.senses.fired("t.echo.chair"));
  assert.deepEqual(G.echo.enter("t.room"), [], "once an era");
  assert.deepEqual(G.echo.absent("t.room"), ["t.boy"]);
  assert.ok(G.echo.shows("t.room").some((s) => s.kind === "person" && s.arg === "slump"));
  G.state.vars.era = 2; assert.equal(G.echo.enter("t.room").length, 1, "felt again in the next era");
});

test("a hand on a prop: its own verb, its line, its cue and its effects", () => {
  const G = game(); G.setPlace("t.room");
  const vs = G.verbs.list().filter((x) => x.object.id === "t.thread");
  assert.deepEqual(vs.map((x) => x.verb.kind), ["examine", "touch", "touch"]);
  const r = G.verbs.act("t.thread", "touch", { label: "Cut the thread" });
  assert.ok(r.ok); assert.match(r.lines[0].text, /parts/);
  assert.ok(G.state.flags.includes("t.cut") && G.state.flags.includes("touched.t.thread.cut"));
  assert.ok(G.senses.fired("t.thread.cut"));
});

test("postures bend a figure about its feet and a tremble moves", () => {
  assert.equal(postureTransform("upright"), null);
  assert.ok(postureTransform("stoop").m[2] < 0);
  assert.notDeepEqual(postureTransform("tremble", 10).m, postureTransform("tremble", 70).m);
});

// the gate's controls: each rule catches a planted fault, and the clean story above passes
const PLANT = `
@fate f.t.gone
pressure: has(t.gone)
subject: household t
decider: BET
scene: t.plant
who: Tomas

@prop t.ledger
name: The ledger
place: t.room
tells: era
state: 1 open | KRALL'S END. YIELD 340. W. MOTT, BRIGADE CLERK.

@fact t.fact
about: What the barns grew, in your own hand.

@node t.plant
place: t.room
nar: In his hand: 190 {hand: mott}
opt: "Sign them both as received." -> t.go2 {do: sense(t.missing)}
`;
test("devicecheck: every rule catches its planted fault", () => {
  const sources = [...testSources(), { file: "senses.lwd", text: EXTRA }, { file: "plant.lwd", text: PLANT }];
  const C = loadContent(sources), res = checkDevices(C, { text: sources.map((s) => s.text).join("\n") });
  const rules = new Set(res.map((x) => x.rule));
  for (const r of ["hand", "inscription", "figure", "docverb", "docprop", "sense", "journal", "cue"]) assert.ok(rules.has(r), `${r} not caught: ${[...rules].join(", ")}`);
  const clean = checkDevices(content, { text: EXTRA }).filter((x) => x.file === "senses.lwd");
  assert.deepEqual(clean.map((x) => `${x.rule}: ${x.msg}`), []);
});
