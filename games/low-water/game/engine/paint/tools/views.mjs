// Views for the painter's stills: the same places walking, talking and fighting (one look in every
// mode), on dark plates where figure readability is hardest. Page code, run after play.html?capture=1.
const BOOT = (place, hour = null) => `(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('${place}'); ${hour != null ? `c.G.advance(${hour});` : ""} for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) f.wander = 0; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
const WALK = (x, z) => `(async () => { const p = window.__lw.play; p.people.walkTo([${x}, 0, ${z}], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;
// keep walking (the still is taken mid-stride)
const STROLL = (x, z) => `(() => { const p = window.__lw.play; p.people.walkTo([${x}, 0, ${z}], () => {}); return true; })()`;
const FIG = (list) => `(() => { const a = window.__lw.G.world.area(); for (const [id, x, z] of ${JSON.stringify(list)}) { const f = a.figures.find((f) => f.id === id); if (f) { f.at = [x, 0, z]; f.cond = null; f.wander = 0; } else a.figures.push({ id, at: [x, 0, z], face: 1, wander: 0, cond: null }); } return true; })()`;
const TALK = (who, node) => `(async () => { const p = window.__lw.play; p.people.talkingWith('${who}'); p.startTalk('${node}'); await new Promise((r) => setTimeout(r, 1500)); return true; })()`;
const FIGHT = `(async () => { const c = window.__lw, p = c.play; c.G.loop.paused = true; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); for (let k = 0; k < 90; k++) c.G.loop.step(); await new Promise((r) => setTimeout(r, 1200)); return !!document.querySelector('canvas.fightcanvas'); })()`;

// a new plate before the area wiring has it (design/PLACES-NEW.md): an area made on the spot from the plate's
// own place.json, Lamb at a spot, the scene's people placed by hand
export const PLATE = (plate, place, spawn, figs = []) => `(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
  const A = c.G.content.map.areas, base = Object.values(A)[0]; A['t.${plate}'] = { ...base, id: 't.${plate}', name: '${plate}', plate: '${plate}', variant: null, place: '${place}', places: [], spawn: ${JSON.stringify(spawn)}, hotspots: [], figures: ${JSON.stringify(figs)}.map(([id, x, y, z]) => ({ id, at: [x, y, z], face: 1, wander: 0, cond: null })) };
  for (const k of Object.keys(A)) if (k !== 't.${plate}' && (A[k].place === '${place}' || (A[k].places || []).includes('${place}'))) delete A[k];
  c.G.setPlace('${place}'); c.G.state.pos = ${JSON.stringify(spawn)}; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
  for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`;

export const VIEWS = [
  { id: "quay-walk", why: "walking on the quay under sodium", steps: [BOOT("quay"), FIG([["fewell", 1.2, -1.8], ["strand", 2.0, -2.4]]), WALK(0.4, -1.4), STROLL(2.6, -0.6)], settle: 1200 },
  { id: "quay-talk", why: "the same people talking", steps: [BOOT("quay"), FIG([["fewell", 1.2, -1.8], ["strand", 2.0, -2.4]]), WALK(0.4, -1.4), TALK("fewell", "quay.lamplighters.stop")] },
  { id: "quay-fight", why: "the same people fighting", steps: [BOOT("quay"), WALK(3.3, -2.3), FIG([["fewell", 4.0, -2.4], ["strand", 2.7, -2.7]]), FIGHT] },
  { id: "quay-rain", why: "the quay in the 01:30 rain: wet stone mirrors the lamps and the people", steps: [BOOT("quay", 190), FIG([["fewell", 1.2, -1.8], ["strand", 2.0, -2.4]]), WALK(0.4, -1.4)] },
  { id: "floor-dark", why: "the floor at low water: the darkest plate", steps: [BOOT("floor"), WALK(0.5, 0.5)] },
  { id: "brine-bar", why: "paraffin interior: colour comes back", steps: [BOOT("brine"), WALK(0.2, -1.2)] },
  { id: "ferry-deck", why: "the ferry's after deck, the assessor by the rail, Penhallow at the wheelhouse", steps: [PLATE("ferry", "ferry", [1.3, 0, -1.0], [["penhallow", 0.4, 0, 2.6]])] },
  { id: "hall-vote", why: "the Guild hall: Marrow at the head, Lamb by the bench", steps: [PLATE("hall", "hall", [1.6, 0, 1.6], [["marrow", -4.4, 0, 0.0], ["hobb", 2.4, 0, -1.6]])] },
  { id: "smoke-night", why: "the smokehouse: Shadwell by his sack, Marrow on the fish box, the pit glowing", steps: [PLATE("smokehouse", "smokehouse", [1.6, 0, 0.9], [["shadwell", -1.4, 0, 1.2], ["marrow", 0.9, 0, -0.5]])] },
  { id: "loft-night", why: "the net loft: Merrow on the coil, Lugg under the lowest beam", steps: [PLATE("loft", "loft", [0.6, 0, 0.6], [["merrow", 1.0, 0, -0.5], ["lugg", -1.0, 0, -0.9]])] },
  { id: "roof-night", why: "the weigh-house roof: Lamb by the drainpipe, Hobb at the beam", steps: [PLATE("roof", "roof", [2.2, 0, 1.2], [["hobb", -0.2, 0, 0.4]])] },
  { id: "weighoffice-night", why: "the weigh-house office: Lamb at the desk, Gorm in the doorway", steps: [PLATE("weighoffice", "weighoffice", [-0.2, 0, -0.3], [["gorm", -1.2, 0, 0.6]])] },
  { id: "crakehall-lit", why: "the Alderman's hall: Mrs Pellow at the door", steps: [PLATE("crakehall", "crake_hall", [0.2, 0, 0.9], [["pellow", -1.0, 0, -1.2]])] },
  { id: "crakestudy-lit", why: "the Alderman's study: the Alderman at her desk", steps: [PLATE("crakestudy", "crake_study", [-1.0, 0, 0.3], [["crake", 0.6, 0, -0.4]])] },
  { id: "substation-test", why: "the substation at 03:00: Fisk at the bench, a guard", steps: [PLATE("substation", "substation", [0.6, 0, 1.0], [["fisk", -1.2, 0, 0.5], ["hobb", 1.3, 0, -0.2]])] },
  { id: "vestry-candles", why: "Brother Ash's vestry", steps: [PLATE("vestry", "gas_vestry", [0.4, 0, 0.6], [["ash", -0.3, 0, -0.5]])] },
  { id: "telegraph-open", why: "the telegraph office: Rook behind the grille", steps: [PLATE("telegraph", "telegraph", [0.8, 0, 0.3], [["rook", -0.8, 0, 0.0]])] },
  { id: "gannet-night", why: "the Gannet front room: Pip by the stove", steps: [PLATE("gannet", "gannet_house", [0.3, 0, 0.9], [["pip", -0.6, 0, 0.3]])] },
  { id: "spit-lanterns", why: "the Spit at 23:30 (the gameplay lead's camouflage still)", steps: [PLATE("spit", "patience", [10, 0.2, 3.6], [["fewell", 14.5, -0.5, 4.5]])] },
  { id: "oldlight-strippers", why: "the Old Light's middle room, the strippers round the gear", steps: [PLATE("oldlight", "oldlight_mid", [0.8, 0, 1.4], [["sallis", -0.8, 0, 0.9], ["salvor", 0.9, 0, -1.1]])] },
];
