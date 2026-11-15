// Heavier views for tools/bench.mjs (the performance engineer's; game/engine/paint/tools/views.mjs is the
// rendering lead's): a night fight on the quay with six wardens (seven fighters) and two people looking
// on, stepped like the paint views' fight (the loop held after 120 fixed frames).
import { VIEWS, PLATE } from "../game/engine/paint/tools/views.mjs";
import { QUOTA_BOOT } from "../game/engine/tools/visualcheck/views.mjs";
const BOOT = VIEWS.find((v) => v.id === "quay-fight").steps[0];
const BRAWL = (foes, onlookers) => `(async () => { const c = window.__lw, G = c.G, C = G.ext.combat, d = C.defs['e.wardens'];
  C.defs['e.perf.brawl'] = { ...d, id: 'e.perf.brawl', name: 'Brawl (bench)', foes: d.foes.map((f) => ({ ...f, n: ${foes} })) };
  const a = G.world.area(), extra = ${JSON.stringify([["fewell", 1.2, -1.0], ["strand", 2.2, -0.8], ["hobb", 5.0, -1.2]])}.slice(0, ${onlookers});
  for (const [id, x, z] of extra) { const f = a.figures.find((f) => f.id === id); if (f) { f.at = [x, 0, z]; f.cond = null; f.wander = 0; } else a.figures.push({ id, at: [x, 0, z], face: 1, wander: 0, cond: null }); }
  G.loop.paused = true; c.play.fightThen('e.perf.brawl'); for (let k = 0; k < 120; k++) G.loop.step();
  await new Promise((r) => setTimeout(r, 1500)); return !!document.querySelector('canvas.fightcanvas'); })()`;
// The wide lens with a crowd (characters/runtime/crowd.mjs, the cards from tools/crowd-cards.mjs): the
// quay pulled back to the whole plate, n people on its open ground (six in ten walking; the measure waits for
// the plate's depth planes, up to 15 s), and nine
// townsfolk plus Lamb as full figures wandering among them. The cards first: node tools/crowd-cards.mjs --plate quay --ppm 40
const QUAY = VIEWS.find((v) => v.id === "quay-walk").steps[0];
const CROWD = (n, full) => `(async () => { const c = window.__lw, p = c.play, G = c.G; G.state.camera = { mode: 'wide' };
  const a = G.world.area(), ids = ${JSON.stringify(["hobb", "coe", "ash", "cockle", "dace", "gill", "mab", "noll", "pip"])}.slice(0, ${full});
  for (const id of ids) { const f = a.figures.find((f) => f.id === id); if (f) { f.wander = 3; f.cond = null; } else a.figures.push({ id, at: [0, 0, -1.5], face: 1, wander: 3, cond: null }); }
  for (let i = 0; i < 100 && !p.cam.arena(); i++) await new Promise((r) => setTimeout(r, 100));
  const A = p.cam.arena(), open = []; for (let r = 0; r < A.grid.h; r++) for (let q = 0; q < A.grid.w; q++) { const cell = A.grid.cells[r * A.grid.w + q]; if (cell) open.push([A.origin[0] + (q + 0.5) * A.cell, cell.h, A.origin[1] + (r + 0.5) * A.cell]); }
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const people = Array.from({ length: ${n} }, (_, i) => { const at = open[Math.floor(rnd() * open.length)]; return { at: [at[0] + (rnd() - 0.5) * 0.2, at[1], at[2] + (rnd() - 0.5) * 0.2], face: rnd() * 6.283, walk: rnd() < 0.6 ? 1 + rnd() * 0.5 : 0 }; });
  const { loadCrowd, makeCrowd } = await import('/characters/runtime/crowd.mjs'), C = await loadCrowd('/characters/crowd/out/quay-night.json');
  p.people.crowd(makeCrowd(C, people)); for (let i = 0; i < 150 && !/[?&]planes=0/.test(location.search) && !(p.cam.planes && p.cam.planes()); i++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 2500)); return true; })()`;
// The Quota in conversation (the UI art lead's, 2026-10-21): the returns room, Ned's morning at the counter with
// Mott, the talk page lettered and aged with its stamps. Run with --query content=quota (the era's interface) and
// again with --query content=quota&era=0 (the plain interface); the UI layer's cost is the difference. It used to
// reach the room by choosing the first option twice from the title; the story's opening changed (2026-10-22) and
// that path now stops in the bell tower with the player as a marker, so the view goes to the room itself (W1-A).
const QUOTA_TALK = "(async () => { const p = window.__lw.play; p.people.talkingWith('mott'); p.startTalk('q.ned.morning'); await new Promise((r) => setTimeout(r, 2500)); return !!(p.P.beat && p.P.talk); })()";
// A move between places through the ink blot (ui/platecam.mjs: cover, load the next plate, reveal), the
// stand-in for the move between lenses until the Quota's wide and narrow plates exist: measured over 6 s from
// half a second before the move (?blot=1 keeps the blot in a capture).
const MOVE = (place) => `() => { window.__lw.G.setPlace('${place}'); }`;
// The talk panel's portrait (ui/portrait.mjs, the real slot): the quay's conversation open, then 0.5 s into
// the window Fewell's face shown in the slot (a 512 x 640 image decoded), and a second later another
// expression (the 120 ms cross-fade); and the same conversation with no face, for the face's own cost.
const TALKV = VIEWS.find((v) => v.id === "quay-talk");
const FACES = `() => { (async () => { const { portraitSlot } = await import('/engine/ui/portrait.mjs'); const P = portraitSlot(), panel = document.querySelector('aside.talk') || document.body; panel.prepend(P.el);
  await P.update({ who: 'fewell', speaker: 'Fewell', face: 'neutral', light: 'sodium' }); await new Promise((r) => setTimeout(r, 1000)); await P.update({ who: 'fewell', speaker: 'Fewell', face: 'wary', light: 'sodium' }); })(); }`;
// The Quota's places (asked by the light lead, 2026-10-22), for the light model and effects against 16.7 ms
// (compare with --q2 lightmodel=0,fx=off): the wide square with the relief queue as crowd cards along the
// plate's marks.queue.path at its spacing (the plate's own atlas from tools/crowd-cards.mjs if baked, else
// the quay's, which is labelled), three full figures; and the granary door with the Captain. The plates must be
// in content/ (until they are baked there, a worktree may hold the painted lead's previews, untracked).
const QUEUE = (full) => `(async () => { const c = window.__lw, p = c.play, a = c.G.world.area(); c.G.state.camera = { mode: 'wide' }; for (const [id, x, z] of ${JSON.stringify([["hobb", 6, 8], ["coe", 2, 12], ["ash", -8, 9]])}.slice(0, ${full})) a.figures.push({ id, at: [x, 0, z], face: 1, wander: 2, cond: null });
  for (let i = 0; i < 100 && !p.cam.arena(); i++) await new Promise((r) => setTimeout(r, 100));
  const pj = p.cam.place(), Q = (pj.marks && pj.marks.queue) || null; if (!Q) throw new Error('bench: ' + pj.place + ' has no marks.queue');
  const pts = [], sp = Q.spacing || 0.75; for (let k = 1; k < Q.path.length; k++) { const A = Q.path[k - 1], B = Q.path[k], d = Math.hypot(B[0] - A[0], B[2] - A[2]); for (let t = 0; t < d; t += sp) pts.push({ at: [A[0] + (B[0] - A[0]) * t / d, A[1], A[2] + (B[2] - A[2]) * t / d], face: Math.atan2(A[2] - B[2], A[0] - B[0]), walk: 0 }); }
  const { loadCrowd, makeCrowd } = await import('/characters/runtime/crowd.mjs'), own = '/characters/crowd/out/' + pj.place + '-' + (pj.variants || ['night'])[0] + '.json';
  // an atlas is loaded only when its file is there: the server answers a missing file with 404 and the text
  // "ENOENT", which loadCrowd used to parse as JSON, so the view died before it measured (W1-A, 2026-10-22)
  const atlas = async (url) => ((await fetch(url, { method: 'HEAD' })).ok ? loadCrowd(url) : null);
  let C = await atlas(own), note = 'own cards';
  if (!C) { C = await atlas('/characters/crowd/out/quay-night.json'); note = 'quay cards (no atlas for ' + pj.place + ')'; }
  if (C) p.people.crowd(makeCrowd(C, pts)); else note = 'no cards: no atlas baked (node tools/crowd-cards.mjs --plate ' + pj.place + ')';
  // the bench prints page exceptions and nothing else from the page, so a measure taken without the plate's own
  // cards reports itself that way (reportError logs it as uncaught and goes on)
  if (note !== 'own cards') reportError(new Error('bench: quota-square measured with ' + note));
  window.__lwBenchNote = note + ', ' + pts.length + ' in the queue'; for (let i = 0; i < 150 && !/[?&]planes=0/.test(location.search) && !(p.cam.planes && p.cam.planes()); i++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 2500)); return true; })()`;
export const MORE_VIEWS = [
  { id: "quota-square", why: "the Quota's wide square with the relief queue as cards and three full figures", steps: [PLATE("q_square_wide", "q_square_wide", [8.5, 0, 9.5]), QUEUE(3)] },
  { id: "quota-granary", why: "the granary door with the Captain", steps: [PLATE("q_granary", "q_granary", [0.4, 0, 2], [["holt", 0, 0, -2.4]])] },
  { id: "quota-talk", why: "the Quota's returns room in conversation (compare content=quota with content=quota&era=0)", steps: [QUOTA_BOOT("q_returns"), QUOTA_TALK] },
  { id: "talk-portrait", why: "the quay's conversation, Fewell's face shown and changed in the portrait slot", steps: TALKV.steps, during: FACES, measureMs: 4000 },
  { id: "talk-noportrait", why: "the same conversation with no face", steps: TALKV.steps, during: "() => {}", measureMs: 4000 },
  { id: "move-quay-brine", why: "quay to the Brine through the ink blot", steps: [QUAY], during: MOVE("brine"), measureMs: 6000 },
  { id: "crowd-300", why: "the wide lens: the whole quay, 300 people as cards and ten full figures", steps: [QUAY, CROWD(300, 9)] },
  { id: "crowd-0", why: "the same wide quay and ten full figures, no crowd (the cards' cost is the difference)", steps: [QUAY, CROWD(0, 9)] },
  { id: "crowd-1000", why: "the wide quay with 1000 cards and ten full figures (headroom)", steps: [QUAY, CROWD(1000, 9)] },
  { id: "quay-brawl", why: "a night fight on the quay: Lamb and six wardens, two people looking on (nine figures)", steps: [BOOT, BRAWL(6, 2)] },
];
