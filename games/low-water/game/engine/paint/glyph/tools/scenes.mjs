// The Quota slice's proof scenes, as page code for play.html?content=quota: each boots the slice, enters an
// area (its plate from content/ or the preview fallback), sets the clock and the camera, and optionally opens
// a conversation or starts the granary-door fight. Used by pairs.mjs (painted and glyph at one framing) and
// switch.mjs (the style switch mid-scene). Original code.
//   SCENES[id] = { area, at, clock, camera, steps: [page code ...] }
const ENTER = (area, at, clock, camera) => `(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
  const A = c.G.content.map.areas, a = A['${area}']; if (!a) return 'no area ${area}';
  c.G.setPlace(a.place); c.G.state.pos = ${JSON.stringify(at)}; { const d = (((${clock} - c.G.clock()) % 1440) + 1440) % 1440; if (d > 0) c.G.env.advance(d); } ${camera ? `c.G.state.camera = { ...(c.G.state.camera || {}), mode: ${camera} };` : ""}
  for (const f of a.figures || []) f.wander = 0;
  c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
  for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((q) => setTimeout(q, 100));
  if (c.G.loop) c.G.loop.paused = true; return 'ok ' + a.plate; })()`;
// the painted talk panel reads the Low Water portrait index; the slice's faces are in portraits-quota
const QUOTA_FACES = `(async () => { const m = await import('/engine/ui/portrait.mjs'); await m.loadIndex('/characters/portraits-quota/index.json'); return true; })()`;
const TALK = (who, node, lines = 1) => `(async () => { const p = window.__lw.play; p.people.talkingWith('${who}'); p.startTalk('${node}'); for (let i = 0; i < ${lines}; i++) { await new Promise((q) => setTimeout(q, 300)); try { p.next && p.next(); } catch {} } await new Promise((q) => setTimeout(q, 1500)); return p.P.beat ? p.P.beat.id || true : false; })()`;
const FIGHT = `(async () => { const c = window.__lw, p = c.play; c.G.loop.paused = true; p.startTalk('q.granary.choice'); const i = p.P.beat.options.findIndex((o) => /back to the bar/.test(o.label)); if (i < 0) return 'no fight option'; p.choose(i);
  for (let k = 0; k < 120; k++) c.G.loop.step(); await new Promise((q) => setTimeout(q, 1500)); return !!document.querySelector('canvas.fightcanvas'); })()`;

// a crowd on the square for the glyph crowd tier (the painted tier's cards need its baked atlas, not in this checkout):
// people in a ring round Lamb, some walking, every third one Hesh; items() empty, so only glyph draws them
const CROWD = `(() => { const people = []; for (let i = 0; i < 60; i++) { const a = i * 2.39996, r = 1.6 + (i % 12) * 0.7; people.push({ at: [Math.cos(a) * r, 0, Math.sin(a) * r], face: a + 1.6, walk: i % 4 === 0 ? 1 : 0, u: (i * 0.37) % 1, people: i % 3 === 0 ? 'hesh' : 'tarn', card: i % 7 === 0 ? 'loaf' : undefined }); }
  window.__lw.play.people.crowd({ people, items: () => [], step() {} }); return people.length; })()`;
// Lamb walks a loop, leaving prints in the snow (the loop runs for the walk, then is paused again)
const WALK_LOOP = `(async () => { const c = window.__lw, p = c.play; if (c.G.loop) c.G.loop.paused = false; for (const t of [[2.5, 0, 1.5], [3.5, 0, -1], [0.5, 0, -2], [-1.5, 0, 0.5]]) { p.people.walkTo(t, () => {}); for (let i = 0; i < 60 && p.people.walking(); i++) await new Promise((q) => setTimeout(q, 100)); } if (c.G.loop) c.G.loop.paused = true; return true; })()`;
export const SCENES = {
  "square-dawn": { why: "the wide lens: Exchange Square from the bell tower at 07:50, day 41", steps: [ENTER("q.tower", [0, 0, 0], 470, 1.0)] },
  "square-night": { why: "the wide lens at 22:00: no street lamp burns in era 2; the light model's night", steps: [ENTER("q.tower", [0, 0, 0], 1320, 1.6), WALK_LOOP, "(async () => { for (let i = 0; i < 60 && !(globalThis.__lwLightModel && globalThis.__lwLightModel.ready()); i++) await new Promise((q) => setTimeout(q, 250)); return !!(globalThis.__lwLightModel && globalThis.__lwLightModel.ready()); })()"] },
  "square-crowd": { why: "the wide lens with a crowd: the glyph crowd tier, near people as material cards", glyphOnly: true, steps: [ENTER("q.tower", [0, 0, 0], 470, 2.2), CROWD] },
  "kitchen-night": { why: "the narrow lens: the Bracks' kitchen in the evening, the family at the table", steps: [ENTER("q.brack_kitchen", [0, 0, 1.2], 1170, 1.0)] },
  "granary-fight": { why: "the granary door at night: the Requisition Captain's fight", steps: [ENTER("q.granary", [0, 0, 1.5], 1290, 1.0), FIGHT] },
  "dialogue": { why: "the Furrowe table: Mary speaks, her portrait in the talk panel", steps: [QUOTA_FACES, ENTER("q.furrowe_kitchen", [0, 0, 1.2], 1140, 1.0), TALK("mary", "q.furrowe", 1)] },
  "readback": { why: "the read-back at the end of the day: a typed document", steps: [ENTER("q.furrowe_kitchen", [0, 0, 1.2], 1380, 1.0), TALK("mary", "q.readback", 1)] },
};
