// The Studio's sitter: one cast member at one age and era, posed head and shoulders, lit by a key the
// painter can move, with a mood from the rendering lead's MOODS and exprFor (game/engine/paint/portrait/
// moods.mjs, through the voice bible's portraitCue). Returns the G-buffer, the albedo and the face frame
// the portrait painter takes (paintPortrait's contract, design/state/painted.md), and the reference
// passes a person paints from: lit colour, value only, and line/edge.
// Kept apart from the rendering lead's sit() only for the sitter's turn: theirs ties the sitter's facing to
// the camera's yaw (facing = yaw - 32, three-quarters left); the talk panel wants three-quarters right
// without mirroring, so this one turns the sitter. The face frame is built the way sit() builds it.
// Runs in Node and in the browser (timing is passed in).
//   sit({ members, who, timing, mood, w, h, cam, key }) -> { G, A, face, colour, value, edges, anchors, meta }
import { createCast } from "../../../characters/runtime/actor.mjs";
import { gbuffer } from "../../../characters/render/figure.mjs";
import { albedo, light, compose } from "../../../characters/render/shade.mjs";
import { setExpression, EXPRESSIONS } from "../../../characters/cast/parts.mjs";
import { hasHead } from "../../../characters/forge/heads.mjs";
import { INDEX } from "../../../characters/rig/skeleton.mjs";
import { bind } from "../../../characters/rig/body.mjs";
import { portraitCue } from "../../../game/engine/dialogue/direction.mjs";
import { MOODS, exprFor as painterExpr } from "../../../game/engine/paint/portrait/moods.mjs";
import { edgePass, valuePass } from "./passes.mjs";
import { eyeAnchors } from "./anchors.mjs";
import { game } from "./game.mjs";
import quota from "../games/quota.mjs";

export { MOODS };
// The portrait defaults (camera, key, eye line, light rig) come from the game's config (games/<name>.mjs
// portrait). yaw turns the camera and the sitter together (the key stays put in the world, so it moves
// with yaw); turn is the sitter's own angle to the camera: positive faces the viewer's left, negative the
// right (the talk panel wants three-quarters right). The key sits 46 degrees round from the camera toward
// the side the sitter faces, a little high (short light): a key on the camera's axis lights a face flat.
// CAM, KEY, EYE_LINE and PARAFFIN are The Quota's values, kept for the panels and tests; sit() reads the
// current game's.
export const CAM = quota.portrait.cam, KEY = quota.portrait.key, EYE_LINE = quota.portrait.eyeLine, PARAFFIN = quota.portrait.rig;
const P = () => game().portrait;

export function exprFor(mood, sculpted = false) {
  const dir = MOODS[mood]; if (!dir) throw new Error(`studio: no mood "${mood}"`);
  return painterExpr(portraitCue, EXPRESSIONS, dir, sculpted);
}
export function keyDir({ az, el }) {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}
const rigFor = (key) => ({ ...P().rig, key: { ...P().rig.key, dir: keyDir(key) } });

function render(C, who, timing, cam, w, h, rig, dy = 0) {
  const Cx = { ...C }, facing = cam.yaw - (cam.turn ?? 32);
  const a = createCast({ timing, members: { [who]: Cx } }).actor(who, { facing });
  a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1];
  const view = { yawDeg: cam.yaw, elevDeg: cam.elev, height: cam.height, centre: [0, hy + dy, 0] };
  const { G, V } = gbuffer([{ C: Cx, pose, facing, tool: "none" }], view, w, h, 1, rig);
  return { G, V, facing };
}
// the face frame as sit() makes it: the head's centre and radius in bind space, the eye row, its size on
// canvas, and which way it turns on screen
function faceOf(C, V, facing, w, h, cam) {
  const headLen = C.P.head || 0.25, hp = bind(C.P)[INDEX.head].p, ppm = h / cam.height, fw = [Math.sin((facing * Math.PI) / 180), 0, Math.cos((facing * Math.PI) / 180)];
  return { c: [hp[0], hp[1] + headLen * 0.45, hp[2]], R: headLen * 0.5, eyeRow: Math.round(P().eyeLine * h), headPx: headLen * ppm, turn: Math.sign(fw[0] * V.right[0] + fw[2] * V.right[2]) || -1 };
}

// a fingerprint of the reference (materials and rest-pose points, to a millimetre): if the cast's code
// changes the sitter, a saved painting's rebuild says so instead of looking like drift
export function refHash(G) {
  let h = 2166136261 >>> 0; const mix = (v) => { h ^= v & 255; h = Math.imul(h, 16777619) >>> 0; h ^= (v >>> 8) & 255; h = Math.imul(h, 16777619) >>> 0; };
  for (let i = 0; i < G.w * G.h; i++) { mix(G.id[i]); if (G.id[i]) for (let k = 0; k < 3; k++) mix(Math.round(G.loc[i * 3 + k] * 1000)); }
  return h.toString(16);
}
export function sit({ members, who, timing, mood = "neutral", w = 768, h = 960, cam = P().cam, key = P().key, dy: fixedDy = null }) {
  const C = members[who]; if (!C) throw new Error(`studio: no cast member "${who}"`);
  const rig = rigFor(key), sculpted = hasHead(who), ex = exprFor(mood, sculpted);
  setExpression(ex);
  try {
    // frame: a small probe render finds the eyes, then the full render puts them on the eye line (a mood
    // passes its base's dy, so the two pictures register)
    let dy = fixedDy;
    if (dy == null) {
      const pw = Math.round(w / 4), ph = Math.round(h / 4), probe = render(C, who, timing, cam, pw, ph, null);
      const e = eyeAnchors(C, probe.G), ey = e.length ? e.reduce((s, q) => s + q.cy, 0) / e.length : ph * P().eyeLine;
      dy = -((ey - ph * P().eyeLine) / ph) * cam.height;
    }
    const { G, V, facing } = render(C, who, timing, cam, w, h, rig, dy);
    const pal = C.palette || {}, A = albedo(G, pal), E = light(G, rig, pal), colour = compose(G, A, E, null, { bands: 0 });
    return { G, A, face: faceOf(C, V, facing, w, h, cam), cue: ex.cue, colour, value: valuePass(colour, G.w, G.h), edges: edgePass(G), anchors: eyeAnchors(C, G),
      meta: { who, mood, w, h, dy, cam: { ...cam }, key: { ...key }, keyDir: keyDir(key), keyColour: P().rig.key.c, age: C.info?.quota?.age ?? null, stature: C.P.h, heads: sculpted ? "sculpted" : "old", refHash: refHash(G) } };
  } finally { setExpression(null); }
}
