// Weight and encumbrance: what the player carries is felt, never counted. Game-agnostic: a story names its loads
// (@load) and its scales (@scale); the body takes them on and puts them down; the walk slows, the figure bends,
// and the pad and the speakers carry each sack as it lands. No number reaches the screen: the shell reads gait()
// and posture(), and the harness keeps the burden in the run for the checkers (tools/devicecheck.mjs).
//
//   @load q.sack_barley
//   name: A sack of barley
//   weight: 30                 kilograms: the body's arithmetic, never shown
//   line: The sack settles across your shoulder blades, and the cold of it comes through the coat.   (optional)
//   sense: burden.sack         the @sense fired when it is shouldered (default: burden.shoulder, when the story has it)
//
//   @scale q.exchange_scale    a balance: two pans; tip() compares what is on them and fires the scale's cue
//   name: The exchange scale
//   sense: scale.tip           the @sense fired when the arm moves (the strength rides on the event)
//
// Effects:  shoulder(load[, n])  setdown(load[, n])  setdown(all)  pan(scale, left|right, load[, n])
//           empty(scale)  tip(scale)            (tip sets var.tip.<scale> to left, right or level)
// Names:    burden (the total, kilograms)  gait (0.3 to 1: the walk's share of a free walk)
// Calls:    carrying(load)  heavy() (bent or worse)  tipped(scale, left|right|level)
// The body: free under @meta burden-free (default 8 kg); the walk falls off over @meta burden-span (default 60 kg)
// to burden-min (default 0.3); postures: upright, bent (from 15 kg), stagger (from 40 kg). Each change of posture
// fires burden.<posture> when the story has that @sense, and holds the player's figure in it.
//   G.burden.total() G.burden.gait() G.burden.posture() G.burden.items() G.burden.scales
import { registerCalls } from "../core/scope.mjs";

const KEYS = ["name", "weight", "line", "sense", "about"];
const SCALE_KEYS = ["name", "sense", "about"];
export const POSTURES = [["stagger", 40], ["bent", 15], ["upright", 0]];

export function loadBurden(book) {
  const loads = {}, scales = {}, errors = [], R = book.records || {};
  for (const r of Object.values(R.load || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!KEYS.includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      const w = +one("weight"); if (!(w > 0)) throw new SyntaxError("weight: kilograms, above 0");
      loads[r.id] = { id: r.id, name: one("name") || r.id, weight: w, text: one("line") || "", cue: one("sense") || null, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `load ${r.id}: ${e.message}` }); }
  }
  for (const r of Object.values(R.scale || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!SCALE_KEYS.includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      scales[r.id] = { id: r.id, name: one("name") || r.id, cue: one("sense") || null, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `scale ${r.id}: ${e.message}` }); }
  }
  return { loads, scales, errors };
}

export const postureOf = (kg) => POSTURES.find(([, from]) => kg >= from)[0];
export function gaitOf(kg, { free = 8, span = 60, min = 0.3 } = {}) { return Math.max(min, Math.min(1, 1 - Math.max(0, kg - free) / span)); }

registerCalls({
  shoulder: (G, [id], [, n]) => G.burden.shoulder(id, n == null ? 1 : +n),
  setdown: (G, [id], [, n]) => G.burden.setdown(id, n == null ? null : +n),
  pan: (G, [scale, side, id], [, , , n]) => G.burden.pan(scale, side, id, n == null ? 1 : +n),
  empty: (G, [scale]) => G.burden.empty(scale),
  tip: (G, [scale]) => G.burden.tip(scale),
  carrying: (G, [id]) => G.burden.count(id) > 0,
  heavy: (G) => G.burden.posture() !== "upright",
  tipped: (G, [scale, side]) => G.burden.tipped(scale) === side,
}, { shoulder: "load", setdown: "load", carrying: "load", pan: "scale", empty: "scale", tip: "scale", tipped: "scale" });

export function installBurden(G, B = { loads: {}, scales: {} }) {
  if (G.burden) return G.burden;
  const meta = G.book.meta || {}, opts = { free: +(meta["burden-free"] ?? 8), span: +(meta["burden-span"] ?? 60), min: +(meta["burden-min"] ?? 0.3) };
  const S = () => (G.state.burden ||= { items: {}, pans: {}, tip: {} });
  const load = (id) => { const l = B.loads[id]; if (!l) throw new Error(`burden: no @load ${id}`); return l; };
  const fire = (id, via) => { if (id && G.senses && G.senses.has(id)) G.senses.fire(id, { via }); };
  let last = null;
  function changed(delta, id) {
    const total = api.total(), posture = postureOf(total), gait = gaitOf(total, opts);
    G.state.vars.burden = total; G.state.vars.gait = gait;
    G.emit("burden", { total, gait, posture, delta, id });
    if (posture !== (last || "upright")) { fire(`burden.${posture}`, `burden:${posture}`); if (G.senses) G.senses.hold("player", posture, 0); }
    last = posture;
  }
  const api = {
    loads: B.loads, scales: B.scales,
    count: (id) => S().items[id] || 0,
    items: () => ({ ...S().items }),
    total: () => Object.entries(S().items).reduce((a, [id, n]) => a + (B.loads[id] ? B.loads[id].weight * n : 0), 0),
    gait: () => gaitOf(api.total(), opts),
    posture: () => postureOf(api.total()),
    // take a load on: its feel line (returned for the scene) and its cue, then the body's new posture
    shoulder(id, n = 1) {
      const l = load(id); S().items[id] = api.count(id) + n;
      fire(l.cue || "burden.shoulder", `load:${id}`);
      changed(l.weight * n, id);
      return l.text;
    },
    setdown(id, n = null) {
      if (id === "all") { const had = api.total(); S().items = {}; if (had) { fire("burden.setdown", "load:all"); changed(-had, "all"); } return; }
      const l = load(id), k = n == null ? api.count(id) : Math.min(n, api.count(id)); if (!k) return;
      S().items[id] -= k; if (!S().items[id]) delete S().items[id];
      fire("burden.setdown", `load:${id}`); changed(-l.weight * k, id);
    },
    // a balance: loads on its two pans; tip() compares them and moves the arm
    pan(scale, side, id, n = 1) {
      if (!B.scales[scale]) throw new Error(`burden: no @scale ${scale}`);
      if (side !== "left" && side !== "right") throw new Error(`burden: pan ${scale} ${side}: left or right`);
      load(id); const p = (S().pans[scale] ||= { left: {}, right: {} }); p[side][id] = (p[side][id] || 0) + n;
    },
    empty(scale) { delete S().pans[scale]; delete S().tip[scale]; },
    weightOn(scale, side) { const p = (S().pans[scale] || { left: {}, right: {} })[side]; return Object.entries(p).reduce((a, [id, n]) => a + load(id).weight * n, 0); },
    tip(scale) {
      const sc = B.scales[scale]; if (!sc) throw new Error(`burden: no @scale ${scale}`);
      const L = api.weightOn(scale, "left"), R = api.weightOn(scale, "right"), d = L - R, side = Math.abs(d) < 0.5 ? "level" : d > 0 ? "left" : "right";
      const strength = Math.min(1, Math.abs(d) / Math.max(1, Math.max(L, R)));
      S().tip[scale] = side; G.state.vars[`tip.${scale}`] = side;
      G.emit("scale.tip", { scale, side, strength });
      fire(sc.cue, `scale:${scale}`);
      return side;
    },
    tipped: (scale) => S().tip[scale] || "",
  };
  G.burden = api;
  return api;
}
