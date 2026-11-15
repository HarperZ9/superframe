// The portrait lights, shared by the portrait bake, the previews and the test stimuli.
// Paraffin (2026-10-21, the author's reference mood for the rebakes: a painterly study built from big
// flat value planes, warm light on cool grey): a warm lamp key, the shadow side cooled toward grey by
// the ambient and the fill, so the planes the sculptor makes read as value steps. Sodium as before.
// Second pass, same day: the first was too dark (faces grey, sockets black); key and ambient raised
// toward the old portraits' level, the shadow side still cool.
import { sodiumTone } from "../render/painted.mjs";

export const PORTRAIT_RIG = {
  paraffin: { tone: null, rig: { amb: [0.13, 0.12, 0.13], ground: [0.05, 0.04, 0.035], key: { dir: [-0.6, 0.3, 0.74], c: [1.25, 0.9, 0.58], wrap: 0.3 }, fill: { dir: [0.75, 0.15, 0.3], c: [0.15, 0.16, 0.19], wrap: 0.5 }, fresnel: { c: [0.16, 0.12, 0.09], pow: 3 } } },
  sodium: { tone: sodiumTone, rig: { amb: [0.12, 0.1, 0.16], ground: [0.05, 0.04, 0.06], key: { dir: [-0.45, 0.35, 0.8], c: [1.4, 0.9, 0.4], wrap: 0.3 }, fresnel: { c: [0.3, 0.18, 0.08], pow: 3 } } },
};
