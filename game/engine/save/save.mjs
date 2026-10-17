// Saving and loading: versioned, several slots, autosave, and old saves upgraded on load.
//   const saves = createSaves(G, storage, { loadEnv });
//   saves.save("1", "Before the weigh-house");  saves.load("1");  saves.list();  saves.autosave();
// A save is plain JSON: { format, version, savedAt, label, slot, summary, state, env }.
// Slots: "auto" (autosave), "quick", and "1".."9". Ink mode keeps one slot, written on every
// autosave, and refuses manual saves and loads (the night is final).
// Upgrades: MIGRATIONS[n] turns a version-n save into version n+1. Version 1 is the shape of the
// prototype's state (notes, clock and the night's power, Mother and wetness at the top level).
// Version 3 (2026-10-16): the full night's environment (world/night.mjs: power per zone,
// overrides, lights, gusts) and Lamb's wetness moved into state.body.
// Version 4 (2026-10-17): the action-RPG build layer: gear upgrade levels (state.inv.upgrades),
// and the sheet's level, xp and points made explicit for every save.
export const SAVE_FORMAT = "low-water.save";
export const SAVE_VERSION = 4;
export const SLOTS = ["auto", "quick", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export const MIGRATIONS = {
  0: (s) => ({ ...s, version: 1, notes: s.notes || [], clock: s.clock ?? 23 * 60 }),
  1: (s) => ({
    format: SAVE_FORMAT, version: 2, savedAt: s.savedAt || null, label: s.label || "", slot: s.slot || "",
    summary: { clock: s.clock, area: s.place || "" },
    state: { version: 2, seed: s.seed || 1, place: s.place || "", area: s.area || "", pos: null, flags: [...(s.notes || [])], vars: {}, fired: s.fired || [], seen: { areas: [], districts: [] }, sheet: null },
    env: { clock: s.clock, power: s.power || "on", mother: s.mother || "dark", wet: s.wet || 0 },
  }),
  2: (s) => {
    const e = s.env || {}, power = typeof e.power === "string" ? { quay: e.power } : e.power || {};
    return { ...s, version: 3, state: { ...s.state, version: 3, body: { wet: e.wet || 0, ...(s.state.body || {}) } },
      env: { clock: e.clock ?? 23 * 60, power, mother: e.mother || "dark", terms: e.terms || {}, lights: {}, gusts: [] } };
  },
  3: (s) => {
    const st = { ...s.state, version: 4 }, inv = { items: {}, equipped: {}, ...(st.inv || {}) };
    inv.upgrades = inv.upgrades || {}; st.inv = inv;
    if (st.sheet) st.sheet = { level: 1, xp: 0, points: 0, ...st.sheet };
    return { ...s, version: 4, state: st };
  },
};

export function migrate(data) {
  let s = typeof data === "string" ? JSON.parse(data) : data, v = s.version ?? 0;
  if (v > SAVE_VERSION) throw new Error(`save is version ${v}, newer than this game (${SAVE_VERSION})`);
  const steps = [];
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v]; if (!m) throw new Error(`save: no upgrade from version ${v}`);
    s = m(s); v = s.version; steps.push(v);
  }
  return { save: s, upgraded: steps };
}

const clockText = (c) => `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(Math.floor(c % 60)).padStart(2, "0")}`;

export function makeSave(G, { slot = "", label = "" } = {}) {
  const a = G.world.area();
  return {
    format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: new Date().toISOString(), slot, label,
    summary: { clock: G.clock(), time: clockText(G.clock()), area: a ? a.name : G.state.place, level: G.state.sheet.level, name: G.state.sheet.name },
    state: JSON.parse(JSON.stringify({ ...G.state, version: SAVE_VERSION })), env: G.env.save(),
  };
}

// Put a save's state into a running game. The sheet of an upgraded prototype save is rebuilt.
export async function applySave(G, data, newSheet) {
  const { save, upgraded } = migrate(data);
  if (save.format !== SAVE_FORMAT) throw new Error("save: not a Low Water save");
  const st = save.state;
  if (!st.sheet) st.sheet = newSheet(G.rs);
  for (const k of Object.keys(G.state)) delete G.state[k];
  Object.assign(G.state, st);
  await G.env.load(save.env);
  if (G.loadedExt) G.loadedExt();
  if (G.gates) G.gates.settle();
  G.emit("loaded", { slot: save.slot, upgraded });
  return { save, upgraded };
}

// ink: true, false, or left out to follow the character's choice (G.state.ink).
export function createSaves(G, storage, { newSheet, ink: inkOpt = null, every = null } = {}) {
  const key = (slot) => `lowwater.save.${slot}`;
  let lastAuto = -Infinity;
  const api = {
    get ink() { return inkOpt ?? !!G.state.ink; },
    save(slot, label = "") {
      if (api.ink && slot !== "auto") return "Ink mode: the night saves itself";
      if (!SLOTS.includes(slot)) throw new Error(`save: no slot ${slot}`);
      const s = makeSave(G, { slot, label }); storage.set(key(slot), JSON.stringify(s)); G.emit("saved", { slot, label }); return null;
    },
    async load(slot) {
      if (api.ink && slot !== "auto") return "Ink mode: there is only the one night";
      const raw = storage.get(key(slot)); if (!raw) return "Empty slot";
      await applySave(G, raw, newSheet); return null;
    },
    remove: (slot) => storage.remove(key(slot)),
    peek(slot) { const raw = storage.get(key(slot)); if (!raw) return null; try { return migrate(raw).save; } catch (e) { return { error: e.message, slot }; } },
    list: () => SLOTS.map((slot) => ({ slot, save: api.peek(slot) })),
    autosave(reason = "") { lastAuto = G.clock(); return api.save("auto", reason); },
    // Autosave on the events that matter, and every N minutes of the clock.
    watch() {
      const N = every ?? G.rs.rules["autosave-minutes"];
      const offs = [G.on("area", () => api.autosave("area")), G.on("talk.end", () => api.autosave("conversation")), G.on("time", () => { if (api.ink || G.clock() - lastAuto >= N) api.autosave("time"); })];
      // Ink mode writes on every action that changes the night.
      for (const ev of ["flag", "check", "item.gain", "item.lose", "quest", "trait.done", "rep", "run.end"]) offs.push(G.on(ev, () => { if (api.ink) api.autosave(ev); }));
      return () => offs.forEach((f) => f());
    },
  };
  return api;
}

// Storage adapters: { get(key), set(key, value), remove(key) }.
export function memoryStorage() { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k), map: m }; }
export function browserStorage(ls = globalThis.localStorage) {
  return {
    get: (k) => { try { return ls.getItem(k); } catch (e) { console.warn(`save: could not read ${k}: ${e.message}`); return null; } },
    set: (k, v) => { try { ls.setItem(k, v); } catch (e) { console.error(`save: could not write ${k}: ${e.message}`); throw e; } },
    remove: (k) => { try { ls.removeItem(k); } catch (e) { console.warn(`save: could not remove ${k}: ${e.message}`); } },
  };
}
