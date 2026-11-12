// Interrogation grids for the harness (tools/playthrough.mjs --interrogations | --liegrid).
//
// runMatrix: every build into every scene on a fresh game of its act, with the pages a build has by
// then in a whole playthrough (act 1: none; act 2: 10; act 3: 17), pressing its own style first.
//
// runLieGrid (the director's lie-catching grid): each build plays its natural route (the normal
// harness run); the first time the route stands at a menu that offers a scene's opening option, the
// game's whole state is copied there. The scene is then played from that copy, with the build calling
// "That's a lie." every time it is offered. Per build and scene: whether the route reached the
// menu (never seeded by hand), whether the option was open there, whether a lie was said, whether
// the route's state held a catch fact, whether a lie was caught, and the outcome.
const STYLES = ["fist", "tongue", "shadow", "hands", "eye"], STYLE = (b) => (b === "fistmax" ? "fist" : b);
const startOf = (C, id) => Object.values(C.book.nodes).find((n) => n.steps.some((st) => st.effects && st.effects.calls && (st.effects.calls.get("interrogate") || []).some((a) => a[0] === id)));
// the menus that offer a scene's opening node (an option whose target is the start node)
const menusOf = (C, start) => Object.values(C.book.nodes).filter((n) => n.steps.some((st) => st.label != null && (st.target === start || st.fail === start))).map((n) => n.id);

// One scene played to its end. policy.lie: "held" (call only with a catch fact) or "always".
function playScene(X, G, C, id, build, { lie = "held" } = {}) {
  const row = { out: null, presses: [], passed: 0, checks: 0, said: 0, calls: 0, caught: 0, why: null };
  const offs = [G.on("interrog.finish", (e) => { if (e.id === id) row.out = e.out ? e.out.kind : "ended"; }), G.on("interrog.lie", () => row.said++), G.on("interrog.caught", () => row.caught++)];
  try {
    const start = startOf(C, id); let t = G.talk(start ? start.id : null);
    for (let turn = 0; turn < 40 && t.beat && t.beat.interrogation; turn++) {
      for (let i = 0; i < 180 && G.interrog.current && !G.interrog.outcome(); i++) G.loop.step();
      if (G.interrog.outcome()) { t.interrogResolve(); break; }
      t.interrogRefresh();
      const l = G.interrog.openLie(), O = t.beat.options;
      if (l && (lie === "always" || G.interrog.canCatch(l))) { const i = O.findIndex((o) => o.lie); if (i >= 0) { row.calls++; t.choose(i); if (G.interrog.current) continue; break; } }
      const presses = O.filter((o) => !o.lie && !o.locked), sc = (o) => X.score(G, build, o, { seed: 1, ends: X.ENDS, menu: presses });
      const pick = [presses.filter((o) => o.style === STYLE(build)), presses.filter((o) => o.style === "any"), presses].map((L) => L.sort((x, y) => sc(y) - sc(x))[0]).find(Boolean);
      if (!pick) { row.why = "no press left"; for (let i = 0; i < 60 * 30 && G.interrog.current && !G.interrog.outcome(); i++) G.loop.step(); if (G.interrog.outcome()) t.interrogResolve(); break; } // live play: silence
      row.presses.push(`${pick.style}${pick.check ? `:${pick.check.skill || ""}` : ""}`);
      const b = t.choose(pick.index, { strain: X.strainFor(G, build, pick) });
      if (pick.check) { row.checks++; const L = (b.lines || []).find((x) => x.kind === "check"); if (L && L.check && L.check.pass) row.passed++; }
      if (!G.interrog.current) break;
    }
    if (!row.out) row.out = t.beat && t.beat.interrogation ? "unfinished" : "never opened";
  } catch (e) { row.out = "error"; row.why = e.message; }
  for (const off of offs) off();
  return row;
}

export function runMatrix(X) {
  const PAGES = [0, 10, 17], out = [];
  for (const [ai, C] of X.contents.entries()) for (const id of Object.keys(C.interrogations || {})) {
    const def = C.interrogations[id];
    for (const build of STYLES) {
      const G = X.createFullGame({ content: C, seed: 1 });
      G.create({ archetype: X.BUILDS[build].precedent, enter: false }); X.applyMax(G, build);
      if (PAGES[ai]) G.sheet.addXp(PAGES[ai] * (+G.rs.rules["xp-per-level"] || 1));
      X.upkeep(G, build);
      if (def.place) G.setPlace(def.place);
      out.push({ act: ai + 1, id, build, ...playScene(X, G, C, id, build) });
    }
  }
  console.log("act  interrogation  build   outcome      presses (style:skill)                          checks passed  lies caught");
  for (const r of out) console.log(`${r.act}    ${r.id.padEnd(13)} ${r.build.padEnd(7)} ${String(r.out).padEnd(12)} ${r.presses.join(" ").padEnd(46)} ${`${r.passed}/${r.checks}`.padEnd(14)} ${r.caught}${r.why ? `  (${r.why})` : ""}`);
  return out;
}

export async function runLieGrid(X) {
  // the scenes, their opening nodes and the menus that offer them
  const scenes = [];
  for (const [ai, C] of X.contents.entries()) for (const id of Object.keys(C.interrogations || {})) { const s = startOf(C, id); if (s) scenes.push({ ai, id, start: s.id, menus: new Set(menusOf(C, s.id)), def: C.interrogations[id] }); }
  const snaps = {}; // build -> scene id -> { state, open, node, clock }
  for (const build of STYLES) {
    snaps[build] = {};
    X.setMenuHook((G, t, act) => {
      for (const sc of scenes) {
        if (sc.ai !== act.act - 1 || snaps[build][sc.id] || !sc.menus.has(t.node)) continue;
        const open = (t.beat.options || []).some((o) => o.s && (o.s.target === sc.start || o.s.fail === sc.start));
        snaps[build][sc.id] = { state: structuredClone(G.state), open, node: t.node, clock: G.clock() };
      }
    });
    X.playGame({ build, seed: 1, shuffleSeed: 101 });
  }
  X.setMenuHook(null);
  const out = [];
  for (const sc of scenes) for (const build of STYLES) {
    const snap = snaps[build][sc.id], row = { act: sc.ai + 1, id: sc.id, build, reached: !!snap, menu: snap ? snap.node : null, open: snap ? snap.open : null };
    if (!snap) { out.push({ ...row, out: "not reached on its route" }); continue; }
    const C = X.contents[sc.ai], G = X.createFullGame({ content: C, seed: 1, state: structuredClone(snap.state) });
    row.factHeld = sc.def.lies.map((l) => !l.catch || l.catch.some((f) => G.flag(f)));
    row.facts = sc.def.lies.map((l) => (l.catch || []).filter((f) => G.flag(f)));
    out.push({ ...row, ...playScene(X, G, C, sc.id, build, { lie: X.opt.attentive ? "held" : "always" }) }); // the attentive player calls a lie only holding the fact
  }
  console.log("act  interrogation  build   reached (menu, option open)            lie said  catch fact held          caught  outcome");
  for (const r of out) {
    if (!r.reached) { console.log(`${r.act}    ${r.id.padEnd(13)} ${r.build.padEnd(7)} not reached on its route`); continue; }
    console.log(`${r.act}    ${r.id.padEnd(13)} ${r.build.padEnd(7)} ${`yes (${r.menu}, ${r.open ? "open" : "shut"})`.padEnd(38)} ${(r.said ? "yes" : "no").padEnd(9)} ${(r.factHeld.some(Boolean) ? `yes (${r.facts.flat().join(", ") || "no fact needed"})` : "no").padEnd(24)} ${(r.caught ? "yes" : "no").padEnd(7)} ${r.out}${r.why ? `  (${r.why})` : ""}`);
  }
  return out;
}
