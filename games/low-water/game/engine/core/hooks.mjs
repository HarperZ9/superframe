// Hooks for real-time systems that live outside this layer (game/engine/combat/, the character
// pipeline in characters/): a fixed-timestep loop with ordered systems, one input action state
// shared by keyboard, mouse and gamepad, and a registry so a system can attach itself to G,
// keep its state in the save and be told when a save loads.
//
//   G.loop.add("combat", (dt, G) => {...}, { order: 20 })   called every fixed step
//   G.loop.frame(realSeconds)   the shell calls this each animation frame (or wraps raw-native's
//                               createFixedLoop and calls G.loop.step(dt) itself)
//   G.loop.clockRate            real seconds per game minute while real-time play runs (0 = the
//                               night stands still, as in conversation and walking)
//   G.input.set("move", { x, z }), G.input.press("attack"), G.input.get("move"),
//   G.input.pressed("attack")   true once per press, cleared at the end of the step
//   G.register("combat", api, { state: () => ({...}) })   G.ext.combat; its state lives in
//                               G.state.ext.combat (saved and versioned with the game)
// Order of the built-in systems: hazards 10, combat (yours) 20, animation 30, clock 90.
export function createLoop(G, { hz = 60 } = {}) {
  const dt = 1 / hz, systems = [];
  let acc = 0, clockAcc = 0;
  const loop = {
    dt, clockRate: 0, paused: false,
    add(name, fn, { order = 50 } = {}) {
      if (systems.some((s) => s.name === name)) throw new Error(`loop: system ${name} is already added`);
      systems.push({ name, fn, order }); systems.sort((a, b) => a.order - b.order);
      return () => { const i = systems.findIndex((s) => s.name === name); if (i >= 0) systems.splice(i, 1); };
    },
    systems: () => systems.map((s) => s.name),
    step(d = dt) {
      for (const s of systems) {
        try { s.fn(d, G); } catch (e) { console.error(`loop: system ${s.name} failed:`, e); throw e; }
      }
      if (loop.clockRate > 0) { clockAcc += d; while (clockAcc >= loop.clockRate - 1e-9) { clockAcc -= loop.clockRate; G.advance(1); } }
      G.input.endStep();
    },
    // Real seconds since the last frame; runs as many fixed steps as fit (at most 8 per frame,
    // so a stalled tab does not spiral).
    frame(seconds) {
      if (loop.paused) return 0;
      acc = Math.min(acc + seconds, dt * 8); let n = 0;
      while (acc >= dt) { acc -= dt; loop.step(dt); n++; }
      return n;
    },
  };
  return loop;
}

export function createInput() {
  const held = new Map(), presses = new Set();
  return {
    set: (name, value) => held.set(name, value),
    get: (name) => held.get(name),
    press(name) { presses.add(name); },
    pressed: (name) => presses.has(name),
    endStep() { presses.clear(); },
    clear() { held.clear(); presses.clear(); },
  };
}

export function installHooks(G) {
  G.loop = createLoop(G);
  G.input = createInput();
  G.ext = {};
  const owners = {};
  G.register = (name, api, { state = null, version = 1, migrate = null, onLoad = null } = {}) => {
    if (G.ext[name]) throw new Error(`register: ${name} is already registered`);
    G.ext[name] = api; owners[name] = { version, migrate, onLoad };
    const ext = (G.state.ext ||= {});
    if (!ext[name] && state) ext[name] = { version, ...state() };
    return api;
  };
  // Called by save/applySave after a load: each extension upgrades and re-reads its state.
  G.loadedExt = () => {
    if (!Object.keys(owners).length) return;
    const ext = (G.state.ext ||= {});
    for (const [name, o] of Object.entries(owners)) {
      if (ext[name] && o.migrate && (ext[name].version || 0) < o.version) ext[name] = { ...o.migrate(ext[name]), version: o.version };
      if (o.onLoad) o.onLoad(ext[name]);
    }
  };
  G.loop.add("hazards", (dt) => { if (!G.activeTalk && !(G.runs && G.runs.current)) G.hazards.step(dt); }, { order: 10 });
}
