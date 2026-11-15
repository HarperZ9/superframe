// usage: node tools/ablate-feel.mjs <encounters,comma> [seeds=20] [styles,comma] [variants: now+oldhitstop+noedge+oldpaths+allold]
// e.dogs (and e.brawl) per style, 20 seeds, under the combat changes of 2026-10-21 switched on and off
const E = new URL("../../", import.meta.url).href;
const { createGame } = await import(E + "game.mjs"); const { installCombat } = await import(E + "combat/encounter.mjs");
const { createPilot } = await import(E + "combat/tools/pilot.mjs"); const { ACTS, STYLES } = await import(E + "combat/tools/kite.mjs");
const { loadPlateArena, PLATE_OF } = await import(E + "combat/data/plates.mjs");
const { FEEL } = await import(E + "combat/sim/hits.mjs"); const { BODY } = await import(E + "combat/sim/fighter.mjs"); const { PATHS } = await import(E + "combat/sim/paths.mjs");
const CONTENT = decodeURIComponent(new URL("../../../../content", import.meta.url).pathname).replace(/^\/(\w:)/, "$1");
const ids = (process.argv[2] || "e.dogs").split(","), seeds = +(process.argv[3] || 20), styles = (process.argv[4] || Object.keys(STYLES).join(",")).split(",");
const VARIANTS = {
  now: () => {},
  oldhitstop: () => { FEEL.hitstop.light = 4; FEEL.hitstop.heavy = 6; FEEL.crowdCap = 99; },
  noedge: () => { BODY.edge = 0; },
  oldpaths: () => { PATHS.narrow = false; PATHS.hug = 0; PATHS.wide = 0; },
  allold: () => { FEEL.hitstop.light = 4; FEEL.hitstop.heavy = 6; FEEL.crowdCap = 99; BODY.edge = 0; PATHS.narrow = false; PATHS.hug = 0; PATHS.wide = 0; },
};
const only = process.argv[5] ? process.argv[5].split("+") : Object.keys(VARIANTS);
const base = { f: { ...FEEL.hitstop }, cap: FEEL.crowdCap, b: { ...BODY }, p: { ...PATHS } };
for (const v of only) {
  Object.assign(FEEL.hitstop, base.f); FEEL.crowdCap = base.cap; Object.assign(BODY, base.b); Object.assign(PATHS, base.p); VARIANTS[v]();
  for (const id of ids) {
    const act = Object.keys(ACTS).find((k) => { try { return !!installCombat(createGame({ sources: ACTS[k](), seed: 1 })).defs[id]; } catch { return false; } });
    const row = [];
    for (const style of styles) {
      let won = 0, down = 0, t = 0;
      for (let s = 1; s <= seeds; s++) {
        const G = createGame({ sources: ACTS[act](), seed: s }), C = installCombat(G), area = C.defs[id].area;
        C.usePlate(area, await loadPlateArena(CONTENT, PLATE_OF[area] || area, { fightId: area }));
        const W = C.start(id, { lamb: STYLES[style] }), P = createPilot({ talk: "auto" });
        for (let i = 0; i < 7500 && !W.result; i++) C.step(P(W));
        const o = W.result.outcome; if (o === "win" || o === "yield") won++; else if (o === "down" || o === "lose") down++; else if (o === "talk") t++;
      }
      row.push(`${style} ${won}/${down}/${t}`);
    }
    console.log(v.padEnd(13), id.padEnd(10), row.join("  "));
  }
}
