// Stealth: who can see or hear Lamb, how sure they are, and what they do about it.
//   @watcher id   name, char (a @char; the watcher is active only while the char is here, when
//                 the char has a schedule), faction, role, when (active condition),
//                 area or place, path x z x z ... (a patrol loop) or post x z facing (degrees,
//                 0 = north), speed (m/s, default 1), cone range degrees (default 8 60),
//                 hearing (multiplier, default 1), say: state text (repeatable: suspicious,
//                 searching, seen, lost), alert: node, fight: encounter, ambush: encounter,
//                 rep: n (favour change with the watcher's faction when seen),
//                 smell: range (finds Lamb downwind by smell within range, in any light; Lamb's
//                 smell is 1 plus item and trait mods on the target "smell")
//   @cue id       on (turning, lantern, close, wind), skill, dc, when, text: an inner voice that
//                 speaks during a sneak (S6), "stealth.voice" { skill, name, text }
//   @hide id      area, at x z, r, cover (0..1, default 0.8)      a spot Lamb can hide in
//   @crowd id     area or place, when, density (0..1), guise (comma list; empty = anyone)
// Detection, every fixed step, per watcher (sight needs light, sound needs quiet):
//   sight: in the cone and range, or within 2 m behind; visibility = light at Lamb (envAt plus
//          carried and fixed lights) x fog transmittance x (1 - cover) x crouch 0.55 x crowd
//          (1 - 0.7 density) x (1 + stealth-sodium x sodium); a lit lantern Lamb carries is always
//          seen inside a cone; awareness rises by visibility x (1.2 - d / range) x 1.5 per second
//   sound: loudness / max(1, d) x hearing x masking 1 / (1 + wind / 8 + rain / 3) x downwind
//          (1 + 0.08 x wind x max(0, cos)) above @rules stealth-hear (0.25)
//          raises awareness and turns the watcher toward the sound. Sound alone never alerts.
//          Footsteps: walk 0.7, run 2, crouch 0.24, times the footing (shingle 1.5, water 1.6,
//          frost 1.3, wood 1.2, stone 1, weed 0.8, mud 0.7, sand 0.6; wet ground x1.1).
//   states: unaware (< 0.3), suspicious (stops and turns), searching (>= 0.7: walks to the last
//          known place), seen (>= 1, only while seeing Lamb). Each change emits
//          "stealth.state" { watcher, from, to, say } for the shell's telegraph.
// Outside a sneak scene the term `seen` answers SYSTEMS.md 5.1 for the current place: an active
// watcher there sees Lamb when light x fog transmittance over 10 m >= 0.22 (hysteresis 0.18 and
// 0.26), unless Lamb hides (G.stealth.hideAt) or blends (fog over 0.05 or light under 0.1 in any
// guise but the default, or a crowd that takes Lamb's guise).
import { compile, evaluate } from "../core/expr.mjs";

const FOOT = { shingle: 1.5, water: 1.6, frost: 1.3, wood: 1.2, stone: 1, weed: 0.8, mud: 0.7, sand: 0.6 };
export const STATES = ["unaware", "suspicious", "searching", "seen"];
const one = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const nums = (v) => (v == null ? null : v.split(/\s+/).map(Number));

export function loadStealth(book) {
  const R = book.records || {}, watchers = {}, hides = {}, crowds = {}, cues = [], errors = [];
  const each = (kind, fn) => { for (const r of Object.values(R[kind] || {})) { try { fn(r); } catch (e) { errors.push({ file: r.file, line: r.line, msg: `${kind} ${r.id}: ${e.message}` }); } } };
  each("watcher", (r) => {
    const path = nums(one(r, "path")), post = nums(one(r, "post")), cone = nums(one(r, "cone")) || [8, 60];
    if (!path && !post) throw new SyntaxError("needs path: x z ... or post: x z facing");
    if (path && (path.length < 4 || path.length % 2 || path.some(isNaN))) throw new SyntaxError("path: needs pairs x z, at least two points");
    const says = {}; for (const e of r.kv.filter((x) => x.key === "say")) { const [st, ...t] = e.value.trim().split(/\s+/); if (!STATES.includes(st) && st !== "lost") throw new SyntaxError(`say: unknown state ${st}`); says[st] = t.join(" "); }
    watchers[r.id] = { id: r.id, name: one(r, "name") || r.id, char: one(r, "char") || null, faction: one(r, "faction") || null, role: one(r, "role") || "", when: compile(one(r, "when")),
      area: one(r, "area") || null, place: one(r, "place") || null, path, post, speed: +(one(r, "speed") || 1), cone, hearing: +(one(r, "hearing") || 1), says,
      smell: +(one(r, "smell") || 0), alert: one(r, "alert") || null, fight: one(r, "fight") || null, ambush: one(r, "ambush") || null, rep: +(one(r, "rep") || 0), file: r.file, line: r.line };
  });
  each("hide", (r) => { const at = nums(one(r, "at")); if (!at || at.length < 2) throw new SyntaxError("needs at: x z"); hides[r.id] = { id: r.id, area: one(r, "area") || null, x: at[0], z: at[1], r: +(one(r, "r") || 0.8), cover: +(one(r, "cover") || 0.8), name: one(r, "name") || r.id }; });
  each("cue", (r) => { const on = one(r, "on"); if (!["turning", "lantern", "close", "wind"].includes(on)) throw new SyntaxError("on: one of turning, lantern, close, wind"); cues.push({ id: r.id, on, skill: one(r, "skill") || "", dc: one(r, "dc") != null ? +one(r, "dc") : null, when: compile(one(r, "when")), text: one(r, "text") || "" }); });
  each("crowd", (r) => { crowds[r.id] = { id: r.id, area: one(r, "area") || null, place: one(r, "place") || null, when: compile(one(r, "when")), density: +(one(r, "density") || 0.5), guises: (one(r, "guise") || "").split(",").map((s) => s.trim()).filter(Boolean) }; });
  return { watchers, hides, crowds, cues, errors };
}

// Is this watcher on duty now?
export function active(G, w) {
  if (w.when && !evaluate(w.when, G.scope)) return false;
  if (w.char && G.content.schedules[w.char] && G.content.schedules[w.char].length && !G.people.here(w.char)) return false;
  return true;
}
// The crowd density that hides Lamb here, 0 when none takes Lamb's guise.
export function crowdCover(G, where) {
  let d = 0;
  for (const c of Object.values(G.content.stealth.crowds)) {
    if ((c.area && c.area !== where.area) || (c.place && c.place !== where.place)) continue;
    if (c.when && !evaluate(c.when, G.scope)) continue;
    if (c.guises.length && !c.guises.includes(G.body.guise())) continue;
    d = Math.max(d, c.density);
  }
  return d;
}
// The one sight rule, shared by the sneak scenes and combat (combat/sim): how visible Lamb is to a
// watcher d metres away. light at Lamb (0..1+), fog density per metre, sodium share of the light
// (0..1), cover of the spot (0..1), crouching, crowd density hiding Lamb (0..1). sodiumGain is the
// ruleset's stealth-sodium (0.5). A lit lantern Lamb carries is handled by the caller (always seen
// in the cone).
export function visibility({ light = 0, fog = 0, sodium = 0, d = 0, cover = 0, crouch = false, crowd = 0, sodiumGain = 0.5 } = {}) {
  return Math.max(0, light) * Math.exp(-Math.max(0, fog) * Math.max(0, d)) * (1 - Math.min(1, Math.max(0, cover))) * (crouch ? 0.55 : 1) * (1 - 0.7 * Math.min(1, Math.max(0, crowd))) * (1 + sodiumGain * Math.min(1, Math.max(0, sodium)));
}
export const footstep = (footing, mode) => (mode === "run" ? 1 : mode === "crouch" ? 0.12 : 0.35) * (FOOT[String(footing).replace(/^wet /, "")] ?? 1) * (String(footing).startsWith("wet ") ? 1.1 : 1);
export const masking = (env) => 1 / (1 + (env.wind ? env.wind.speed : 0) / 8 + (env.rain || 0) / 3);
// How much the wind carries a sound from (sx, sz) to (tx, tz): 1 across or upwind, more downwind.
export const downwind = (env, sx, sz, tx, tz) => { const dx = tx - sx, dz = tz - sz, L = Math.hypot(dx, dz), w = env.wind || { speed: 0, x: 0, z: 0 }; if (!L || !w.speed) return 1; return 1 + 0.08 * w.speed * Math.max(0, (w.x * dx + w.z * dz) / (w.speed * L)); };
// An inner voice for a stealth moment: the first cue for `on` whose condition and level hold.
export function cue(G, on) {
  for (const c of G.content.stealth.cues) {
    if (c.on !== on || (c.when && !evaluate(c.when, G.scope))) continue;
    if (c.skill && c.dc != null && G.sheet.skill(c.skill) < c.dc) continue;
    const sk = G.rs.skills[c.skill]; G.emit("stealth.voice", { skill: c.skill, name: sk ? sk.name : c.skill, text: c.text, on }); return c;
  }
  return null;
}
export const stateOf = (a, seeing) => (a >= 1 && seeing ? "seen" : a >= 0.7 ? "searching" : a >= 0.3 ? "suspicious" : "unaware");

// The menu world's seen rule (SYSTEMS.md 5.1) for the current place.
export function createStealthWorld(G) {
  const S = () => (G.state.stealth ||= { latch: false, hideAt: null, distractUntil: -Infinity });
  const api = {
    // sight(ax, az, bx, bz) -> bool: set by the shell while a sneak plays on a plate (world/plateworld.mjs
    // sightClear through the scene's stage), so a wall hides Lamb and a bench does not; null sees everywhere
    sight: null,
    hideAt(id) { S().hideAt = id; G.emit("stealth.hide", { id }); },
    unhide() { S().hideAt = null; },
    hidden: () => !!S().hideAt,
    // A thrown thing turns heads: nobody here sees Lamb for a few minutes.
    distract(minutes = 3) { S().distractUntil = G.clock() + minutes; G.emit("stealth.distract", { minutes }); },
    // seenby.<watcher>: its state in a sneak scene; outside one, seen or unaware when it is here.
    stateOf(id) {
      const s = G.sneaks && G.sneaks.current; if (s) { const o = s.state.W.find((x) => x.w.id === id); if (o) return o.state; }
      const w = G.content.stealth.watchers[id]; if (!w || !api.watchersHere().includes(w)) return "";
      return api.seen() ? "seen" : "unaware";
    },
    watchersHere: () => Object.values(G.content.stealth.watchers).filter((w) => (w.place ? w.place === G.state.place : w.char ? G.people.here(w.char) : false) && active(G, w)),
    seen() {
      const st = S(), here = api.watchersHere();
      if (!here.length || st.hideAt || G.clock() < (st.distractUntil ?? -Infinity)) { st.latch = false; return false; }
      const env = G.envAt(), guise = G.body.guise(), def = G.rs.rules["guise-default"];
      if (guise !== def && (env.fog > 0.05 || env.light < 0.1)) { st.latch = false; return false; }
      const v = env.light * Math.exp(-env.fog * 10) * (1 - 0.7 * crowdCover(G, { place: G.state.place, area: G.state.area }));
      const k = G.rs.rules["stealth-seen"]; st.latch = st.latch ? v >= k - 0.04 : v >= k + 0.04;
      return st.latch;
    },
  };
  return api;
}
