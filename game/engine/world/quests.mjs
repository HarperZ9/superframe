// Quests and the journal.
//   state.quests = { id: { stage, log: [{ stage, at }], done } }
//   state.journal = [{ at, kind: "fact" | "quest" | "note", id, text }]
// A quest moves with the effect quest(id, stage); reaching a stage listed in its done line
// closes it. Facts with an about line write themselves into the journal when set.
export function createQuests(G) {
  const rs = G.rs, Q = () => (G.state.quests ||= {}), J = () => (G.state.journal ||= []);
  const api = {
    stage: (id) => (Q()[id] ? Q()[id].stage : ""),
    isDone: (id) => !!(Q()[id] && Q()[id].done),
    set(id, stage) {
      const q = rs.quests[id]; if (!q) throw new Error(`no quest ${id}`);
      const st = q.stages.find((s) => s.id === stage); if (!st) throw new Error(`quest ${id} has no stage ${stage}`);
      const rec = (Q()[id] ||= { stage: "", log: [], done: false });
      if (rec.stage === stage) return;
      rec.stage = stage; rec.log.push({ stage, at: G.clock() });
      if (q.done.includes(stage)) rec.done = true;
      api.write("quest", id, `${q.name}: ${st.text}`);
      G.emit("quest", { id, stage, text: st.text, name: q.name, done: rec.done });
    },
    write(kind, id, text) { J().push({ at: G.clock(), kind, id, text }); },
    journal: () => J(),
    list: () => Object.values(rs.quests).filter((q) => Q()[q.id]).map((q) => ({ ...q, state: Q()[q.id], entries: Q()[q.id].log.map((l) => ({ ...l, text: (q.stages.find((s) => s.id === l.stage) || {}).text })) })),
  };
  return api;
}
