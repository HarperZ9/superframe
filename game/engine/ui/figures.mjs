// One drawer for every figure on a plate (author, 2026-10-17: one look for walking, talking and
// fighting). Two hooks take the same kind of function:
//   setFigureDrawer(fn)   fighters in an in-world fight (ui/fightlayer.mjs)
//     fn(g, F, { x, y, ppm, face, down, W, at, cam, plate, depth, depthAt, lights, darkness })
//   setPersonDrawer(fn)   Lamb and the people in the scene outside fights (ui/peoplelayer.mjs)
//     fn(g, person, { x, y, ppm, at, face, walking, running, talking, gesture, cam, plate, depth,
//                     depthAt, lights, darkness })
// (x, y) are the feet on screen, ppm the screen pixels of one vertical metre there, at the world
// point, face radians (atan2 of the heading's z and x, combat's convention), cam the plate's bake
// camera (place.json camera), plate its name, depth the figure's distance along the camera's
// forward axis, depthAt(sx, sy) the painted room's depth under a screen pixel (a figure pixel
// whose depth is more than about 0.35 m past it is behind the room), lights the plate's lights
// for the variant shown (place.json lights), darkness 0..1 how far the plate has gone to its
// blackout (dark) plate. The defaults draw plain ink figures.
// installCharacterFigures() puts the character pipeline's drawer (characters/runtime/
// fightdrawer.mjs) behind both hooks: one drawer per plate camera, one actor per figure, a
// person driven by a walk, run, idle or talk pose and a fighter by combat's pose (combat/anim/
// drive.mjs), so Lamb keeps the same actor from walking into a fight and out again.
let fightFn = null, personFn = null;
export const setFigureDrawer = (fn) => { fightFn = fn; };
export const setPersonDrawer = (fn) => { personFn = fn; };
export const figureDrawer = () => fightFn || plainFighter;
export const personDrawer = () => personFn || plainPerson;

// Whether a point (sx, sy) at depth d is behind the painted room.
export const hiddenAt = (args, sx, sy, d = args.depth) => !!args.depthAt && args.depthAt(sx, sy) < d - 0.35;

// The placeholder figure: ink, no outline or tint on Lamb (LOOK-UNIFIED R4); Lamb is told apart by
// a slightly fuller ink and the facing mark. Behind the room (head and feet both hidden) it is
// drawn faint, so it is never lost.
function inkFigure(g, lamb, { x, y, ppm, face, down }, faint) {
  const hgt = (down ? 0.45 : 1.75) * ppm, wid = 0.5 * ppm;
  g.save(); if (faint) g.globalAlpha = 0.25;
  g.lineWidth = Math.max(1, ppm * 0.03); g.strokeStyle = "rgba(233,227,212,0.85)";
  g.beginPath(); g.ellipse(x, y, wid * 0.7, wid * 0.22, 0, 0, Math.PI * 2); g.fillStyle = "rgba(10,6,12,0.35)"; g.fill();
  g.fillStyle = lamb ? "rgba(29,20,24,0.96)" : "rgba(29,20,24,0.82)";
  g.beginPath(); g.ellipse(x, y - hgt / 2, wid / 2, hgt / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(x, y - hgt - wid * 0.35, wid * 0.32, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x, y - hgt * 0.6); g.lineTo(x + Math.cos(face || 0) * wid, y - hgt * 0.6 - Math.sin(face || 0) * wid * 0.5); g.stroke();
  g.restore();
}
const faintOf = (a) => hiddenAt(a, a.x, a.y - 0.1 * a.ppm) && hiddenAt(a, a.x, a.y - 1.6 * a.ppm);
export function plainFighter(g, F, a) { inkFigure(g, F.team === "lamb", a, faintOf(a)); }
export function plainPerson(g, p, a) { inkFigure(g, p.who === "lamb", a, faintOf(a)); }

// The character pipeline behind both hooks. Resolves to true when installed, false when the
// pipeline is not served (the plain figures stay).
export async function installCharacterFigures({ base = "/characters/" } = {}) {
  let makeFightDrawer, drive;
  try { [{ makeFightDrawer }, drive] = await Promise.all([import(`${base}runtime/fightdrawer.mjs`), import("../combat/anim/drive.mjs")]); }
  catch (e) { console.warn(`figures: character pipeline not loaded (${e.message}); plain figures`); return false; }
  const poseOf = (W, F, clips) => (F.person ? F.pose : drive.poseOf(W, F, clips));
  const actorOf = (W, F) => (F.person ? F.who : drive.actorOf(W, F));
  const drawers = new Map();
  const drawerFor = (cam) => {
    const key = `${cam.yawDeg}|${cam.elevDeg}`;
    if (!drawers.has(key)) {
      const d = { fn: null };
      drawers.set(key, d);
      makeFightDrawer({ poseOf, actorOf, camera: { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg } }).then((fn) => { d.fn = fn; }).catch((e) => { console.warn(`figures: drawer for camera ${key} failed: ${e.message}`); d.fn = false; });
    }
    return drawers.get(key).fn;
  };
  const ONE = { defs: {}, moves: {} };
  setFigureDrawer((g, F, a) => { const fn = a.cam && drawerFor(a.cam); return fn ? fn(g, F, a) : plainFighter(g, F, a); });
  setPersonDrawer((g, p, a) => {
    const fn = a.cam && drawerFor(a.cam); if (!fn) return plainPerson(g, p, a);
    const anim = a.gesture ? a.gesture.anim : a.walking ? (a.running ? "run" : "walk") : "idle";
    const pose = a.gesture ? { anim, t: a.gesture.t } : { anim, loop: true };
    const F = { id: p.who, who: p.who, person: true, team: p.who === "lamb" ? "lamb" : "town", x: a.at[0], z: a.at[2], face: a.face, pose };
    return fn(g, F, { ...a, W: ONE, down: false });
  });
  return true;
}
