// The read-back as a mechanic (design/quota/04-SYSTEMS.md section 6, pillar 5; PITCHES "What they tell themselves").
// A typed document in two columns, what you told yourself and what happened, with a time and a place on each row,
// read flatly and unskippable. Three kinds of row, in clock order:
//   self   an inner line the character heard that is a self-lie (a voice line tagged {self: <id>}), beside what the
//          @selflie record says happened, by the world as it stands at the read-back
//   said   words the character chose (an option that set a said.* flag that has a @said record), quoted with its
//          source marker (said: <flag>), beside what happened
//   row    an authored row of the @readback record: a time, a place and what happened, with a condition
//   dream  a dream (world/dreams.mjs) whose day has come: what was dreamed, beside what that day showed
//
//   @selflie q.sl.add_up                          the id a voice line names: voice: sum: ... {self: q.sl.add_up}
//   happened: Krall's End under review. ? q_figure == true      (repeatable: every line that holds; a line with
//                                                               no condition only when no conditioned line holds)
//   @said said.ned_report_blamed
//   happened: A list of the Hesh families ... ? true
//   @readback q.record
//   title: THE RECORD. DAY 41. EDRIN, THE UPPER TOWN.
//   head: Ned Furrowe, district inspector. ? q_class == inspector
//   row: 07:10 | The returns room | You signed it as received and found correct. ? q_class == inspector
//   row: day 45 | The cells | Prisoner Haldane, T., found ... ? has(q.tomas_held)
//
// No row is unpaired: a self-lie or said row with no happened line that holds shows "(nothing recorded)", and
// tools/readbackcheck.mjs fails the content that lets that happen. Unskippable: next(now) shows the next row only
// after the last one has been on screen for its reading time (0.6 s plus 0.25 s a word); close() refuses until
// every row has been shown. readback(<id>) opens it from a scene.
// Events: self.lie { id, voice, node } when a tagged line is heard (the art leads' cue for what the character won't
// see), readback.open { id, rows }, readback.row { i, row }, readback.close; self.restored { id } as a self-lie row
// is shown. State: G.state.selfLies, G.state.saidWords, G.state.readback.
import { compile, evaluate, toMin } from "../core/expr.mjs";
import { registerCalls } from "../core/scope.mjs";

const condLine = (value, line) => {
  const i = value.lastIndexOf(" ? "); const text = (i >= 0 ? value.slice(0, i) : value).trim(), src = i >= 0 ? value.slice(i + 3).trim() : null;
  return { text, src, cond: compile(src), line };
};

export function loadReadback(book) {
  const selflies = {}, said = {}, docs = {}, errors = [], R = book.records || {};
  const each = (kind, keys, fn) => { for (const r of Object.values(R[kind] || {})) { try { for (const e of r.kv) if (!keys.includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`); fn(r); } catch (e) { errors.push({ file: r.file, line: r.line, msg: `${kind} ${r.id}: ${e.message}` }); } } };
  each("selflie", ["happened", "about"], (r) => { selflies[r.id] = { id: r.id, happened: r.kv.filter((e) => e.key === "happened").map((e) => condLine(e.value, e.line)), file: r.file, line: r.line }; if (!selflies[r.id].happened.length) throw new SyntaxError("needs happened:"); });
  each("said", ["happened", "about"], (r) => { said[r.id] = { id: r.id, happened: r.kv.filter((e) => e.key === "happened").map((e) => condLine(e.value, e.line)), file: r.file, line: r.line }; if (!r.id.startsWith("said.")) throw new SyntaxError("a @said record is named by its said.* flag"); if (!said[r.id].happened.length) throw new SyntaxError("needs happened:"); });
  each("readback", ["title", "head", "row"], (r) => {
    const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : ""; };
    const rows = r.kv.filter((e) => e.key === "row").map((e) => {
      const parts = e.value.split("|"); if (parts.length < 3) throw new SyntaxError(`line ${e.line}: row: expected "<hh:mm | day N> | place | what happened [? condition]"`);
      const when = parts[0].trim(), c = condLine(parts.slice(2).join("|"), e.line), d = when.match(/^day\s+(\d+)$/i);
      return { when, at: d ? +d[1] * 1440 : toMin(when), where: parts[1].trim(), ...c };
    });
    docs[r.id] = { id: r.id, title: one("title"), heads: r.kv.filter((e) => e.key === "head").map((e) => condLine(e.value, e.line)), rows, file: r.file, line: r.line };
  });
  return { selflies, said, docs, errors };
}

registerCalls({
  readback: (G, [id]) => { if (G.readback) G.readback.open(id); },
  // toldself(id): the character heard that self-lie (so a row it pairs with is not printed twice)
  toldself: (G, [id]) => (G.state.selfLies || []).some((s) => s.id === id),
}, { readback: "readback" });

export const readingMs = (row) => 600 + 250 * `${row.told ? row.told.words : ""} ${row.happened.join(" ")}`.split(/\s+/).filter(Boolean).length;
const hhmm = (c) => `${String(Math.floor(c / 60) % 24).padStart(2, "0")}.${String(Math.floor(c % 60)).padStart(2, "0")}`;

export function installReadback(G, RB) {
  if (G.readback) return G.readback;
  const S = G.state, holds = (l) => !l.cond || !!evaluate(l.cond, G.scope);
  // the self-lies: voice steps tagged {self: id}, found by their key when heard (dialogue/memory.mjs hear)
  const selfByKey = {};
  for (const n of Object.values(G.book.nodes)) for (const s of n.steps || []) if (s.kind === "voice" && s.attrs && s.attrs.self) selfByKey[s.key] = { id: String(s.attrs.self), voice: s.skill, text: s.text, node: n.id };
  const hear = G.memory.hear.bind(G.memory);
  G.memory.hear = (key) => {
    const r = hear(key), sl = selfByKey[key];
    if (sl && !(S.selfLies ||= []).some((x) => x.id === sl.id && x.node === sl.node)) { S.selfLies.push({ ...sl, clock: Math.round(G.clock()), place: G.state.place }); G.emit("self.lie", { id: sl.id, voice: sl.voice, node: sl.node }); }
    return r;
  };
  // the words chosen: the label of the option that set a said.* flag with a @said record
  let lastLabel = null;
  const say = G.memory.say.bind(G.memory);
  G.memory.say = (key, label) => { lastLabel = { key, label, node: G.activeTalk ? G.activeTalk.node : null }; return say(key, label); };
  G.on("flag", (e) => { if (e.on && RB.said[e.id] && lastLabel && !(S.saidWords ||= []).some((x) => x.flag === e.id)) S.saidWords.push({ flag: e.id, words: String(lastLabel.label).replace(/^"|"$/g, ""), node: lastLabel.node, clock: Math.round(G.clock()), place: G.state.place }); });
  const placeName = (p) => ((G.book.places || {})[p] || {}).name || p || "";
  // what happened: every line whose condition holds; a line with no condition only when none of those does
  const happenedOf = (rec) => {
    if (!rec) return ["(nothing recorded)"];
    let h = rec.happened.filter((l) => l.cond && holds(l)); if (!h.length) h = rec.happened.filter((l) => !l.cond);
    return h.length ? h.map((l) => G.fill(l.text)) : ["(nothing recorded)"];
  };
  const api = {
    records: RB,
    // the document as it stands now: { id, title, heads, rows: [{ when, where, at, kind, told: { words, voice?, marker } | null, happened: [...] }] }
    build(id) {
      const D = RB.docs[id]; if (!D) throw new Error(`no @readback ${id}`);
      const rows = [
        ...(S.selfLies || []).map((s) => ({ kind: "self", at: s.clock, when: hhmm(s.clock), where: placeName(s.place), told: { words: s.text, voice: (G.rs.skills[s.voice] || {}).name || s.voice, marker: `self: ${s.id}` }, happened: happenedOf(RB.selflies[s.id]), id: s.id })),
        ...(S.saidWords || []).map((s) => ({ kind: "said", at: s.clock, when: hhmm(s.clock), where: placeName(s.place), told: { words: s.words, marker: `said: ${s.flag}` }, happened: happenedOf(RB.said[s.flag]), id: s.flag })),
        // a dream (world/dreams.mjs) beside the day it named: what was seen, and what that day's table showed; no verdict
        ...(G.state.dreams || []).filter((d) => d.matched != null).map((d) => ({ kind: "dream", at: d.due * 1440, when: `Day ${d.due}`, where: "", told: { words: G.fill(d.text), marker: `dream: ${d.id}` }, happened: [d.nowText ? G.fill(d.nowText) : "(nothing recorded)"], id: d.id })),
        ...D.rows.filter(holds).map((r) => ({ kind: "row", at: r.at, when: /^day/i.test(r.when) ? r.when.replace(/^day/i, "Day") : r.when.replace(":", "."), where: r.where, told: null, happened: [G.fill(r.text)] })),
      ].sort((a, b) => a.at - b.at);
      return { id, title: G.fill(D.title), heads: D.heads.filter(holds).map((h) => G.fill(h.text)), rows };
    },
    open(id) {
      const doc = api.build(id);
      S.readback = { id, doc, shown: 0, lastAt: null, closed: false };
      G.emit("readback.open", { id, rows: doc.rows.length });
      return doc;
    },
    isOpen: () => !!(S.readback && !S.readback.closed),
    // show the next row; refused while the last row's reading time has not passed (now: ms, any clock)
    next(now = Date.now()) {
      const R = S.readback; if (!R || R.closed || R.shown >= R.doc.rows.length) return null;
      if (R.shown > 0 && R.lastAt != null && now - R.lastAt < readingMs(R.doc.rows[R.shown - 1])) return null;
      const row = R.doc.rows[R.shown++]; R.lastAt = now;
      G.emit("readback.row", { i: R.shown - 1, row });
      if (row.kind === "self") G.emit("self.restored", { id: row.id });
      return row;
    },
    done: () => !!(S.readback && S.readback.shown >= S.readback.doc.rows.length),
    // close: refused until every row has been shown and the last has had its reading time
    close(now = Date.now()) {
      const R = S.readback; if (!R || R.closed) return true;
      if (R.shown < R.doc.rows.length) return false;
      if (R.shown > 0 && now - R.lastAt < readingMs(R.doc.rows[R.shown - 1])) return false;
      R.closed = true; G.emit("readback.close", { id: R.id }); return true;
    },
  };
  G.readback = api;
  return api;
}
