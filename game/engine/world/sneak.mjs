// Sneak scenes: real-time stealth on a walkable place, entered from a node like a Tide Run.
//   @sneak id   name, area, watcher (repeatable @watcher ids), hide (repeatable @hide ids),
//               goal (x z r, or a name), limit (game minutes), rate (real seconds per game
//               minute, default 4), win (node), alert (node when seen), lose (node at the time
//               limit; default alert), param (repeatable): rect x0 z0 x1 z1 y, start x z,
//               light x z r, carry item r, footing kind, throw item (what a thrown distraction
//               uses up; without it Lamb throws a pebble)
// Content: do: sneak(s.id). The runner ends the beat with beat.sneak; the shell plays it and
// calls talk.afterSneak(). Input (G.input): move {x, z}, held run and crouch, presses throw
// (a noise 4 m ahead) and ambush (behind an unaware or suspicious watcher within 1.4 m whose
// record names an ambush encounter: the fight starts with G.state.ambush = { encounter,
// watcher, advantage: "sneak" } for the combat layer to read).
// Outcomes: win (at the goal), seen (a watcher saw Lamb: its fight starts if it names one,
// else its alert node, else the scene's), ambush, time. On seen: seen.<watcher> is set,
// book.<sneak> when the watcher's role is lamplighter, rep(<faction>, rep) when it names one.
import { active, crowdCover, visibility, footstep, masking, stateOf, downwind, cue } from "./stealth.mjs";
import { registerCalls } from "../core/scope.mjs";

registerCalls({ sneak: (G, [id]) => G.sneaks.request(id) }, { sneak: "sneak" });

const one = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const T = (deg) => (deg * Math.PI) / 180;

export function loadSneaks(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).sneak || {})) {
    try {
      const P = { rect: [], light: [], carry: [] };
      for (const e of r.kv.filter((x) => x.key === "param")) {
        const [k, ...w] = e.value.trim().split(/\s+/);
        if (k === "rect" || k === "light") P[k].push(w.map(Number)); else if (k === "carry") P.carry.push({ item: w[0], r: +w[1] }); else if (k === "start") P.start = w.map(Number); else P[k] = w.join(" ");
      }
      const g = (one(r, "goal") || "").split(/\s+/), num = g.length >= 3 && g.every((x) => !isNaN(+x));
      const d = { id: r.id, name: one(r, "name") || r.id, area: one(r, "area") || null, watchers: r.kv.filter((x) => x.key === "watcher").map((x) => x.value.trim()), hides: r.kv.filter((x) => x.key === "hide").map((x) => x.value.trim()),
        goal: num ? { x: +g[0], z: +g[1], r: +g[2], name: "" } : null, limit: +(one(r, "limit") || Infinity), rate: +(one(r, "rate") || 4), win: one(r, "win"), alert: one(r, "alert"), lose: one(r, "lose") || one(r, "alert"), P, file: r.file, line: r.line };
      if (!d.win || !d.alert) throw new SyntaxError("needs win: and alert:");
      if (!d.goal) throw new SyntaxError("goal: expected x z r");
      if (!P.rect.length) throw new SyntaxError("needs at least one param: rect x0 z0 x1 z1 y");
      out[r.id] = d;
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `sneak ${r.id}: ${e.message}` }); }
  }
  return { sneaks: out, errors };
}

export function startSneak(G, def, { mode = "full" } = {}) {
  const C = G.content.stealth, P = def.P, start = P.start || [0, 0];
  const ground = (x, z) => P.rect.some((r) => x >= Math.min(r[0], r[2]) && x <= Math.max(r[0], r[2]) && z >= Math.min(r[1], r[3]) && z <= Math.max(r[1], r[3]));
  const hides = def.hides.map((id) => C.hides[id]).filter(Boolean);
  const W = def.watchers.map((id) => C.watchers[id]).filter(Boolean).map((w) => ({ w, x: w.post ? w.post[0] : w.path[0], z: w.post ? w.post[1] : w.path[1], face: T(w.post ? w.post[2] || 0 : 0), seg: 0, a: 0, state: "unaware", lastKnown: null, quiet: 0, seeing: false }));
  const R = { def, mode, x: start[0], z: start[1], t: 0, clockT: 0, minutes: 0, done: false, outcome: null, reason: "", watcher: null, noises: [], crouch: false, moving: false, running: false, W };
  // carrying a load leaves no hand for a lantern
  const carried = () => (G.state.carrying ? [] : P.carry.filter((c) => G.inv.count(c.item) > 0).map((c) => [R.x, R.z, c.r]));
  const lights = () => [...P.light, ...carried()];
  const RU = G.rs.rules, cueAt = {};
  const speak = (on) => { if ((cueAt[on] ?? -99) + 6 > R.t) return; cueAt[on] = R.t; cue(G, on); };
  const env = () => G.envAt({ footing: P.footing || null });
  const coverAt = () => Math.max(0, ...hides.filter((h) => (R.x - h.x) ** 2 + (R.z - h.z) ** 2 <= h.r ** 2).map((h) => (R.moving && !R.crouch ? h.cover * 0.4 : h.cover)));
  const lightAt = (e) => Math.min(1, Math.max(e.light, ...lights().map((l) => (Math.hypot(R.x - l[0], R.z - l[1]) <= l[2] ? 0.6 : 0))));
  const end = (outcome, reason, w = null) => { if (R.done) return; R.done = true; Object.assign(R, { outcome, reason, watcher: w && w.w.id }); G.emit("sneak.end", { id: def.id, outcome, reason, watcher: R.watcher }); };
  const say = (o, to) => { const from = o.state; o.state = to; G.emit("stealth.state", { watcher: o.w.id, name: o.w.name, from, to, say: o.w.says[to] || (to === "unaware" && from !== "unaware" ? o.w.says.lost || "" : "") }); };
  const turnTo = (o, x, z, dt) => { const want = Math.atan2(x - o.x, z - o.z); let d = want - o.face; d = Math.atan2(Math.sin(d), Math.cos(d)); o.face += Math.sign(d) * Math.min(Math.abs(d), T(140) * dt); };
  const walk = (o, x, z, v, dt) => { const dx = x - o.x, dz = z - o.z, L = Math.hypot(dx, dz); if (L < 0.05) return true; const s = Math.min(L, v * dt); o.x += (dx / L) * s; o.z += (dz / L) * s; o.face = Math.atan2(dx, dz); return s >= L; };

  function hear(o, x, z, loud, e) {
    const d = Math.max(1, Math.hypot(x - o.x, z - o.z)), level = (loud / d) * o.w.hearing * masking(e) * downwind(e, x, z, o.x, o.z);
    if (level < RU["stealth-hear"]) return 0;
    o.lastKnown = [x, z]; return level;
  }
  function watcherStep(o, dt, e, foot) {
    if (!active(G, o.w)) return;
    const dx = R.x - o.x, dz = R.z - o.z, d = Math.hypot(dx, dz), [range, deg] = o.w.cone;
    const inCone = d <= range && (d < 0.01 || (dx * Math.sin(o.face) + dz * Math.cos(o.face)) / d >= Math.cos(T(deg)));
    let vis = visibility({ light: lightAt(e), fog: e.fog, sodium: e.sodium || 0, d, cover: coverAt(), crouch: R.crouch, crowd: crowdCover(G, { area: def.area, place: G.state.place }), sodiumGain: RU["stealth-sodium"] });
    if (inCone && carried().length) vis = Math.max(vis, 1); // a lit lantern is a shop window
    else if (!inCone && carried().length && d <= range * 1.3) speak("lantern");
    let gain = 0; o.seeing = false;
    if ((inCone || d <= 2) && vis > 0.05) { gain += vis * (inCone ? 1.2 - d / range : 0.8) * 1.5; o.seeing = gain > 0.05; if (o.seeing) o.lastKnown = [R.x, R.z]; }
    if (foot) gain += hear(o, R.x, R.z, foot, e) * 0.4;
    for (const n of R.noises) gain += hear(o, n.x, n.z, n.loud, e) > 0 ? 0.35 / dt : 0;
    if (o.w.smell && d <= o.w.smell) { // a nose finds Lamb downwind, light or no light
      const carry = downwind(e, R.x, R.z, o.x, o.z) - 1, factor = Math.max(0, 1 + G.sheet.mods("smell").reduce((a, m) => a + m.amount, 0));
      if (carry > 0.1 && factor > 0) { gain += (1 - d / o.w.smell) * carry * factor * 1.5; o.lastKnown = [R.x, R.z]; if (o.a >= 0.95) o.seeing = true; }
    }
    if (d <= 2.5 && o.state === "unaware") speak("close");
    if (gain > 0) { o.a += gain * dt; o.quiet = 0; } else { o.quiet += dt; if (o.state !== "seen") o.a = Math.max(0, o.a - (o.quiet > 4 || o.state !== "searching" ? RU["stealth-decay"] : RU["stealth-decay"] / 4) * dt); }
    if (!o.seeing) o.a = Math.min(o.a, 0.95);
    const st = stateOf(o.a, o.seeing);
    if (st !== o.state) { if (st === "suspicious" && o.state === "unaware") speak("turning"); say(o, st); }
    if (st === "seen") return end("seen", "seen", o);
    if (st === "suspicious" && o.lastKnown) turnTo(o, o.lastKnown[0], o.lastKnown[1], dt);
    else if (st === "searching" && o.lastKnown) { if (walk(o, o.lastKnown[0], o.lastKnown[1], o.w.speed * 1.2, dt)) o.face += T(60) * dt; }
    else if (st === "unaware") patrol(o, dt);
  }
  function patrol(o, dt) {
    if (o.w.post) { const p = o.w.post; if (!walk(o, p[0], p[1], o.w.speed, dt)) return; o.face = T(p[2] || 0); return; }
    const pts = o.w.path, n = pts.length / 2, nx = (o.seg + 1) % n;
    if (walk(o, pts[nx * 2], pts[nx * 2 + 1], o.w.speed, dt)) o.seg = nx;
  }
  function world(dt, foot) {
    R.t += dt; R.clockT += dt;
    while (R.clockT >= def.rate && !R.done) { R.clockT -= def.rate; R.minutes++; G.advance(1); if (R.minutes > def.limit) end("time", "time"); }
    const e = env();
    for (const o of W) { if (R.done) break; watcherStep(o, dt, e, foot); }
    R.noises = [];
    if (!R.done && Math.hypot(R.x - def.goal.x, R.z - def.goal.z) <= def.goal.r) end("win", "goal");
  }
  function move(mx, mz, dist) { const nx = R.x + mx * dist, nz = R.z + mz * dist; if (ground(nx, nz)) { R.x = nx; R.z = nz; } }
  const speed = () => RU["sneak-walk"] * (R.running ? 1.6 : R.crouch ? 0.5 : 1) * (G.state.carrying ? RU["carry-speed"] : 1);
  const footNow = (e) => (R.moving ? footstep(e.footing, R.running ? "run" : R.crouch ? "crouch" : "walk") * 2 * (G.state.carrying ? RU["carry-noise"] : 1) : 0);

  const api = {
    state: R,
    step(dt, input = {}) {
      if (R.done) return R;
      const w = mode === "half" ? dt * 0.5 : dt, L = Math.hypot(input.x || 0, input.z || 0);
      R.crouch = !!input.crouch; R.running = !!input.run && !R.crouch; R.moving = L > 0.2;
      if (R.moving) move((input.x || 0) / L, (input.z || 0) / L, speed() * w * Math.min(1, L));
      if (input.throw) api.throwNoise();
      if (input.ambush && api.ambush()) return R;
      world(w, footNow(env(), 1));
      return R;
    },
    stepMove(dx, dz, { crouch = false } = {}) {
      if (R.done) return R;
      const L = Math.hypot(dx, dz) || 1; R.crouch = crouch; R.running = false; R.moving = true;
      move(dx / L, dz / L, 0.5); world(0.5 / speed(), footNow(env(), 1));
      return R;
    },
    // A thrown distraction lands 4 m ahead of Lamb's last move (or north).
    throwNoise(at = null) {
      const item = P.throw; if (item && !G.inv.take(item, 1)) return false;
      const [x, z] = at || [R.x, R.z + 4]; R.noises.push({ x, z, loud: 2.5 }); G.emit("sneak.noise", { x, z }); return true;
    },
    noise(x, z, loud) { R.noises.push({ x, z, loud }); },
    ambush() {
      for (const o of W) {
        if (!o.w.ambush || o.state === "searching" || o.state === "seen") continue;
        const dx = R.x - o.x, dz = R.z - o.z, d = Math.hypot(dx, dz);
        const behind = d <= 1.4 && (d < 0.01 || (dx * Math.sin(o.face) + dz * Math.cos(o.face)) / d < 0);
        if (behind) { G.state.ambush = { encounter: o.w.ambush, watcher: o.w.id, advantage: "sneak" }; end("ambush", "ambush", o); return true; }
      }
      return false;
    },
    view: () => ({ x: R.x, z: R.z, crouch: R.crouch, rects: P.rect, lights: lights(), hides, goal: def.goal, minutes: R.minutes, limit: def.limit, done: R.done, outcome: R.outcome, reason: R.reason, cover: coverAt(),
      watchers: W.map((o) => ({ id: o.w.id, name: o.w.name, x: o.x, z: o.z, face: o.face, cone: o.w.cone, state: o.state, a: Math.min(1, o.a), lastKnown: o.lastKnown })) }),
  };
  return api;
}

export function createSneaks(G, defs) {
  const api = {
    defs, current: null,
    request(id) { if (!defs[id]) throw new Error(`no sneak ${id}`); G.state.pendingSneak = id; G.emit("sneak.request", { id }); },
    take() { const id = G.state.pendingSneak; delete G.state.pendingSneak; return id || null; },
    start(id, opts = {}) {
      const def = defs[id]; if (!def) throw new Error(`no sneak ${id}`);
      if (def.area && G.content.map.areas[def.area] && G.state.area !== def.area) G.world.enter(def.area);
      delete G.state.ambush;
      api.current = startSneak(G, def, { mode: opts.mode || G.state.runMode || "full" });
      G.emit("sneak.start", { id, name: def.name });
      return api.current;
    },
    // Record the outcome and say what follows: { node } or { fight } (an encounter to start).
    finish() {
      const s = api.current; if (!s || !s.state.done) return null;
      api.current = null;
      const R = s.state, def = R.def, w = R.watcher && G.content.stealth.watchers[R.watcher];
      (G.state.sneaks ||= {})[def.id] = R.outcome;
      if (R.outcome === "win") return { node: def.win };
      if (R.outcome === "ambush") return { fight: w.ambush };
      if (R.outcome === "time") return { node: def.lose };
      G.setFlag(`seen.${w.id}`, true);
      if (w.role === "lamplighter") G.setFlag(`book.${def.id}`, true);
      if (w.rep && (w.faction || (G.rs.chars[w.char] || {}).faction)) G.factions.add(w.faction || G.rs.chars[w.char].faction, w.rep);
      return w.fight ? { fight: w.fight } : { node: w.alert || def.alert };
    },
    outcome: (id) => (G.state.sneaks || {})[id] || "",
  };
  return api;
}
