// Districts and areas as data.
//   @district id   name, about, zone, next (comma list), map (x y on the town map, 0..1),
//                  travel (minutes to walk there from a neighbouring district; @rules
//                  travel-minutes, default 10), arrive (the area travel lands in; else the
//                  district's first area)
//   @area id       name, district, plate (content folder), variant, place (LWD place id),
//                  spawn (x y z), grid (x0 z0 cell nx nz), walk (surface ids), enter (node, played
//                  on the first visit; enter-every: yes plays it on every visit), footing,
//                  arena: <arena id> x y z yaw (where a fight's arena lies on this plate: world/stage.mjs)
//                  hotspot: "label" -> node [? cond] {at: x y z, r: n, once: flag, who: figure}
//                  exit:    "label" -> area [? cond] {at: x y z, r: n, spawn: x y z, cost: min}
//                  figure:  id {at: x y z, face: 1|-1, when: cond, wander: r (walks about within r m)}
//                  places:  more LWD place ids shown on this plate (space list)
//                  voice:   skill dc "text" {at: x y z, r: n, when: cond, once}   a passive voice line
//                           said as a bark when Lamb walks within r and the skill meets dc
// When the script moves Lamb to a place (a node's place:) and an area shows that place, the world
// follows: that area becomes current with Lamb at its spawn, and no enter node plays (the script
// is already telling the scene). An area that shows the current place stays as it is.
// Several hotspot lines at one spot form a priority list: the first whose condition holds
// is the one offered. state.area is the current area; state.seen.areas the visited ones.
import { parseChoice, splitAttrs } from "../dialogue/parse.mjs";
import { compile, evaluate } from "../core/expr.mjs";
import { parseArenaLines } from "./stage.mjs";

const vec = (s) => (s == null ? null : String(s).trim().split(/\s+/).map(Number));

export function loadDistricts(book) {
  const R = book.records || {}, errors = [], districts = {}, areas = {};
  for (const r of Object.values(R.district || {})) {
    const g = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
    districts[r.id] = { id: r.id, travel: g("travel") != null ? +g("travel") : null, arrive: g("arrive") || null, name: g("name") || r.id, about: g("about") || "", zone: g("zone") || r.id, next: (g("next") || "").split(",").map((s) => s.trim()).filter(Boolean), map: vec(g("map")) || [0.5, 0.5], file: r.file, line: r.line };
  }
  for (const r of Object.values(R.area || {})) {
    try { areas[r.id] = loadArea(r); } catch (e) { errors.push({ file: r.file, line: r.line, msg: `area ${r.id}: ${e.message}` }); }
  }
  for (const a of Object.values(areas)) {
    if (a.district && !districts[a.district]) errors.push({ file: a.file, line: a.line, msg: `area ${a.id}: district ${a.district} is not defined` });
    for (const x of a.exits) if (!areas[x.target]) errors.push({ file: a.file, line: x.line, msg: `area ${a.id}: exit to unknown area ${x.target}` });
  }
  for (const d of Object.values(districts)) for (const n of d.next) if (!districts[n]) errors.push({ file: d.file, line: d.line, msg: `district ${d.id}: next ${n} is not defined` });
  return { districts, areas, errors };
}

function loadArea(r) {
  const g = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
  const at = (kv) => ({ file: r.file, line: kv.line, node: r.id });
  const spot = (s) => ({ ...s, at: vec(s.attrs.at) || [0, 0, 0], r: s.attrs.r ?? 1.2 });
  const grid = vec(g("grid"));
  return {
    id: r.id, name: g("name") || r.id, district: g("district") || null, plate: g("plate") || null, variant: g("variant") || "night", place: g("place") || r.id, places: (g("places") || "").split(/[\s,]+/).filter(Boolean),
    spawn: vec(g("spawn")) || [0, 0, 0], enter: g("enter") || null, enterEvery: /^(yes|true)$/i.test(g("enter-every") || ""), camera: g("camera") != null ? +g("camera") : null,
    arenas: parseArenaLines(r.kv.filter((e) => e.key === "arena").map((e) => e.value)), about: g("about") || "",
    grid: grid ? { x0: grid[0], z0: grid[1], cell: grid[2], nx: grid[3], nz: grid[4] } : null,
    walk: g("walk") ? g("walk").split(/[\s,]+/).map(Number) : null,
    hotspots: r.kv.filter((e) => e.key === "hotspot").map((e) => spot(parseChoice("hotspot", e.value, at(e)))),
    exits: r.kv.filter((e) => e.key === "exit").map((e) => { const s = spot(parseChoice("exit", e.value, at(e))); s.spawnAt = vec(s.attrs.spawn); return s; }),
    voices: r.kv.filter((e) => e.key === "voice").map((e) => { const { body, attrs } = splitAttrs(e.value), m = body.trim().match(/^(\S+)\s+(\d+)\s+"(.*)"$/); if (!m) throw new SyntaxError(`voice: expected skill dc "text" {at, r}, got ${e.value}`); return { key: `${r.id}.voice.${e.line}`, skill: m[1], dc: +m[2], text: m[3], at: vec(attrs.at) || null, r: +attrs.r || 2, cond: compile(attrs.when), once: attrs.once !== false, line: e.line }; }),
    figures: r.kv.filter((e) => e.key === "figure").map((e) => { const { body, attrs } = splitAttrs(e.value); return { id: body.trim(), at: vec(attrs.at) || [0, 0, 0], face: attrs.face ?? 1, wander: +attrs.wander || 0, cond: compile(attrs.when), line: e.line }; }),
    file: r.file, line: r.line,
  };
}

export function createWorldMap(G, data) {
  const st = () => G.state;
  const shows = (a, p) => !!a && (a.place === p || (a.places || []).includes(p));
  G.on("place", ({ id }) => {
    if (shows(data.areas[st().area], id)) return;
    const a = Object.values(data.areas).find((x) => x.place === id) || Object.values(data.areas).find((x) => shows(x, id));
    if (!a) return;
    const from = st().area; st().area = a.id; st().pos = [...a.spawn];
    G.emit("area", { id: a.id, from, first: false, follow: true });
  });
  const api = {
    ...data,
    area: () => data.areas[st().area] || null,
    // The area's district, else the current place's (hub-only districts have no areas).
    district: () => {
      const a = api.area(); if (a && a.district) return data.districts[a.district] || null;
      const p = G.book.places[st().place]; return p && p.district ? data.districts[p.district] || { id: p.district, name: p.district, next: [] } : null;
    },
    // Hotspots on offer now, one per spot.
    hotspots() {
      const a = api.area(); if (!a) return [];
      const out = [], taken = new Set();
      for (const h of a.hotspots) {
        const k = h.at.join(","); if (taken.has(k)) continue;
        if (h.attrs.once && G.flag(String(h.attrs.once))) continue;
        if (h.cond && !evaluate(h.cond, G.scope)) continue;
        taken.add(k); out.push(h);
      }
      return out;
    },
    exits: () => { const a = api.area(); return a ? a.exits.filter((x) => !x.cond || evaluate(x.cond, G.scope)) : []; },
    figures: () => { const a = api.area(); return a ? a.figures.filter((f) => !f.cond || evaluate(f.cond, G.scope)) : []; },
    // Move to an area. Returns the node to play on entry, if any.
    enter(id, { spawn = null } = {}) {
      const a = data.areas[id]; if (!a) throw new Error(`no area ${id}`);
      const from = st().area; st().area = id; st().pos = spawn ? [...spawn] : [...a.spawn];
      const seen = (st().seen ||= { areas: [], districts: [] }), first = !seen.areas.includes(id);
      if (first) seen.areas.push(id);
      if (a.district && !seen.districts.includes(a.district)) seen.districts.push(a.district);
      if (a.place) G.setPlace(a.place);
      G.emit("area", { id, from, first });
      return a.enter && (first || a.enterEvery) ? a.enter : null;
    },
    known: (d) => ((st().seen || {}).districts || []).includes(d),
    // Travel from the Map: to a district next to this one (or any known one, the long way: the
    // walk's minutes once per district between). travelTo(d) -> { minutes, why } without moving;
    // travel(d) -> { minutes, node, why } moves Lamb: the clock runs, and Lamb arrives in the
    // district's arrive area (or its first area) at its spawn; node is that area's enter node.
    travelTo(d) {
      const to = data.districts[d], here = api.district();
      if (!to) return { minutes: 0, why: `There is no ${d} on the chart` };
      if (here && here.id === d) return { minutes: 0, why: "Lamb is here already" };
      const per = (x) => (x.travel != null ? x.travel : +G.rs.rules["travel-minutes"] || 10);
      if (!here || here.next.includes(d)) return { minutes: per(to), why: null };
      // the long way round: fewest districts between, through ones Lamb knows
      const prev = new Map([[here.id, null]]), q = [here.id];
      while (q.length) { const c = q.shift(); for (const n of (data.districts[c] || { next: [] }).next) if (!prev.has(n) && data.districts[n] && (n === d || api.known(n))) { prev.set(n, c); q.push(n); } }
      if (!prev.has(d)) return { minutes: 0, why: "Lamb does not know the way there yet" };
      let m = 0; for (let c = d; c && c !== here.id; c = prev.get(c)) m += per(data.districts[c]);
      return { minutes: m, why: null };
    },
    travel(d) {
      const t = api.travelTo(d); if (t.why) return { ...t, node: null };
      const to = data.districts[d], a = (to.arrive && data.areas[to.arrive]) || Object.values(data.areas).find((x) => x.district === d);
      G.advance(t.minutes);
      const node = a ? api.enter(a.id) : null;
      if (!a) { const p = Object.values(G.book.places).find((x) => x.district === d); if (p) G.setPlace(p.id); }
      const seen = (st().seen ||= { areas: [], districts: [] }); if (!seen.districts.includes(d)) seen.districts.push(d);
      G.emit("travel", { to: d, minutes: t.minutes });
      return { minutes: t.minutes, node, why: null };
    },
  };
  return api;
}
