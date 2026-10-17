// The fixed views tools/visual-check.mjs judges. Each is page code run after play.html?capture=1
// loads: a fresh Act 1 game (seed 11, the Wader), put somewhere that shows a known defect class.
// Every view ends with Lamb standing still and the plate and its ground loaded.
const BOOT = (place) => `(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('${place}'); c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const WALK = (x, z) => `(async () => { const p = window.__lw.play; p.people.walkTo([${x}, 0, ${z}], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const FIG = (list) => `(() => { const a = window.__lw.G.world.area(); for (const [id, x, z] of ${JSON.stringify(list)}) { const f = a.figures.find((f) => f.id === id); if (f) { f.at = [x, 0, z]; f.cond = null; f.wander = 0; } else a.figures.push({ id, at: [x, 0, z], face: 1, wander: 0, cond: null }); } return true; })()`;

export const VIEWS = [
  { id: "brine-bar", why: "people at the bar counter, a bench and tables", steps: [BOOT("brine"), WALK(0.2, -1.2)] },
  { id: "brine-stove-chair", why: "the UI lead's shot: Merrow by the red chair and the stove, Sabine behind the counter", steps: [BOOT("brine"), WALK(-2.4, -0.5), "(async () => { await new Promise((r) => setTimeout(r, 5000)); return true; })()"] },
  { id: "harbour-office", why: "a small room: desk, chair, bench and the cells stair", steps: [BOOT("harbour"), "(async () => { const c = window.__lw; c.G.advance(95); c.G.setPlace('harbour'); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()", WALK(0.4, -0.6)] },
  { id: "quay-stairs-bench", why: "the quay steps and the benches by the weigh-house", steps: [BOOT("quay"), WALK(2.7, -1.9)] },
  { id: "crowd-of-four", why: "four people within a couple of metres: overlapping bodies and shadows", steps: [BOOT("quay"), FIG([["fewell", 0.2, -1.6], ["strand", 0.9, -1.9], ["hobb", 0.4, -2.5]]), WALK(-0.4, -2.0)] },
  { id: "fight-against-a-wall", why: "a fight started by the weigh-house wall", steps: [BOOT("quay"), WALK(3.3, -2.3), FIG([["fewell", 4.0, -2.4], ["strand", 2.7, -2.7]]),
    `(async () => { const p = window.__lw.play; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); await new Promise((r) => setTimeout(r, 600)); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); await new Promise((r) => setTimeout(r, 1800)); return !!document.querySelector('canvas.fightcanvas'); })()`] },
];
