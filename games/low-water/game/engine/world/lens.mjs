// The two lenses (design/quota/04-SYSTEMS.md section 5, The Quota). Wide is the district, seen from above:
// the streets, the queue, the train, the notices, who is served and who is stopped. Narrow is one household
// at its table. An area says which it is (`lens: wide | narrow` on @area); anywhere else is near (the day's
// own scenes). Moving between them is walking (the wide view's exits go to the kitchens, each kitchen's exit
// back out); the look of the move is the rendering lead's (the ink-blot transition), keyed on the `lens`
// event. What a lens shows comes from the model's stocks, as things in the world, never as numbers:
//   @lens id        name; shows: stock (what it is in the world), stock (what) ...
// A level is one of three words, never a figure: little, some, much (for standing: well, uneasy, badly).
//   G.lens.mode()              wide | narrow | near
//   G.lens.signs()             what the current lens shows: [{ at, stock, what, level }]
//   G.lens.shows(stock)        the lenses that show a stock
//   G.lens.look(street)        the wide lens's signs for one street (the player looks across)
//   G.lens.seen()              each time a lens opened: the day, the lens, where, and the signs then
// Events: lens { from, to, area }. Each record event the community keeps is stamped with the lens it was made in.
const kvOf = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };

export function loadLenses(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).lens || {})) {
    const shows = String(kvOf(r, "shows") || "").split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/^([\w.]+)\s*(?:\((.+)\))?$/); return m ? { stock: m[1], what: (m[2] || m[1]).trim() } : null; });
    if (shows.some((x) => !x)) errors.push({ file: r.file, line: r.line, msg: `lens ${r.id}: shows is "stock (what it is), ..."` });
    out[r.id] = { id: r.id, name: kvOf(r, "name") || r.id, shows: shows.filter(Boolean), file: r.file, line: r.line };
  }
  return { lenses: out, errors };
}

// three words for a stock's level; standing reads as how a people is treated
export function levelOf(stock, v) {
  if (v == null || Number.isNaN(+v)) return null;
  if (stock.startsWith("standing.")) return v > 0 ? "well" : v > -0.35 ? "uneasy" : "badly";
  if (["bowls"].includes(stock)) return null; // a count of bowls is a count of bowls: the narrow lens draws them
  if (stock === "price") return v < 1.15 ? "little" : v < 1.5 ? "some" : "much"; // how dear, against a shilling a loaf
  if (stock === "wage") return v >= 1 ? "much" : v >= 0.8 ? "some" : "little";
  const x = +v; return x < 0.25 ? "little" : x < 0.6 ? "some" : "much";
}

export function installLens(G) {
  if (G.lens) return G.lens;
  const L = loadLenses(G.book).lenses;
  if (!Object.keys(L).length) return null;
  const st = () => (G.state.lens ||= { seen: [] });
  const area = () => (G.world && G.world.area ? G.world.area() : null);
  const mode = () => { const a = area(); return (a && a.lens) || "near"; };
  const C = () => G.community;
  // the household a narrow area looks at: the one whose @household names the area's place
  const householdHere = () => { const a = area(), M = C() && C().model; if (!a || !M) return null; return Object.values(M.households).find((h) => h.place === a.place) || null; };
  function signsFor(lens, at, kind) {
    const c = C(); if (!c || !L[lens]) return [];
    return L[lens].shows.map((s) => { const v = kind === "district" ? c.stock(s.stock) : c.stock(s.stock, at); return v == null ? null : { at, stock: s.stock, what: s.what, level: levelOf(s.stock, v), ...(s.stock === "bowls" ? { count: v } : {}) }; }).filter(Boolean);
  }
  const api = {
    mode,
    lenses: L,
    shows: (stock) => Object.values(L).filter((l) => l.shows.some((s) => s.stock === stock)).map((l) => l.id),
    look: (street) => signsFor("wide", street, "street"),
    signs() {
      const m = mode(), c = C(); if (!c) return [];
      if (m === "wide") return Object.keys(c.model.streets).flatMap((s) => signsFor("wide", s, "street"));
      if (m === "narrow") { const h = householdHere(); return h ? signsFor("narrow", h.id, "household") : []; }
      return [];
    },
    seen: () => [...st().seen],
  };
  G.lens = api;
  let last = mode();
  G.on("area", ({ id }) => {
    const now = mode(); if (now === last) return;
    G.emit("lens", { from: last, to: now, area: id }); last = now;
    if (now !== "near") st().seen.push({ day: C() ? C().day() : null, lens: now, area: id, signs: api.signs().map((s) => `${s.at}:${s.stock}:${s.level ?? s.count}`) });
  });
  G.on("community.record", (ev) => { ev.lens = mode(); });
  return api;
}
