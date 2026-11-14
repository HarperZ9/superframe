// What the harness knows about this particular story, kept in one place so the tools carry into a new
// story (author, 2026-10-21: a radical rework is coming). tools/policy.mjs holds the builds and routes;
// this file holds the rest. A new story replaces the bodies here and leaves the tools alone:
//   STORY.end(G, act)     at the last act's end: { finished, endings, ... } merged into the run's record.
//                         finished left out means "reached the last act's end".
//   STORY.watch(G, R, h)  optional: listeners for story moments the run should note (h.clock()).
//   STORY.report(r)       optional: extra lines for the run's printed summary.
//   LEDGER                the reckoning ledger's patterns (rules/reckoning.mjs): flags that profess, flags
//                         that act, variables whose moves are actions, and the totals' variable names.
//   GUARDS                events the script never needs (fallbacks a test fires): runsummary skips them.
//   BENCH                 tools/fightbench.mjs defaults: the fight, its plate and the hotspot that opens it.

export const LEDGER = {
  professed: /^(conviction|said|promise)\./,
  acted: /^(lied|broke)\./,
  moves: /^(lean_|lantern$)/,
  totals: ["gap", "owned", "denied"],
};

export const GUARDS = ["act 3 ev3.dawn"];

export const BENCH = { fight: "e.station", act: 2, plate: "station", area: "hill", hot: "5.1,0,1.1", door: "7,0,9.2" };

// Low Water as it stood on 2026-10-21: the verdict sent and both fates set; the collier rule and the gale lamps.
const LAMPS = ["light_mother", "light_steps", "light_balance", "light_hill", "light_bulb"];
export const STORY = {
  end(G, act) {
    const endings = { end: act.end, verdict: G.quests.stage("a3.verdict") || (G.flag("dawn3.sent") ? "sent" : ""), mother: G.scope.get("fate_mother"), lamb: G.scope.get("fate_lamb"), causes: G.state.flags.filter((f) => /^cause/.test(f)) };
    return {
      endings,
      finished: endings.verdict === "sent" && !!endings.mother && !!endings.lamb && endings.lamb !== "none",
      collier: G.flag("collier.through") ? "through" : G.flag("collier.spit") ? "spit" : "neither",
      collierWhy: { "mole3.mother": G.scope.get("var.mole3.mother"), "loss3.mother": G.flag("loss3.mother"), "said.day2_mother": G.flag("said.day2_mother"), "hill3.bearing": G.flag("hill3.bearing"), lampout: G.state.flags.filter((f) => /^lampout\./.test(f)), "lamp.balance.lit": G.flag("lamp.balance.lit"), "lamp.steps_post.lit": G.flag("lamp.steps_post.lit") },
      lamps: Object.fromEntries(LAMPS.map((v) => [v, +G.scope.get(`var.${v}`) || 0])),
    };
  },
  // the collier rule's inputs, read the moment its outcome is set (04:05), not at the end
  watch(G, R, h) {
    G.on("flag", (e) => {
      if (!e.on || (e.id !== "collier.through" && e.id !== "collier.spit")) return;
      const L = Object.fromEntries(LAMPS.map((v) => [v, +G.scope.get(`var.${v}`) || 0])), out = (k) => G.flag(`lampout.${k}`);
      R.collierAt = { clock: h.clock(), marks: {
        mother: !G.flag("loss3.mother") && (G.scope.get("var.mole3.mother") === "on" || (G.scope.get("var.mole3.mother") === "auto" && L.light_mother === 1 && !G.flag("said.day2_mother"))),
        stepsBalance: L.light_steps === 1 && !out("steps") && L.light_balance === 1 && !out("balance"),
        hillBulb: (G.flag("hill3.bearing") || L.light_hill === 1) && !out("hill") && L.light_bulb === 1 && !out("bulb"),
        lantern: G.flag("oldlight.lanterns") } };
    });
  },
  report(r) {
    const out = [];
    if (r.collier) out.push(`collier: ${r.collier}; gale lamps kept: ${Object.entries(r.lamps || {}).filter(([, v]) => v).map(([k]) => k.slice(6)).join(", ") || "none"}; rule inputs: ${JSON.stringify(r.collierWhy)}`);
    if (r.endings) out.push(`endings: ${r.endings.end}; verdict ${r.endings.verdict || "none"}; Mother ${r.endings.mother}; Lamb ${r.endings.lamb}; causes ${(r.endings.causes || []).join(", ") || "none"}`);
    return out;
  },
};
