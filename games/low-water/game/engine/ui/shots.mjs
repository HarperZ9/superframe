// States to jump to for screenshots and quick checks: play.html?shot=<name>. Each is driven
// through the same calls a player makes, on the placeholder content, with a fixed seed.
//   title create create-custom talk check daybook-notes daybook-claims daybook-margin daybook-sheet pack lamps
//   town history run settings saves pause end
const SEED = 7;

function begin(ctx, archetype = "a.clerk") {
  localStorage.clear();
  ctx.create();
  const errs = ctx.G.create({ archetype, trusted: "eye" });
  if (errs.length) throw new Error(`shot: creation failed: ${errs.join("; ")}`);
  ctx.play(ctx.G.rs.rules["start-node"] || ctx.G.book.meta.start);
  return ctx.G;
}
const pick = (ctx, text, strain = 0) => {
  const b = ctx.play.P.beat, o = b && b.options && b.options.find((x) => x.label.includes(text));
  if (!o) throw new Error(`shot: no option "${text}" in ${(b && b.options || []).map((x) => x.label).join(" | ")}`);
  ctx.play.choose(o.index, strain);
};
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// A short evening: questions, a thought found and pencilled, some kit, a check or two.
function evening(ctx) {
  const G = begin(ctx);
  pick(ctx, "Ask the first question."); pick(ctx, "Ask about the switch."); pick(ctx, "Think about the tide.");
  G.cabinet.research("t.tide_reader"); G.advance(12);
  G.sheet.addXp(120);
  for (const [id, n] of [["knife", 1], ["wick", 1], ["glass", 1], ["timber", 2], ["nails", 1], ["t.oilskin", 1], ["t.bowler", 1]]) G.inv.give(id, n);
  G.inv.equip("t.oilskin");
  G.factions.add("board", 35);
  return G;
}

const SHOTS = {
  title: (ctx) => { localStorage.clear(); ctx.title(); },
  create: (ctx) => { localStorage.clear(); ctx.create(); },
  // The custom spread with too few points spent: Begin shows G.create's errors as written.
  "create-custom": (ctx) => {
    localStorage.clear(); ctx.create();
    const cards = ctx.stage.querySelectorAll(".card"); cards[cards.length - 1].click();
    ctx.stage.querySelector(".detail .btn.go").click();
  },
  talk: (ctx) => { begin(ctx); },
  check: (ctx) => {
    const G = begin(ctx);
    ctx.play.startTalk("t.r.start");
    pick(ctx, "[BRASS]");
    const o = ctx.play.P.beat.options.find((x) => x.label.includes("[LEDGER]"));
    ctx.play.P.sel[o.key] = 1; ctx.play.render();
    const f = ctx.play.els.opts.querySelector(`[data-opt="${o.index}"]`); if (f) f.focus();
    void G;
  },
  "daybook-notes": (ctx) => { evening(ctx); ctx.daybook("notes"); },
  "daybook-claims": (ctx) => { evening(ctx); ctx.daybook("claims"); },
  "daybook-margin": (ctx) => { evening(ctx); ctx.daybook("margin"); },
  "daybook-sheet": (ctx) => { evening(ctx); ctx.daybook("sheet"); },
  pack: (ctx) => { evening(ctx); ctx.daybook("pack"); },
  lamps: (ctx) => { evening(ctx); ctx.daybook("lamps"); },
  town: (ctx) => { evening(ctx); ctx.daybook("town"); },
  history: (ctx) => {
    const G = evening(ctx);
    G.rs.rules["check-mode"] = "fixed"; // a fixed check logs a hidden line in the history
    pick(ctx, "[Eye] Look closer.");
    G.rs.rules["check-mode"] = "dice";
    ctx.daybook("history");
  },
  run: (ctx) => {
    begin(ctx); ctx.play.startTalk("t.r.hub"); pick(ctx, "Test run.");
    const r = ctx.G.runs.current; if (r) for (let k = 0; k < 6; k++) r.step(0.25, { x: 1, z: 0 });
  },
  settings: (ctx) => { localStorage.clear(); ctx.title(); ctx.settings(); },
  saves: (ctx) => { evening(ctx); ctx.saves.save("1", "Before the bar"); ctx.G.advance(25); ctx.saves.save("2", ""); ctx.savesPanel("load"); },
  pause: (ctx) => { evening(ctx); ctx.savesPanel("menu"); },
  verbs: (ctx) => { const G = begin(ctx); pick(ctx, "Leave."); ctx.play.close(); G.setPlace("t.yard"); G.verbs.act("o.lamp", "light"); ctx.play.render(); },
  sneak: (ctx) => {
    const G = begin(ctx); G.state.runMode = "stepped"; ctx.play.startTalk("t.r.hub"); pick(ctx, "Test sneak."); // stepped: the still holds
    const s = G.sneaks.current; G.command(["setPower", "quay", "off"]); G.inv.give("glass", 2);
    s.stepMove(1, 0, { crouch: true }); s.stepMove(1, 1, { crouch: true }); s.throwNoise([4, 5]); s.step(0.3, { crouch: true }); s.throwNoise([4, 5]); s.step(0.3, { crouch: true });
  },
  "sneak-alert": (ctx) => {
    const G = begin(ctx); ctx.play.startTalk("t.r.hub"); pick(ctx, "Test sneak.");
    const s = G.sneaks.current; for (let i = 0; i < 200 && !s.state.done; i++) s.stepMove(3 - s.state.x, 4.6 - s.state.z);
  },
  fight: (ctx) => { const G = begin(ctx); ctx.play.startTalk("t.r.hub"); pick(ctx, "Test fight."); for (let i = 0; i < 90; i++) G.loop.step(); },
  wide: (ctx) => { begin(ctx); ctx.play.startTalk("t.r.hub"); pick(ctx, "Test wide."); },
  world: (ctx) => { begin(ctx); pick(ctx, "Leave."); ctx.play.close(); },
  bar: (ctx) => { begin(ctx); pick(ctx, "Leave."); ctx.play.close(); ctx.play.exit(ctx.G.world.exits()[0]); },
};

export async function runShot(ctx, name) {
  const fn = SHOTS[name];
  if (!fn) { console.error(`shot: no state ${name}; known: ${Object.keys(SHOTS).join(", ")}`); ctx.title(); return; }
  Math.random = mulberry(SEED);
  if (!new URLSearchParams(location.search).has("motion")) document.documentElement.classList.add("calm"); // no fades caught half way in a capture (ux: ?motion keeps them, for motion captures)
  fn(ctx);
  window.__shell = ctx; // ux: the UI lead's input tests drive the shell from here (design/ux/uxshots.py)
  await frame();
  document.documentElement.dataset.shot = name;
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
