// Gates as data (design/SYSTEMS-FULL.md 19.4): every gate pays one page the first time it is
// resolved, by whichever route, so all five styles level at the same rate and writers do not
// hand-place a page at every route.
//   @gate id
//   name: The works order                 (shown when the page is paid)
//   resolved: works.order                 (repeatable: any one of these flags resolves the gate;
//   resolved: works.inferred               list only winning outcomes: losing never pays)
//   pages: 1                              (default @rules gate-pages, 1)
// When the first of a gate's flags is set, the engine pays its pages through the sheet's own
// levelling (xp, so levels and points follow @rules xp-per-level and points-per-level) and emits
// "gate" { id, name, pages } for the interface. state.gates = { id: clock when paid }.
// A gate resolved before its record existed (an older save) pays on load, once.
export function loadGates(book) {
  const out = {}, byFlag = {}, errors = [];
  for (const r of Object.values((book.records || {}).gate || {})) {
    const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
    const resolved = r.kv.filter((e) => e.key === "resolved").map((e) => e.value.trim()).filter(Boolean);
    if (!resolved.length) { errors.push({ file: r.file, line: r.line, msg: `gate ${r.id}: needs at least one resolved: flag` }); continue; }
    out[r.id] = { id: r.id, name: one("name") || r.id, resolved, pages: one("pages") != null ? +one("pages") : null, file: r.file, line: r.line };
    for (const f of resolved) (byFlag[f] ||= []).push(r.id);
  }
  return { gates: out, byFlag, errors };
}

export function createGates(G, { gates, byFlag }) {
  const S = () => (G.state.gates ||= {});
  const pay = (id) => {
    if ((G.state.gates || {})[id] != null) return false;
    const g = gates[id], n = g.pages ?? +(G.rs.rules["gate-pages"] ?? 1);
    S()[id] = G.clock(); if (n > 0) G.sheet.addXp(n);
    if (G.memory) G.memory.log({ node: "", kind: "page", who: "PAGE", text: `${g.name}: ${n === 1 ? "a page filed" : `${n} pages filed`}`, hidden: true });
    G.emit("gate", { id, name: g.name, pages: n }); return true;
  };
  G.on("flag", (e) => { if (e.on) for (const id of byFlag[e.id] || []) pay(id); });
  const api = {
    gates,
    paid: (id) => (G.state.gates || {})[id] != null,
    list: () => Object.values(gates).map((g) => ({ ...g, paid: api.paid(g.id), at: (G.state.gates || {})[g.id] ?? null })),
    // after a load: pay any gate whose flag is already set (a save from before the gate existed)
    settle() { for (const g of Object.values(gates)) if (!api.paid(g.id) && g.resolved.some((f) => G.flag(f))) pay(g.id); },
  };
  return api;
}
