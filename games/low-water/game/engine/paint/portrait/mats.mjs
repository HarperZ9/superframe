// Material ids the portrait painter treats apart (characters/rig/materials.mjs ids, read once by number so the
// painter stays free of the rig's imports): the face for the finest layer, the eye for the catch-light.
export const MATS_PORTRAIT = {
  face: new Set([4, 15, 16, 26, 28, 29, 39, 5]),   // skin, eye, lip, brow, white, cheek, jawcool, hair
  eye: new Set([15]),
};
