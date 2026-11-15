// The fixed views tools/visual-check.mjs judges. Each is page code run after play.html?capture=1
// loads: a fresh game (seed 11), put somewhere that shows a known defect class.
// Every view ends with the player standing still and the plate and its ground loaded. Wanderers stand still
// in these views (their walk is random), so two runs of one build measure the same scene.
// Two sets, picked by the story the run loads (the page's content= query, so the views and the page agree):
//   node tools/visual-check.mjs ...                          the Gullet set (Act 1, the Wader)
//   node tools/visual-check.mjs --query content=quota ...    the Quota set (era 2, the Inspector line)
// visual-check.mjs builds its unpainted and camouflage controls from the view named "notes-walking", so
// each set has a view of that name.
const STORY = (() => { const a = process.argv.slice(2), i = a.indexOf("--query"); return i >= 0 && /(^|&)content=quota(&|$)/.test(a[i + 1] || "") ? "quota" : "gullet"; })();
const BOOT = (place) => `(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('${place}'); for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) f.wander = 0; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const WALK = (x, z) => `(async () => { const p = window.__lw.play; p.people.walkTo([${x}, 0, ${z}], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const FIG = (list) => `(() => { const a = window.__lw.G.world.area(); for (const [id, x, z] of ${JSON.stringify(list)}) { const f = a.figures.find((f) => f.id === id); if (f) { f.at = [x, 0, z]; f.cond = null; f.wander = 0; } else a.figures.push({ id, at: [x, 0, z], face: 1, wander: 0, cond: null }); } return true; })()`;

// Lamb set exactly on a spot after a walk: the walk's end varies with frame timing (under load it stopped
// 0.02 to 0.1 m off), and the check must judge the same scene every run. Each view puts Lamb where its walk
// ends on a quiet machine (the walk goes round props and people, so that is not the walk's target).
const PUT = (x, z) => `(() => { const G = window.__lw.G, p = G.state.pos; G.state.pos = [${x}, p ? p[1] : 0, ${z}]; return true; })()`;

export const GULLET_VIEWS = [
  // a control the check must fail: two people standing in one spot, bodies through each other. If this view ever
  // passes, the silhouette test has gone blind (the run fails)
  { id: "control-two-in-one-spot", expectFail: /silhouettes pass through/, why: "self-test: two bodies in one spot", steps: [BOOT("quay"), FIG([["fewell", 0.6, -2.2], ["strand", 0.66, -2.24]]), "(() => { const G = window.__lw.G; G.figureMoved = { fewell: [0.6, 0.02, -2.2], strand: [0.66, 0.02, -2.24] }; return true; })()", /* placed where a fight left them: the game's spacing does not move them */ "(() => { const p = window.__lw.play; p.people.walkTo([-3, 0, -2.4], () => {}); return true; })()", "(async () => { await new Promise((r) => setTimeout(r, 2500)); const A = window.__lw.G.world.area(); for (const f of A.figures) if (f.id === 'fewell' || f.id === 'strand') f.pose = null; return true; })()"] },
  // a burst of notes (five pack items and two found tools at once) while walking, then while talking: one
  // spaced, capped stack, clear of the place menu and the talk panel
  { id: "notes-walking", why: "notes never cover the place menu or each other", steps: [BOOT("quay"), "(async () => { const G = window.__lw.G; await new Promise((r) => setTimeout(r, 1500)); for (const id of ['i.lantern', 'w.marlinspike', 'w.hammer']) G.inv.give(id, 1); for (let k = 0; k < 4; k++) G.emit('item.gain', { id: 'i.chit' + k, n: 1, name: 'A chit ' + k }); return true; })()"] },
  { id: "notes-talking", why: "notes move off the talk panel's side", steps: [BOOT("quay"), "(async () => { const c = window.__lw, p = c.play; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); await new Promise((r) => setTimeout(r, 1500)); for (const id of ['w.marlinspike', 'w.hammer']) c.G.inv.give(id, 1); c.G.emit('quest', { name: 'The lamps', text: 'Fewell has a story' }); return true; })()"] },
  // a control the check must fail: a note pinned over the place menu
  { id: "control-note-over-menu", expectFail: /ui: a note/, why: "self-test: a note over the place menu", steps: [BOOT("quay"), "(async () => { const b = document.getElementById('toasts'), here = document.querySelector('.screen.play .here').getBoundingClientRect(), n = document.createElement('div'); n.className = 'toast'; n.textContent = 'planted'; b.append(n); Object.assign(b.style, { position: 'fixed', left: here.left + 'px', top: here.top + 'px', transform: 'none' }); window.__lwNoPlace = true; return true; })()"] },
  { id: "brine-bar", why: "people at the bar counter, a bench and tables", steps: [BOOT("brine"), WALK(0.2, -1.2), PUT(1.567, -0.455)] },
  { id: "brine-stove-chair", why: "the UI lead's shot: Merrow by the red chair and the stove, Sabine behind the counter", steps: [BOOT("brine"), WALK(-2.4, -0.5), PUT(-2.933, -1.455), "(async () => { await new Promise((r) => setTimeout(r, 5000)); return true; })()"] },
  { id: "harbour-office", why: "a small room: desk, chair, bench and the cells stair", steps: [BOOT("harbour"), "(async () => { const c = window.__lw; c.G.advance(95); c.G.setPlace('harbour'); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()", WALK(0.4, -0.6)] },
  { id: "quay-stairs-bench", why: "the quay steps and the benches by the weigh-house", steps: [BOOT("quay"), WALK(2.7, -1.9), PUT(-0.595, -1.804)] },
  { id: "crowd-of-four", why: "four people within a couple of metres: overlapping bodies and shadows", steps: [BOOT("quay"), FIG([["fewell", 0.2, -1.6], ["strand", 0.9, -1.9], ["hobb", 0.4, -2.5]]), WALK(-0.4, -2.0), PUT(-0.86, -2.345)] },
  { id: "fight-against-a-wall", why: "a fight started by the weigh-house wall", steps: [BOOT("quay"), WALK(3.3, -2.3), PUT(3.3, -2.3), FIG([["fewell", 4.0, -2.4], ["strand", 2.7, -2.7]]),
    // deterministic: the world's loop is held, the fight starts and is stepped exactly 120 fixed frames (2 s), then held for the shot
    `(async () => { const c = window.__lw, p = c.play; c.G.loop.paused = true; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); for (let k = 0; k < 120; k++) c.G.loop.step(); await new Promise((r) => setTimeout(r, 900)); return !!document.querySelector('canvas.fightcanvas'); })()`] },
];

// ---------------------------------------------------------------- the Quota (era 2), W1-A, 2026-10-22
// A fresh Quota game on seed 11 as the shell starts it (no creation screen: the story's first node), the
// class chosen at q.start.class (0 the Inspector, Ned; 1 the Sergeant, Will), the talk closed and the wide
// lens dropped, then the place set. Throws when the page holds another story, so a run without
// --query content=quota fails loudly and judges nothing.
const QBOOT = (place, cls = 0) => `(async () => { const c = window.__lw, z = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!c.content.book.nodes || !c.content.book.nodes['q.start.class']) throw new Error('the Quota views need the Quota loaded: --query content=quota');
  c.newGame(11); const errs = c.G.create({ archetype: c.content.rs.rules['start-archetype'] || Object.keys(c.content.rs.archetypes)[0] }); if (errs.length) throw new Error('start: ' + errs.join('; '));
  c.play(c.content.book.meta.start || null); let p = c.play; for (let i = 0; i < 50 && !(p.P.beat && p.P.beat.options && p.P.beat.options.length); i++) await z(100);
  p.choose(${cls}); const G = c.G; delete G.state.camera; G.setPlace('${place}'); for (const ar of Object.values(G.content.map.areas)) for (const f of ar.figures) f.wander = 0;
  c.play(); p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
  for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await z(100); await z(4000); return true; })()`;   // 4 s more: without it the Haldane kitchen and the cells were judged before their figures and shadows settled on 3 of 6 runs (half the shadows off the floor, the player at a fifth of the plate's tone), and passed on the others
// a pale wash painted on the plate canvas in view: the figures' surroundings lift by about three stops, so every
// figure reads far darker than the plate round it. The check reads that canvas, so it must fail the figure band
const LIFT = "(async () => { await new Promise((q) => setTimeout(q, 1500)); const c = document.querySelector('canvas.platecam-img'), f = window.__lw.play.cam.frameNow(); if (!c || !f) return false; const g = c.getContext('2d'); g.fillStyle = 'rgba(236, 226, 206, 0.85)'; g.fillRect(f.left, f.top, innerWidth / f.zoom, innerHeight / f.zoom); return true; })()";
// the same lift as the returns room's light gives it: a screen-blended wash laid over the plate and under the people
// layer, as the paint light (canvas.paintlight, mix-blend-mode screen) lights the plate and leaves the figures
// dark. On screen the figures read black on a lit floor. The check must fail this too; while it reads the plate
// canvas alone (before the light layer) it cannot, and the run says so (design/COMPLETION.md U6)
const LIT_FLOOR = "(async () => { await new Promise((q) => setTimeout(q, 1500)); const pc = window.__lw.play.people.canvas || document.querySelector('canvas.peoplecanvas'); if (!pc) return false; const d = document.createElement('div'); d.className = 'vc-planted-light'; Object.assign(d.style, { position: 'absolute', inset: '0', pointerEvents: 'none', mixBlendMode: 'screen', background: 'rgba(236, 210, 170, 0.7)' }); pc.before(d); await new Promise((q) => setTimeout(q, 600)); return true; })()";
const QNOTES = "(async () => { const G = window.__lw.G; await new Promise((r) => setTimeout(r, 1500)); for (let k = 0; k < 6; k++) G.emit('item.gain', { id: 'i.chit' + k, n: 1, name: 'A ration chit ' + k }); G.emit('quest', { name: 'The returns', text: 'The yard is short' }); return true; })()";
const QWALK = (x, z) => WALK(x, z);

export const QUOTA_VIEWS = [
  // the four rooms. The returns room is the one the ledger marks (U6): Tomas and the inspector drawn near-black
  { id: "q-returns", why: "the returns room, district office: Mott at the counter, Tomas on the bench side (U6: figures near-black)", steps: [QBOOT("q_returns")] },
  { id: "q-office", why: "the district meeting room: Pask, Pardew and Will seated at the table", steps: [QBOOT("q_office")] },
  { id: "q1-board", why: "era 1: the registrar's upstairs room at harvest, the player at the board table (W3-C; no era 1 figures yet)", steps: [QBOOT("q1_board")] },
  { id: "q1-supper", why: "era 1: Orme's barn laid for the harvest supper, the player by the long table (W3-C; no era 1 figures yet)", steps: [QBOOT("q1_supper")] },
  { id: "q3-office", why: "era 3: the allocation counter, the player at the queue rail (plates package; no era 3 figures yet)", steps: [QBOOT("q3_office")] },
  { id: "q3-mott", why: "era 3: the old Mott house front room, the door table under its bulb (plates package; no era 3 figures yet)", steps: [QBOOT("q3_mott_house")] },
  { id: "q4-police", why: "era 4: the police station desk under its tubes, the player at the public counter (plates package; no era 4 figures yet)", steps: [QBOOT("q4_police")] },
  { id: "q4-joss", why: "era 4: Joss Haldane's flat, the door table under its bulb (plates package; no era 4 figures yet)", steps: [QBOOT("q4_joss_flat")] },
  { id: "q3-church", why: "era 3: the Furrow Church, the sleet light through the tall window across the slabs (pass 2; no era 3 figures yet)", steps: [QBOOT("q3_church")] },
  { id: "q4-stair", why: "era 4: stairwell C on the far-bank estate, the walkway sodium in through the propped door (pass 2; no era 4 figures yet)", steps: [QBOOT("q4_estate_stair")] },
  { id: "q5-mara", why: "era 5: Mara's flat in Haldane Yard, the ledger on the table, the bowl on the sill (plates package; no era 5 figures yet)", steps: [QBOOT("q5_mara_flat")] },
  { id: "q5-archive", why: "era 5: the archive in the old district office, the Tesk book under the reading lamp (plates package; no era 5 figures yet)", steps: [QBOOT("q5_archive")] },
  { id: "q-haldane", why: "the Haldane kitchen: Tomas, Aaron, Anni, Ilo and Bet within two metres", steps: [QBOOT("q_haldane")] },
  { id: "q-cells", why: "the cells under the office: Gedge standing, Tesk seated", steps: [QBOOT("q_cells")] },
  // a burst of notes in a Quota room (seven at once): one spaced, capped stack, clear of the place menu. Named as
  // the Gullet's view is, because visual-check.mjs builds its unpainted and camouflage controls from it
  { id: "notes-walking", why: "Quota: notes never cover the place menu or each other (the Haldane kitchen)", steps: [QBOOT("q_haldane"), QNOTES] },
  // controls, each planting one defect the check must fail on, in a Quota room
  { id: "control-two-in-one-spot", expectFail: /silhouettes pass through|bodies overlap/, why: "self-test: Anni and Bet in one spot in the Haldane kitchen", steps: [QBOOT("q_haldane"), FIG([["anni", 0.2, -0.4], ["bet", 0.26, -0.44]]), "(() => { const G = window.__lw.G; G.figureMoved = { anni: [0.2, 0, -0.4], bet: [0.26, 0, -0.44] }; return true; })()", QWALK(0.9, 1.0)] },
  { id: "control-note-over-menu", expectFail: /ui: a note/, why: "self-test: a note over the place menu in the returns room", steps: [QBOOT("q_returns"), "(async () => { const b = document.getElementById('toasts'), here = document.querySelector('.screen.play .here').getBoundingClientRect(), n = document.createElement('div'); n.className = 'toast'; n.textContent = 'planted'; b.append(n); Object.assign(b.style, { position: 'fixed', left: here.left + 'px', top: here.top + 'px', transform: 'none' }); window.__lwNoPlace = true; return true; })()"] },
  { id: "control-plate-lifted", expectFail: /figure mid-tone/, why: "self-test: the Haldane kitchen's plate washed pale round its people, so they read too dark for the band", steps: [QBOOT("q_haldane"), LIFT] },
  { id: "control-lit-floor-dark-figures", expectFail: /figure mid-tone/, why: "self-test: a screen-blended light over the plate and under the people (the returns room's defect)", steps: [QBOOT("q_haldane"), LIT_FLOOR] },
];

export const VIEWS = STORY === "quota" ? QUOTA_VIEWS : GULLET_VIEWS;
export { QBOOT as QUOTA_BOOT };   // tools/bench-views.mjs starts its Quota rooms the same way
