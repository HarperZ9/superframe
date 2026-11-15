// The key from the scene a portrait is used in (the coordinator, 2026-10-21: a portrait at the Furrowe stove
// lit from the stove's side). The light lead's model answers drawerRig(at, cam) with the rig a figure at
// `at` would be drawn with (game/engine/light/adapters.mjs, on feat/light; needs the model running, as it
// is in the game). Its key direction is turned into the Studio's key angles relative to the way the sitter
// faces in that scene, so the light falls on the same side of the face as it would there.
//   sceneKey({ at, cam, facing }, adapters?) -> { az, el, colour, kind } | null   (az from the face; null: no model)
//   keyForSitter(k, cam) -> the Studio's key angles
const DEG = 180 / Math.PI;
export async function sceneKey({ at, cam = {}, facing = 0 }, adapters = null) {
  let A = adapters;
  if (!A) { try { A = await import("../../../game/engine/light/adapters.mjs"); } catch (e) { console.warn(`studio: no light model here (${e.message}); the portrait keeps its own key`); return null; } }
  const R = A.drawerRig(at, cam); if (!R || !R.rig?.key?.dir) return null;
  const [x, y, z] = R.rig.key.dir, n = Math.hypot(x, y, z) || 1;
  // measured from the face: the key's bearing in the scene less the way the sitter faces there
  return { az: +(((Math.atan2(x, z) * DEG - facing + 540) % 360) - 180).toFixed(1), el: +(Math.asin(y / n) * DEG).toFixed(1), colour: R.rig.key.c || null, kind: R.tone || "paraffin" };
}
// the Studio's key (a world bearing) for a key measured from the face, with the sitter posed by cam
// (it faces yaw - turn in the Studio's world)
export const keyForSitter = (k, cam) => ({ az: +(((k.az + cam.yaw - (cam.turn ?? 32) + 540) % 360) - 180).toFixed(1), el: k.el });
