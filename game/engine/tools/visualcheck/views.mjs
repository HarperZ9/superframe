// The fixed views tools/visual-check.mjs judges. Each is page code run after play.html?capture=1
// loads: a fresh Act 1 game (seed 11, the Wader), put somewhere that shows a known defect class.
// Every view ends with Lamb standing still and the plate and its ground loaded. Wanderers stand still
// in these views (their walk is random), so two runs of one build measure the same scene.
const BOOT = (place) => `(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('${place}'); for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) f.wander = 0; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const WALK = (x, z) => `(async () => { const p = window.__lw.play; p.people.walkTo([${x}, 0, ${z}], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const FIG = (list) => `(() => { const a = window.__lw.G.world.area(); for (const [id, x, z] of ${JSON.stringify(list)}) { const f = a.figures.find((f) => f.id === id); if (f) { f.at = [x, 0, z]; f.cond = null; f.wander = 0; } else a.figures.push({ id, at: [x, 0, z], face: 1, wander: 0, cond: null }); } return true; })()`;

export const VIEWS = [
  // a control the check must fail: two people standing in one spot, bodies through each other. If this view ever
  // passes, the silhouette test has gone blind (the run fails)
  { id: "control-two-in-one-spot", expectFail: /silhouettes pass through/, why: "self-test: two bodies in one spot", steps: [BOOT("quay"), FIG([["fewell", 0.6, -2.2], ["strand", 0.66, -2.24]]), "(() => { const G = window.__lw.G; G.figureMoved = { fewell: [0.6, 0.02, -2.2], strand: [0.66, 0.02, -2.24] }; return true; })()", /* placed where a fight left them: the game's spacing does not move them */ "(() => { const p = window.__lw.play; p.people.walkTo([-3, 0, -2.4], () => {}); return true; })()", "(async () => { await new Promise((r) => setTimeout(r, 2500)); const A = window.__lw.G.world.area(); for (const f of A.figures) if (f.id === 'fewell' || f.id === 'strand') f.pose = null; return true; })()"] },
  { id: "brine-bar", why: "people at the bar counter, a bench and tables", steps: [BOOT("brine"), WALK(0.2, -1.2)] },
  { id: "brine-stove-chair", why: "the UI lead's shot: Merrow by the red chair and the stove, Sabine behind the counter", steps: [BOOT("brine"), WALK(-2.4, -0.5), "(async () => { await new Promise((r) => setTimeout(r, 5000)); return true; })()"] },
  { id: "harbour-office", why: "a small room: desk, chair, bench and the cells stair", steps: [BOOT("harbour"), "(async () => { const c = window.__lw; c.G.advance(95); c.G.setPlace('harbour'); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()", WALK(0.4, -0.6)] },
  { id: "quay-stairs-bench", why: "the quay steps and the benches by the weigh-house", steps: [BOOT("quay"), WALK(2.7, -1.9)] },
  { id: "crowd-of-four", why: "four people within a couple of metres: overlapping bodies and shadows", steps: [BOOT("quay"), FIG([["fewell", 0.2, -1.6], ["strand", 0.9, -1.9], ["hobb", 0.4, -2.5]]), WALK(-0.4, -2.0)] },
  { id: "fight-against-a-wall", why: "a fight started by the weigh-house wall", steps: [BOOT("quay"), WALK(3.3, -2.3), FIG([["fewell", 4.0, -2.4], ["strand", 2.7, -2.7]]),
    // deterministic: the world's loop is held, the fight starts and is stepped exactly 120 fixed frames (2 s), then held for the shot
    `(async () => { const c = window.__lw, p = c.play; c.G.loop.paused = true; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); for (let k = 0; k < 120; k++) c.G.loop.step(); await new Promise((r) => setTimeout(r, 900)); return !!document.querySelector('canvas.fightcanvas'); })()`] },
];
