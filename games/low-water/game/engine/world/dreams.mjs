// Dreams and premonition (PITCHES round 4: dreams and precognition are texture, never fact; DISCOURSE-SYSTEM 5a:
// dreams are claims too). A dream previews a possible future from the community model as it stands: the model is
// copied, the dreamer's fear is applied to the copy, and the copy runs on for the dream's days. What the dreamer
// sees is the first see: line that holds in that future. When the day comes, the same lines are read in the real
// world, and the dream either matches or it does not. The game never says which reading is right: premonition or
// fear. Both are kept (reading: lines), the read-back sets the dream beside the day it named, and the art gets a
// cue when a dream matches (the dream look's one-frame recognition, cmd "dream cue").
//
//   @dream q.dream.table
//   days: 7                                   how far ahead it looks
//   fear: shift(food, -0.08, haldane) ? q_class == militia   what the dreamer's fear does to the copy before it runs
//                                              (optional, repeatable: the first whose condition holds; each dreamer
//                                              fears their own part in it)
//   see: Three bowls ... ? bowls(haldane) <= 3 the first that holds in the projected future; the last is a fallback
//   see: Five bowls ...
//   reading: premonition | It is coming.       both readings, kept (at least two)
//   reading: fear | It is only the count.
//
// In a scene: nar: {{dream(q.dream.table)}} dreams it and shows what was seen (once a night; again it repeats the
// same dream). State: G.state.dreams [{ id, at (day), due (day), seen, text, matched }]. Events: dream.seen
// { id, seen, due }, dream.due { id, seen, now, matched }. The projection does not touch the real model, emits no
// events and writes no flags.
import { compile, compileEffects, evaluate, runEffects } from "../core/expr.mjs";
import { registerCalls } from "../core/scope.mjs";

export function loadDreams(book) {
  const dreams = {}, errors = [];
  for (const r of Object.values((book.records || {}).dream || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!["days", "fear", "see", "reading", "about"].includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      const see = r.kv.filter((e) => e.key === "see").map((e, i) => { const k = e.value.lastIndexOf(" ? "); const src = k >= 0 ? e.value.slice(k + 3).trim() : null; return { id: `s${i + 1}`, text: (k >= 0 ? e.value.slice(0, k) : e.value).trim(), src, cond: compile(src), line: e.line }; });
      if (!see.length) throw new SyntaxError("needs see:");
      const readings = r.kv.filter((e) => e.key === "reading").map((e) => { const [k, ...t] = e.value.split("|"); return { id: k.trim(), text: t.join("|").trim() }; });
      // fear: effects [? condition], repeatable: each dreamer's own fear (the first whose condition holds)
      const fears = r.kv.filter((e) => e.key === "fear").map((e) => { const k = e.value.lastIndexOf(" ? "); const src = k >= 0 ? e.value.slice(k + 3).trim() : null; return { effects: compileEffects((k >= 0 ? e.value.slice(0, k) : e.value).trim()), src: e.value.trim(), cond: compile(src) }; });
      dreams[r.id] = { id: r.id, days: +(one("days") || 1), fears, see, readings, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `dream ${r.id}: ${e.message}` }); }
  }
  return { dreams, errors };
}

registerCalls({ dream: (G, [id]) => (G.dreams ? G.dreams.dream(id) : "") }, { dream: "dream" });

export function installDreams(G, dreams) {
  if (G.dreams) return G.dreams;
  const S = () => (G.state.dreams ||= []);
  const firstSee = (d) => d.see.find((s) => !s.cond || evaluate(s.cond, G.scope)) || null;
  // run the model forward on a copy, with the dreamer's fear applied first; put everything back after
  function project(d) {
    const C = G.community; if (!C) return firstSee(d);
    const live = C.state, snap = structuredClone(live), emit = G.emit, vars = structuredClone(G.state.vars), flags = [...G.state.flags];
    G.emit = () => {};
    try { const f = (d.fears || []).find((x) => !x.cond || evaluate(x.cond, G.scope)); if (f && f.effects) runEffects(f.effects, G.scope); C.run(d.days); return firstSee(d); }
    finally { for (const k of Object.keys(live)) delete live[k]; Object.assign(live, snap); G.state.vars = vars; G.state.flags = flags; G.emit = emit; }
  }
  const api = {
    all: dreams,
    project: (id) => project(dreams[id]),
    dream(id) {
      const d = dreams[id]; if (!d) throw new Error(`no dream ${id}`);
      const day = G.community ? G.community.day() : 0, had = S().find((x) => x.id === id && x.at === day);
      if (had) return G.fill(had.text);
      const s = project(d); if (!s) return "";
      S().push({ id, at: day, due: day + d.days, seen: s.id, text: s.text, matched: null });
      G.emit("dream.seen", { id, seen: s.id, due: day + d.days });
      return G.fill(s.text);
    },
    // a dream whose day has come: the same lines read in the real world
    settle() {
      if (!G.community) return;
      for (const x of S()) if (x.matched == null && G.community.day() >= x.due) {
        const now = firstSee(dreams[x.id]); x.now = now ? now.id : null; x.nowText = now ? now.text : ""; x.matched = !!now && now.id === x.seen;
        G.emit("dream.due", { id: x.id, seen: x.seen, now: x.now, matched: x.matched });
        if (x.matched && G.command) G.command(["dream", "cue"], `dream:${x.id}`);
      }
    },
    list: () => S().map((x) => ({ ...x })),
  };
  // settle once the day's whole tick has run (the model's own time handler runs first): a rule event would come
  // mid-tick, before the day's last rules, and read a table the day had not finished laying (2026-10-22: every
  // sergeant's run was read as a miss that way)
  G.on("time", () => api.settle());
  G.dreams = api;
  return api;
}
