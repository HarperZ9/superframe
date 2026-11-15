// The read-back (world/readback.mjs): self-lies heard and paired with what happened, chosen words quoted with their
// markers, rows in clock order, and a document that cannot be skipped; and the read-back check on bad content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintReadback, checkReadbackRuns } from "../tools/readbackcheck.mjs";
import { readingMs } from "../world/readback.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources, text = base.map((s) => s.text).join("\n");
const content = loadContent(base);
const game = (cls = "militia") => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; return G; };
const pick = (t, words) => t.choose(t.beat.options.findIndex((o) => o.label.includes(words)));

test("a tagged inner line heard is a self-lie, once; the words chosen are kept as said", () => {
  const G = game("inspector"), lies = []; G.on("self.lie", (e) => lies.push(e.id));
  const t = G.talk("q.office.ned"); G.talk("q.office.ned");
  assert.deepEqual(G.state.selfLies.map((s) => s.id), ["q.sl.add_up"]); assert.deepEqual(lies, ["q.sl.add_up"]);
  pick(t, "Stand by the pan and watch the arm");
  assert.deepEqual(G.state.saidWords.map((s) => [s.flag, s.words]), [["said.ned_report_inflated", "Stand by the pan and watch the arm."]]);
});

test("the document: self-lies beside what happened, said words with their marker, authored rows, in clock order", () => {
  const G = game("militia");
  G.talk("q.will.orders"); // hears BALLAST on the forty carts, over the post's orders
  G.state.vars.q_cart = "arrested"; G.setFlag("q.tomas_held", true);
  const t = G.talk("q.office.will"); pick(t, "tallowmen");
  const doc = G.readback.build("q.record"), self = doc.rows.find((r) => r.kind === "self"), said = doc.rows.find((r) => r.kind === "said");
  assert.equal(doc.title, "THE RECORD. EDRIN, THE UPPER TOWN."); assert.deepEqual(doc.heads, ["Will Brack, sergeant of militia."]);
  assert.equal(self.id, "q.sl.forty_carts"); assert.match(self.told.words, /forty go tomorrow/); assert.equal(self.told.marker, "self: q.sl.forty_carts");
  assert.deepEqual(self.happened, ["Tomas Haldane held for carrying grain for the hill. He had not been up the hill since harvest."], "the conditioned line, not the fallback");
  assert.equal(said.told.marker, "said: said.will_report_blamed"); assert.match(said.happened[0], /with a lump of chalk/);
  assert.ok(!doc.rows.some((r) => r.kind === "row" && /Tomas Haldane held for carrying/.test(r.happened[0])), "the paired row is not printed twice (toldself)");
  assert.ok(doc.rows.some((r) => r.when === "Day 45"));
  for (let i = 1; i < doc.rows.length; i++) assert.ok(doc.rows[i].at >= doc.rows[i - 1].at, "clock order");
});

test("it cannot be skipped: the next row waits for the last one's reading time, and it closes only when read", () => {
  const G = game("inspector"); G.talk("q.office.ned"); const t = G.talk("q.office.ned"); pick(t, "look under the pan");
  const ev = []; for (const k of ["readback.open", "readback.row", "self.restored", "readback.close"]) G.on(k, () => ev.push(k));
  const doc = G.readback.open("q.record"); assert.ok(doc.rows.length >= 2);
  const r0 = G.readback.next(0); assert.ok(r0);
  assert.equal(G.readback.next(10), null, "too soon"); assert.equal(G.readback.close(10), false, "not every row is shown");
  let now = 0; for (let i = 1; i < doc.rows.length; i++) { now += readingMs(doc.rows[i - 1]); assert.ok(G.readback.next(now), `row ${i}`); }
  assert.equal(G.readback.close(now + 1), false, "the last row has its reading time too");
  assert.equal(G.readback.close(now + readingMs(doc.rows.at(-1))), true);
  assert.ok(ev.includes("self.restored") && ev[0] === "readback.open" && ev.at(-1) === "readback.close");
  // the scene no longer shows the document: it plays the witness (world/witness.mjs), and the ledger is its oracle
  G.talk("q.readback"); assert.equal((G.state.witness || {}).id, "q.w.anni", "the scene plays the witness that replaced it");
});

test("the read-back lint and the played check catch bad content", () => {
  const bad = `@node x.voices
voice: sum: A line nobody defined. {self: x.nothing}
go: q.start

@selflie x.untagged
happened: Something, somewhere, to someone with a name.

@said said.nobody_sets
happened: Something else.
`;
  const C = loadContent([...base, { file: "bad.lwd", text: bad }]), G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: "q.ned", enter: false });
  const msgs = lintReadback(C, G, text + bad).map((o) => o.msg).join("\n");
  assert.match(msgs, /x\.voices: voice tagged self: x\.nothing, which no @selflie defines/);
  assert.match(msgs, /selflie x\.untagged: no voice line is tagged with it/);
  assert.match(msgs, /said said\.nobody_sets: no option sets that flag/);
  assert.deepEqual(lintReadback(content, game(), text), []);
  const row = (o) => ({ kind: "row", at: 0, when: "00.00", where: "", told: null, happened: ["x"], ...o });
  const good = { selfLies: ["q.sl.check"], said: [{ flag: "said.will_report_true", words: "Forty sacks" }], voices: 10, skip: { secondRefused: true, earlyRefused: true, closed: true },
    doc: { rows: [row({ kind: "self", id: "q.sl.check", at: 1, told: { words: "w", marker: "self: q.sl.check" } }), row({ kind: "said", id: "said.will_report_true", at: 2, told: { words: "Forty sacks", marker: "said: said.will_report_true" } })] } };
  assert.equal(checkReadbackRuns(content, [{ build: "g", finished: true, endings: { class: "militia" }, readback: good }]).errors, 0);
  const bad2 = { ...good, voices: 2, skip: { secondRefused: false, earlyRefused: false, closed: true }, said: [{ flag: "said.will_report_true", words: "Something else" }],
    doc: { rows: [row({ kind: "self", id: "q.sl.check", at: 5, told: { words: "w", marker: "self: q.sl.check" }, happened: ["(nothing recorded)"] }), row({ at: 1 })] } };
  const out = checkReadbackRuns(content, [{ build: "b", finished: true, endings: { class: "militia" }, readback: bad2 }, { build: "c", finished: true }]).lines.join("\n");
  for (const re of [/b: the self-lie q\.sl\.check is paired with nothing/, /b: said\.will_report_true is not quoted word for word/, /b: rows out of clock order/, /b: the second row came before/, /b: the read-back closed before/, /militia: 1 self-lies in 2 voice lines .*: most inner lines must be true/, /c: finished without a read-back/]) assert.match(out, re);
});
