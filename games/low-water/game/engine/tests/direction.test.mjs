import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDirection, splitDirected, portraitCue, renderParams } from "../dialogue/direction.mjs";
import { parseStep } from "../dialogue/parse.mjs";
import { lintText } from "../tools/dirlint.mjs";
import { createGame, loadContent } from "../game.mjs";

const at = { file: "t.lwd", line: 1 };

test("a direction block reads bare words and key: value alike", () => {
  assert.deepEqual(parseDirection("cold 2 slow lie").dir, { emo: "cold", int: 2, pace: 0.82, lie: true });
  assert.deepEqual(parseDirection("emo: cold, int: 2, pace: 0.9").dir, { emo: "cold", int: 2, pace: 0.9 });
  assert.deepEqual(parseDirection("whisper over").dir, { vol: "whisper", over: true });
  assert.match(parseDirection("cold angry").errors[0], /two emo/);
  assert.match(parseDirection("furious").errors[0], /unknown direction/);
  assert.match(parseDirection("int: 4").errors[0], /intensity/);
  assert.match(parseDirection("pace: 3").errors[0], /pace/);
});

test("the screen shows the words; the voice track gets the cues and the stress", () => {
  const d = splitDirected("[stern 1] The Board is *very* gratified. <beat> Do not stand there. <pause 1.2> Wet.");
  assert.equal(d.text, "The Board is very gratified. Do not stand there. Wet.");
  assert.deepEqual(d.dir, { emo: "stern", int: 1 });
  assert.deepEqual(d.cues.map((c) => [c.cue, c.s]), [["beat", 0.4], ["pause", 1.2]]);
  assert.deepEqual(d.spoken[0], { say: "The Board is very gratified.", stress: ["very"] });
  assert.equal(d.spoken.length, 5);
  assert.match(splitDirected("Hello <grunt> there").errors[0], /unknown cue <grunt>/);
  assert.match(splitDirected("an *odd stress").errors[0], /unpaired/);
  assert.match(splitDirected("[whisper 3] no").errors[0], /whisper at intensity 3/);
  assert.equal(splitDirected("A plain line, untagged.").text, "A plain line, untagged.");
});

test("the parser strips direction from line, voice, inst, nar and options, and reads dir:", () => {
  const l = parseStep("line", "KEEL: [cold 2] The Board. <beat> Is wet. {once}", at);
  assert.equal(l.who, "KEEL"); assert.equal(l.text, "The Board. Is wet."); assert.equal(l.dir.emo, "cold"); assert.equal(l.once, true);
  const v = parseStep("voice", "pride: [wry 2 fast] He is wetter than you. {dc: 4}", at);
  assert.equal(v.skill, "pride"); assert.equal(v.text, "He is wetter than you."); assert.equal(v.dc, 4); assert.equal(v.dir.pace, 1.18);
  const n = parseStep("nar", "[dry] Item: one harbourmaster, wet.", at);
  assert.equal(n.value, "Item: one harbourmaster, wet."); assert.equal(n.dir.emo, "dry");
  const o = parseStep("opt", '"Nothing. It was dark." -> a.b {dir: flat 1 fast, once}', at);
  assert.equal(o.label, "Nothing. It was dark."); assert.deepEqual(o.dir, { emo: "flat", int: 1, pace: 1.18 }); assert.equal(o.attrs.once, true);
  const d = parseStep("dir", "KEEL: cold 1 slow", at);
  assert.deepEqual(d, { kind: "dir", who: "KEEL", dir: { emo: "cold", int: 1, pace: 0.82 }, ...at });
  assert.ok(parseStep("line", "KEEL: [cold cold2] x", at).dirErrors.length);
});

test("the runner hands each line its direction, the node default under the line's own", () => {
  const C = loadContent([{ file: "d.lwd", text: [
    "@meta", "title: t", "format: lwd/1", "start: d.a", "",
    "@node d.a", "speaker: KEEL", "dir: KEEL: cold 1 slow",
    "line: KEEL: The Board is wet.",
    "line: KEEL: [warm 2 lie] The Board is grateful. <beat> Truly.",
    "nar: [dry] He drips.",
    'opt: "Go." -> d.b {dir: flat 1}', "",
    "@node d.b", "line: KEEL: Goodbye.", "exit: walk", ""].join("\n") }]);
  assert.deepEqual(C.errors, []);
  const G = createGame({ content: C }), t = G.start(), L = t.beat.lines;
  assert.deepEqual(L[0].dir, { emo: "cold", int: 1, pace: 0.82 });
  assert.deepEqual(L[1].dir, { emo: "warm", int: 2, pace: 0.82, lie: true }, "the line's block wins key by key");
  assert.equal(L[1].text, "The Board is grateful. Truly.");
  assert.deepEqual(L[1].cues.map((c) => c.cue), ["beat"]);
  assert.equal(L[2].dir.emo, "dry");
  t.choose(t.beat.options[0].index);
  const you = t.beat.lines.find((l) => l.kind === "you");
  assert.deepEqual(you.dir, { emo: "flat", int: 1 });
  assert.equal(t.beat.lines.find((l) => l.kind === "line").dir, undefined, "a node default ends with its node");
});

test("the lint catches bad tags, shouting voices, overlap with nothing, and never-say rules", () => {
  const src = ["@node x.a", "speaker: KEEL",
    "line: KEEL: [over cold] First line speaks over nothing.",
    "voice: pride: [shout] Never.",
    "line: KEEL: [cold] I am the Board.",
    "line: KEEL: [cold] The Board quotes you: \"I saw a light.\"",
    "line: KEEL: [cold] Then. <cut>", ""].join("\n");
  const { issues, stats } = lintText(src, "x.lwd");
  const msgs = issues.map((i) => `${i.level} ${i.msg}`);
  assert.ok(msgs.some((m) => /^error \[over\] on the first spoken line/.test(m)));
  assert.ok(msgs.some((m) => /^error an inner voice never shouts/.test(m)));
  assert.equal(msgs.filter((m) => /speaks as the Board/.test(m)).length, 1, "quoted speech is not Keel saying I");
  assert.ok(msgs.some((m) => /^warn <cut> with no spoken line after it/.test(m)));
  assert.equal(stats.spoken, 5); assert.equal(stats.directed, 5);
});

test("one tag drives the portrait and the renderer the same way", () => {
  const calm = portraitCue({ emo: "calm", int: 1 }), angry = portraitCue({ emo: "angry", int: 3 }), grief = portraitCue({ emo: "grieving", int: 2 });
  assert.ok(angry.browInner < calm.browInner, "anger pinches the inner brows down");
  assert.ok(grief.browInner > 0.3 && grief.corners < -0.3, "grief lifts the inner brows and drops the corners");
  assert.equal(portraitCue({ emo: "afraid", int: 2 }).preset, "startled");
  const lie = portraitCue({ emo: "warm", int: 2, lie: true }), warm = portraitCue({ emo: "warm", int: 2 });
  assert.ok(lie.corners < warm.corners, "a lie holds the smile back");
  for (const v of Object.values(angry)) if (typeof v === "number") assert.ok(v >= -1 && v <= 1);
  assert.ok(renderParams({ emo: "angry", int: 3 }).range > renderParams({ emo: "calm", int: 1 }).range);
  assert.equal(renderParams({ vol: "whisper" }).noise, 1);
  assert.ok(renderParams({ emo: "grieving", int: 2 }).rate < 1);
});

test("the read-back reads flat; it re-reads a slur only from the player's own choice, once, unstressed", () => {
  const src = ["@node q.a", "speaker: ABEL",
    "line: READBACK: [flat] Day forty-one, the district office. <pause 1.4> You reported two hundred and ninety.",
    "line: READBACK: [grieving 2] Tomas Haldane died in the cells.",
    "line: READBACK: [flat] You said: \"The tallowmen have it in holes.\" <laugh> {said: q.office.blame}",
    "line: READBACK: The tallowmen hoarded it.",
    "nar: The tallowmen queue at the relief office.",
    "line: ABEL: [warm 1] I'm fond of them. The *tallowmen* never stole from me.",
    "line: ABEL: [warm 1] A tallowman worked for me two summers.",
    "line: READBACK: [flat] Abel said: \"A tallowman worked for me.\"",
    "line: READBACK: [flat] You said: \"The tallowmen took it.\" {said: q.office.blame}",
    "line: READBACK: [flat] You said: \"Tallowmen, tallowmen.\" {said: q.office.twice}",
    "line: READBACK: [flat] You said: \"The tallowmen have it in holes.\" {said: q.office.blame}",
    "line: READBACK: [flat] You said: \"The tallowmen have it in holes.\" {said: q.nowhere}",
    "line: READBACK: [flat] Abel Furrowe, at the Furrowe table, used the word for the Hesh.",
    "opt: \"The tallowmen have it in holes. Ask the Gazette.\" -> q.b {id: q.office.blame}",
    "opt: \"Tallowmen, tallowmen.\" -> q.b {id: q.office.twice}", "",
    "@node q.b", "line: READBACK: [flat] You said: \"The *tallowmen* have it in holes.\" {said: q.office.blame}", ""].join("\n");
  const msgs = lintText(src, "q.lwd").issues.map((i) => `${i.level} ${i.line} ${i.msg}`);
  const at = (n, re) => msgs.some((m) => m.startsWith(`error ${n} `) && re.test(m));
  assert.ok(!msgs.some((m) => m.startsWith("error 3 ")), "a flat line with a pause passes");
  assert.ok(at(4, /reads flat: emotion grieving/));
  assert.ok(at(5, /reads flat: <laugh>/));
  assert.ok(!at(5, /slur|player's choice|quote/), "the player's own chosen words, quoted with their source, pass");
  assert.ok(at(6, /the read-back's own voice/) && at(6, /add \{said:/));
  assert.ok(at(7, /the narrator's own voice/));
  assert.ok(msgs.some((m) => /^warn 8 a slur under \*stress\*/.test(m)), "a character stressing it is a warning");
  assert.ok(!msgs.some((m) => / 9 /.test(m) && /slur/.test(m)), "a character may say it plainly");
  assert.ok(at(10, /NPC's slur is cited by speaker and scene/), "an NPC's slur is not re-read");
  assert.ok(at(11, /not the words of the player's choice q.office.blame/));
  assert.ok(at(12, /once, never repeated/));
  assert.ok(at(13, /already re-read the slur from q.office.blame/));
  assert.ok(at(14, /points to no player choice/));
  assert.ok(!msgs.some((m) => / 15 /.test(m)), "citing by speaker and scene, without the word, passes");
  assert.ok(at(20, /under \*stress\*/), "the read-back never stresses it: an error, not a warning");
});
test("a bracket of unknown words is a writer's marker, kept as text, not a direction block", () => {
  const d = splitDirected("[scaffold] The read-back, read flat.");
  assert.equal(d.text, "[scaffold] The read-back, read flat."); assert.deepEqual(d.dir, {}); assert.deepEqual(d.errors, []);
  const t = splitDirected("[cold scaffold] Typo in a block.");
  assert.equal(t.text, "Typo in a block."); assert.match(t.errors[0], /unknown direction "scaffold"/);
});
