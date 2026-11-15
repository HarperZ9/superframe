// The world-state echo: what happened shows in the place, not in a record. Game-agnostic: a story names its echoes
// (@echo), each a change a place or a person carries while a condition holds, from an era on. When the player
// comes into the place the echo is felt: one line of what the senses meet, its cue, and a change the shell draws
// (a chair left empty, a person who stands differently, a figure who is no longer there, a door left open, a sound
// in the room). Fate flags, lore fragments and the world record from earlier runs reach the player this way.
//
//   @echo q.e.chair
//   place: q_haldane                 where it is felt (repeatable, or comma separated)
//   when: has(q.tomas_held)          the condition (a fate, a flag, the model, prior(fact) from an earlier run)
//   from: 2                          the first era it holds in (optional; to: the last)
//   tells: fate f.tomas_held         what it echoes: fate <id> | fact <id> | flag <id> | lore <id>   (repeatable)
//   show: seat table empty           seat <mark> empty | absent <char> | person <char> <posture> | door <mark> open
//                                    | sound <sfx> [volume] [near|far|wall|under] | light <dim|cold|warm>   (repeatable)
//   line: Nobody has pushed the fourth stool back against the wall.     the line the senses meet, once an era
//   sense: echo.chair                a @sense fired when it is felt (optional)
//   gives: q.lore.chair              lore fragments found when it is felt (optional, comma separated)
//
// Felt: on entering the place inside a scene (dialogue/runner.mjs puts the sense line at the top of the beat) or in
// free roam (the shell shows it as the margin card). Each echo is felt once an era; G.state.echoes keeps the ids.
//   G.echo.at(place) -> echoes that hold there now       G.echo.enter(place) -> lines to show (marks them felt)
//   G.echo.shows(place) -> the show: changes that hold   G.echo.absent(place) -> chars not to draw
import { compile, evaluate } from "../core/expr.mjs";
import { POSTURES } from "./senses.mjs"; // a person <char> <posture> is drawn by the people layer while the echo holds

const KEYS = ["place", "when", "from", "to", "tells", "show", "line", "sense", "gives", "about"];
const TELLS = ["fate", "fact", "flag", "lore", "worldfact"];
const SHOWS = ["seat", "absent", "person", "door", "sound", "light"];
const list = (v) => (v ? String(v).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) : []);

export function parseShow(v, line) {
  const w = v.trim().split(/\s+/), k = w[0];
  if (!SHOWS.includes(k)) throw new SyntaxError(`line ${line}: show: ${k} (one of ${SHOWS.join(", ")})`);
  if (k === "seat" && !(w[1] && w[2] === "empty")) throw new SyntaxError(`line ${line}: show: seat <mark> empty`);
  if (k === "absent" && !w[1]) throw new SyntaxError(`line ${line}: show: absent <char>`);
  if (k === "person" && !(w[1] && POSTURES.includes(w[2]))) throw new SyntaxError(`line ${line}: show: person <char> <posture> (${POSTURES.join(", ")})`);
  if (k === "door" && !(w[1] && ["open", "shut", "boarded"].includes(w[2]))) throw new SyntaxError(`line ${line}: show: door <mark> open | shut | boarded`);
  if (k === "light" && !["dim", "cold", "warm"].includes(w[1])) throw new SyntaxError(`line ${line}: show: light dim | cold | warm`);
  if (k === "sound" && !w[1]) throw new SyntaxError(`line ${line}: show: sound <sfx> [volume] [near|far|wall|under]`);
  return { kind: k, id: w[1], arg: w[2] || null, vol: k === "sound" ? +(w[2] || 0.4) : null, at: k === "sound" ? w[3] || "near" : null };
}

export function loadEchoes(book) {
  const echoes = {}, errors = [];
  for (const r of Object.values((book.records || {}).echo || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!KEYS.includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      const places = r.kv.filter((e) => e.key === "place").flatMap((e) => list(e.value)); if (!places.length) throw new SyntaxError("needs place:");
      const tells = r.kv.filter((e) => e.key === "tells").map((e) => { const [k, id] = e.value.trim().split(/\s+/); if (!TELLS.includes(k) || !id) throw new SyntaxError(`line ${e.line}: tells: ${TELLS.join(" | ")} <id>`); return { kind: k, id }; });
      if (!tells.length) throw new SyntaxError("needs tells: (what in the story it echoes)");
      const show = r.kv.filter((e) => e.key === "show").map((e) => parseShow(e.value, e.line));
      const sense = one("line") || ""; if (!sense && !show.length) throw new SyntaxError("needs line: or show: (an echo the player cannot meet echoes nothing)");
      echoes[r.id] = { id: r.id, places, when: one("when") || null, cond: compile(one("when") || null), from: one("from") != null ? +one("from") : null, to: one("to") != null ? +one("to") : null,
        tells, show, sense, cue: one("sense") || null, gives: list(one("gives")), file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `echo ${r.id}: ${e.message}` }); }
  }
  return { echoes, errors };
}

export function installEcho(G, echoes = {}) {
  if (G.echo) return G.echo;
  const era = () => +G.state.vars.era || +(G.book.meta || {}).era || 1;
  const felt = () => (G.state.echoes ||= []);
  const holds = (e) => { const n = era(); if (e.from != null && n < e.from) return false; if (e.to != null && n > e.to) return false; return !e.cond || !!evaluate(e.cond, G.scope); };
  const api = {
    echoes,
    at: (place = G.state.place) => Object.values(echoes).filter((e) => e.places.includes(place) && holds(e)),
    felt: (id) => felt().some((x) => x.id === id),
    // coming into a place: the echoes not yet felt this era, as narrated lines; fires their cues and finds their lore
    enter(place = G.state.place) {
      const out = [], n = era();
      for (const e of api.at(place)) {
        if (felt().some((x) => x.id === e.id && x.era === n)) continue;
        felt().push({ id: e.id, era: n, place, clock: Math.round(G.clock()) });
        G.setFlag(`echo.${e.id}`, true);
        G.emit("echo", { id: e.id, place, show: e.show, tells: e.tells });
        if (e.cue && G.senses) G.senses.fire(e.cue, { via: `echo:${e.id}` });
        for (const f of e.gives) if (G.lore) G.lore.find(f, { via: `echo:${e.id}` });
        if (e.sense) out.push({ kind: "nar", who: "", text: G.fill ? G.fill(e.sense) : e.sense, echo: e.id });
      }
      return out;
    },
    // what the shell draws while the echo holds (whether or not its line was shown yet)
    shows: (place = G.state.place) => api.at(place).flatMap((e) => e.show.map((s) => ({ ...s, echo: e.id }))),
    absent: (place = G.state.place) => api.shows(place).filter((s) => s.kind === "absent").map((s) => s.id),
  };
  G.echo = api;
  return api;
}
