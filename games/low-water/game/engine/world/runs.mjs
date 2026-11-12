// Tide Runs (R10): short real-time movement under one hazard, with no combat and no chance.
//   @run id     name, area, hazard (repeatable @hazard ids, active only during the run),
//               goal (x y z r), rate (real seconds per game minute, default 4), limit (game
//               minutes), win (node), lose (node), param (repeatable, below)
// Positions are the area's world coordinates (x, z on the ground; y is height). Params:
//   start x z               where Lamb begins (default: the area's spawn)
//   rect x0 z0 x1 z1 y      walkable ground at height y (repeatable; a later rect wins where
//                           they overlap). Off every rect is the edge.
//   water a b               the water's height is a + b * tide (the night's tide in metres)
//   knee d / waist d        depths: above the knee costs Cold, at the waist the run is lost
//   frost x z r n           a frost patch Lamb slides on when skill.ballast is below n
//   slide dx dz             the direction and distance of a slide (default 0 0.8)
//   dark                    only lit ground is visible, and walking off the edge is a fall
//   light x z r             a fixed light; carry item r: a light of radius r while Lamb has item
//   pursuer char speed      a follower walking path x z x z ... (looping), seeing in a cone
//   path x z x z ...        cone range degrees      seen seconds (default 3) before the run is lost
//   climb x z r flights     stairs or a ladder: slower with low grip and knees; each flight
//                           costs flight-cost (default "cold 1 wear 1")
//   speed m/s               walking speed at knees 3 (default 1.4); each point of knees +10%
//   run-cost meter n s      holding run costs n of the meter every s seconds (default cold 1 5)
//   wade-cost meter n s     wading above the knee costs n every s seconds (default cold 1 10)
//   step d                  stepped mode: the distance of one move (default 0.5)
//   skills knees ballast grip   the skill ids read (defaults as written)
//   sight seconds           the same as seen;  depth-loses knee|waist (default waist)
// Without rect params the run has no drawn ground, and the engine builds a course from its
// hazards and params (buildCourse below): a 4 m wide way from the start to a goal named by
// goal: <name>, rising 1.2 m; water when a hazard reads the tide (its front climbs the course
// in step with the real tide over the run's limit), frost patches when a hazard reads frost or
// frost-ballast n is given, the dark when a hazard reads light <, a patrolling pursuer with a
// lantern for pursuer <char>, and a stair zone at the end for climb <stairs>.
// Modes: full, half (the world runs at half speed), stepped (the world waits for each move).
// Outcomes: win at the goal; lose when swept (water at the waist), fell (an edge in the dark),
// seen (a pursuer's cone for `seen` seconds), or time (past the limit).
const num = (v, d) => (v == null || isNaN(+v) ? d : +v);

export function loadRuns(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).run || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      const P = { rect: [], frost: [], light: [], carry: [], climb: [], path: [] };
      for (const e of r.kv.filter((x) => x.key === "param")) {
        const [k, ...w] = e.value.trim().split(/\s+/);
        if (k === "climb" && w.length === 1) P.stairs = +w[0];
        else if (["rect", "frost", "light", "climb"].includes(k)) P[k].push(w.map(Number));
        else if (k === "carry") P.carry.push({ item: w[0], r: +w[1] });
        else if (k === "path") P.path = w.map(Number);
        else if (k === "pursuer") P.pursuer = { char: w[0], speed: num(w[1], 1.2) };
        else if (k === "sight") P.seen = +w[0];
        else if (k === "depth-loses") P.loseAt = w[0];
        else if (k === "frost-ballast") P.frostN = +w[0];
        else if (k === "climb" && w.length === 1) P.stairs = +w[0];
        else if (k === "dark") P.dark = true;
        else if (k === "skills") P.skills = w;
        else if (["run-cost", "wade-cost", "flight-cost"].includes(k)) P[k] = w;
        else P[k] = w.length === 1 ? num(w[0], w[0]) : w.map(Number);
      }
      const gs = (one("goal") || "").trim(), goal = gs.split(/\s+/).map(Number);
      if (!gs) throw new SyntaxError("needs goal: (x y z r, or a name when the engine builds the course)");
      const numeric = goal.length >= 4 && !goal.some(isNaN);
      if (!numeric && P.rect.length) throw new SyntaxError("goal: expected x y z r with rect params");
      out[r.id] = { id: r.id, name: one("name") || r.id, area: one("area") || null, hazards: r.kv.filter((x) => x.key === "hazard").map((x) => x.value.trim()),
        goal: numeric ? { x: goal[0], y: goal[1], z: goal[2], r: goal[3], name: "" } : { x: 0, y: 0, z: 0, r: 1, name: gs }, rate: num(one("rate"), 4), limit: num(one("limit"), Infinity), win: one("win"), lose: one("lose"), P, file: r.file, line: r.line };
      if (!out[r.id].win || !out[r.id].lose) throw new SyntaxError("needs win: and lose:");
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `run ${r.id}: ${e.message}` }); }
  }
  return { runs: out, errors };
}

const inCircle = (x, z, c) => (x - c[0]) ** 2 + (z - c[1]) ** 2 <= c[2] ** 2;

// A course for a run that has no drawn ground (see the header). Deterministic: the same run,
// hazards and night always give the same course.
export function buildCourse(G, def) {
  const P = { ...def.P, rect: [], frost: [...def.P.frost], light: [...def.P.light], climb: def.P.climb.filter((c) => c.length >= 4) };
  const src = def.hazards.map((id) => G.content.hazards[id]).filter(Boolean).map((h) => [h.where, h.when].filter(Boolean).map((c) => c.src).join(" ")).join(" ");
  const secs = def.rate * (isFinite(def.limit) ? def.limit : 15), L = Math.max(16, Math.round(num(P.speed, 1.4) * secs * 0.6)), rise = 1.2;
  for (let x = 0; x < L; x++) P.rect.push([x, -2, x + 1, 2, (rise * (x + 0.5)) / L]);
  P.start = [0.5, 0];
  const goal = { ...def.goal, x: L - 1, y: rise, z: 0, r: 1 };
  if (/\btide\b/.test(src) && !P.water && G.env.tideAt) {
    const t0 = G.clock(), T0 = G.env.tideAt(t0), T1 = G.env.tideAt(t0 + (isFinite(def.limit) ? def.limit : 15)), waist = num(P.waist, 0.9);
    if (T1 - T0 > 1e-4) { const b = (rise + waist + 0.3) / (T1 - T0); P.water = [-0.3 - b * T0, b]; }
  }
  if (P.frostN || /\bfrost\b/.test(src)) for (let x = 5, k = 0; x < L - 4; x += 5, k++) { const z = k % 2 ? -1.1 : 1.1; P.frost.push([x, z, 0.9, P.frostN || 6, 0, z > 0 ? 0.9 : -0.9]); }
  if (/\blight\s*</.test(src)) { P.dark = true; for (let x = 6; x < L - 2; x += 12) P.light.push([x, 0, 1.6]); }
  if (P.pursuer && !(P.path && P.path.length >= 4)) { P.path = [L * 0.4, -1.8, L * 0.4, 1.8, L * 0.6, 1.8, L * 0.6, -1.8]; P.cone = Array.isArray(P.cone) ? P.cone : [5, 30]; P.pursuer = { ...P.pursuer, speed: Math.min(P.pursuer.speed, 1.0), light: 2.5 }; }
  if (P.stairs) { P.climb.push([L - 3, 0, 3, Math.ceil(P.stairs / 16)]); P["flight-cost"] = P["flight-cost"] || ["cold", "0.5", "wear", "0.5"]; }
  return { P, goal, length: L };
}
const cost = (w, d) => { const a = w || d; return { meter: a[0], n: +a[1], every: +a[2] }; };

// One run in progress. world.ground(x, z) can be replaced by the shell with the plate's own walk
// surface; by default it reads the rect params.
export function startRun(G, def0, { mode = "full", world = null } = {}) {
  const built = !def0.P.rect.length && !(world && world.ground) ? buildCourse(G, def0) : null;
  const def = built ? { ...def0, P: built.P, goal: built.goal } : def0;
  const P = def.P, area = built ? null : G.content.map.areas[def.area] || null;
  const sk = (P.skills || ["knees", "ballast", "grip"]).map((id) => (G.rs.skills[id] ? G.sheet.skill(id) : 3));
  const [knees, ballast, grip] = sk;
  const ground = world && world.ground ? world.ground : (x, z) => { let y = null; for (const r of P.rect) if (x >= Math.min(r[0], r[2]) && x <= Math.max(r[0], r[2]) && z >= Math.min(r[1], r[3]) && z <= Math.max(r[1], r[3])) y = r[4] ?? 0; return y; };
  const start = P.start || (area ? [area.spawn[0], area.spawn[2]] : [0, 0]);
  const R = {
    def, mode, x: start[0], z: start[1], t: 0, minutes: 0, clockT: 0, seenT: 0, done: false, outcome: null, reason: "",
    speed: num(P.speed, 1.4) * (1 + 0.1 * (knees - 3)), knees, ballast, grip, inFrost: new Set(), inClimb: new Set(), runT: 0, wadeT: 0,
    pursuer: P.pursuer && P.path.length >= 4 ? { x: P.path[0], z: P.path[1], seg: 0, fx: 1, fz: 0 } : null,
  };
  const waterY = () => (Array.isArray(P.water) ? P.water[0] + P.water[1] * (+G.env.term("tide") || 0) : -Infinity);
  const depth = (x = R.x, z = R.z) => { const y = ground(x, z); return y == null ? 0 : Math.max(0, waterY() - y); };
  const knee = num(P.knee, 0.4), waist = P.loseAt === "knee" ? num(P.knee, 0.4) : num(P.waist, 0.9);
  const lights = () => [...P.light, ...P.carry.filter((c) => G.inv.count(c.item) > 0).map((c) => [R.x, R.z, c.r]), ...(R.pursuer && P.pursuer.light ? [[R.pursuer.x, R.pursuer.z, P.pursuer.light]] : [])];
  const lit = (x, z) => lights().some((l) => inCircle(x, z, l)) || (!P.dark && (+G.env.term("light", G.state.place) || 0) >= 0.22);
  const pay = (c, k = 1) => { if (G.content.meters[c.meter]) G.pressure.addMeter(c.meter, c.n * k); };
  const end = (outcome, reason) => { if (R.done) return; R.done = true; R.outcome = outcome; R.reason = reason; G.emit("run.end", { id: def.id, outcome, reason }); };

  function move(dx, dz) {
    const nx = R.x + dx, nz = R.z + dz;
    if (ground(nx, nz) == null) { if (P.dark && !lit(nx, nz)) { R.x = nx; R.z = nz; end("lose", "fell"); } return; }
    R.x = nx; R.z = nz;
    // frost: entering a patch with ballast below its number slides Lamb
    P.frost.forEach((f, i) => {
      const inside = inCircle(R.x, R.z, f);
      if (inside && !R.inFrost.has(i) && ballast < f[3]) {
        R.inFrost.add(i); const s = f.length >= 6 ? [f[4], f[5]] : Array.isArray(P.slide) ? P.slide : [0, 0.8];
        G.emit("run.slip", { id: def.id, at: [R.x, R.z] });
        const sx = R.x + s[0], sz = R.z + s[1];
        if (ground(sx, sz) == null) { R.x = sx; R.z = sz; end("lose", "fell"); return; }
        R.x = sx; R.z = sz;
      } else if (!inside) R.inFrost.delete(i);
    });
    P.climb.forEach((c, i) => {
      const inside = inCircle(R.x, R.z, c);
      if (inside && !R.inClimb.has(i)) { R.inClimb.add(i); const fc = P["flight-cost"] || ["cold", "1", "wear", "1"]; for (let k = 0; k + 1 < fc.length; k += 2) if (G.content.meters[fc[k]]) G.pressure.addMeter(fc[k], +fc[k + 1] * (c[3] || 1)); }
      else if (!inside) R.inClimb.delete(i);
    });
  }

  function world(dt) {
    R.t += dt; R.clockT += dt;
    while (R.clockT >= def.rate && !R.done) { R.clockT -= def.rate; R.minutes++; G.advance(1); if (R.minutes > def.limit) end("lose", "time"); }
    if (G.hazards) G.hazards.stepOnly(def.hazards, dt);
    const d = depth();
    if (d >= waist) end("lose", "swept");
    else if (d >= knee) { R.wadeT += dt; const c = cost(P["wade-cost"], ["cold", 1, 10]); while (R.wadeT >= c.every) { R.wadeT -= c.every; pay(c); } }
    if (R.pursuer) {
      const p = R.pursuer, path = P.path, n = path.length / 2, sp = P.pursuer.speed * dt;
      const tx = path[((p.seg + 1) % n) * 2], tz = path[((p.seg + 1) % n) * 2 + 1], dx = tx - p.x, dz = tz - p.z, L = Math.hypot(dx, dz);
      if (L <= sp) { p.x = tx; p.z = tz; p.seg = (p.seg + 1) % n; } else { p.fx = dx / L; p.fz = dz / L; p.x += p.fx * sp; p.z += p.fz * sp; }
      const cone = Array.isArray(P.cone) ? P.cone : [6, 35], vx = R.x - p.x, vz = R.z - p.z, D = Math.hypot(vx, vz);
      const inCone = D <= cone[0] && (D < 0.01 || (vx * p.fx + vz * p.fz) / D >= Math.cos((cone[1] * Math.PI) / 180));
      const fogT = Math.exp(-(+G.env.term("fog") || 0) * D);
      if (inCone && lit(R.x, R.z) && fogT > 0.3) R.seenT += dt; else R.seenT = Math.max(0, R.seenT - dt);
      if (R.seenT >= num(P.seen, 3)) end("lose", "seen");
    }
    if (!R.done && Math.hypot(R.x - def.goal.x, R.z - def.goal.z) <= def.goal.r) end("win", "goal");
  }

  const speedNow = (running) => {
    const d = depth(), climbing = P.climb.some((c) => inCircle(R.x, R.z, c));
    let v = R.speed * (running ? 1.6 : 1) * Math.max(0.25, 1 - (0.7 * d) / waist);
    if (climbing) v *= Math.max(0.2, 0.4 + 0.05 * (grip + knees - 6));
    return v;
  };

  const api = {
    state: R,
    // Real-time: dt real seconds with the stick or keys held (x, z: a direction, length <= 1).
    step(dt, input = {}) {
      if (R.done) return R;
      const scale = mode === "half" ? 0.5 : 1, wdt = dt * scale, L = Math.hypot(input.x || 0, input.z || 0);
      if (L > 0) {
        const v = speedNow(!!input.run) * wdt, k = Math.min(1, L);
        move(((input.x || 0) / L) * v * k, ((input.z || 0) / L) * v * k);
        if (input.run) { R.runT += wdt; const c = cost(P["run-cost"], ["cold", 1, 5]); while (R.runT >= c.every) { R.runT -= c.every; pay(c); } }
      }
      if (!R.done) world(wdt);
      return R;
    },
    // Stepped mode: one move of `step` metres; the world waits between moves.
    stepMove(dirX, dirZ) {
      if (R.done) return R;
      const L = Math.hypot(dirX, dirZ) || 1, d = num(P.step, 0.5), v = speedNow(false);
      move((dirX / L) * d, (dirZ / L) * d);
      if (!R.done) world(d / v);
      return R;
    },
    view: () => ({ x: R.x, z: R.z, ground: ground(R.x, R.z), depth: depth(), waterY: waterY(), knee, waist, rects: P.rect, frost: P.frost, lights: lights(), climb: P.climb,
      pursuer: R.pursuer && { x: R.pursuer.x, z: R.pursuer.z, fx: R.pursuer.fx, fz: R.pursuer.fz, cone: Array.isArray(P.cone) ? P.cone : [6, 35] }, seen: R.seenT / num(P.seen, 3),
      goal: def.goal, minutes: R.minutes, limit: def.limit, dark: !!P.dark, done: R.done, outcome: R.outcome, reason: R.reason }),
    node: () => (R.outcome === "win" ? def.win : R.outcome === "lose" ? def.lose : null),
  };
  return api;
}

export function createRuns(G, runs) {
  const api = {
    defs: runs,
    current: null,
    // run(id) from content: a conversation hands over at the next step; outside one the shell
    // hears "run.request" and starts it.
    request(id) {
      if (!runs[id]) throw new Error(`no run ${id}`);
      G.state.pendingRun = id; G.emit("run.request", { id });
    },
    take() { const id = G.state.pendingRun; delete G.state.pendingRun; return id || null; },
    start(id, opts = {}) {
      const def = runs[id]; if (!def) throw new Error(`no run ${id}`);
      if (def.area && G.content.map.areas[def.area] && G.state.area !== def.area) G.world.enter(def.area);
      api.current = startRun(G, def, { mode: opts.mode || G.state.runMode || "full", world: opts.world || null });
      G.emit("run.start", { id, name: def.name });
      return api.current;
    },
    // The node the run leads to once it is done; clears the current run.
    finish() { const r = api.current; if (!r || !r.state.done) return null; api.current = null; const n = r.node(); (G.state.runs ||= {})[r.state.def.id] = r.state.outcome; return n; },
    outcome: (id) => (G.state.runs || {})[id] || "",
  };
  return api;
}
