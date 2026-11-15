// The Quota, as the Studio's game config: everything the Studio knows about this one game. Another game
// (games/lowwater.mjs) gives the same fields; the Studio's core reads only these.
import { castOf } from "../core/cast.mjs";

export default {
  name: "quota", title: "The Quota",
  async members() { const [a, b] = await Promise.all([import("../../../characters/cast/quota.mjs"), import("../../../characters/cast/quota2.mjs")]); return castOf(a, b); },
  timing: new URL("../../../characters/anim/timing.json", import.meta.url).href,
  // material ids by what a painter calls them (characters/rig/materials.mjs numbers)
  ids: { skin: [4, 29, 39, 60], eye: [15], white: [28], lip: [16], brow: [26], hair: [5], hat: [6, 51], collar: [3, 24, 17], coat: [57, 1, 58, 2, 53, 31, 20, 8, 45, 47, 55, 56, 41, 42, 43] },
  // the old head's construction (cast/parts.mjs head(), cast/quota.mjs make()): its radius, the eye's centre in radii
  head: { radius: (P) => 0.135 * (P.head / 0.26), eye: { x: 0.33, y: 0.12, z: 0.8 } },
  // the portrait: the paraffin rig (characters/proto/portrait_light.mjs, restated: that module reaches Node-only I/O),
  // the camera and key defaults, the eye line, the export size (the rendering lead's box)
  portrait: {
    rig: { amb: [0.13, 0.12, 0.13], ground: [0.05, 0.04, 0.035], key: { dir: [-0.6, 0.3, 0.74], c: [1.25, 0.9, 0.58], wrap: 0.3 }, fill: { dir: [0.75, 0.15, 0.3], c: [0.15, 0.16, 0.19], wrap: 0.5 }, fresnel: { c: [0.16, 0.12, 0.09], pow: 3 } },
    cam: { yaw: 34, elev: 4, height: 0.7, turn: -32 }, key: { az: 80, el: 25 }, eyeLine: 0.4, out: [640, 800],
  },
  export: { root: "characters/portraits-painted", defaultEra: 2 },
  // the peoples of the Quota's world (design/quota/01-WORLD.md), leaned toward by a small share, never set
  peoples: {
    share: 0.18,
    Tarn: { light: [0.93, 0.72, 0.58], shadow: [0.38, 0.24, 0.21], hair: [0.34, 0.24, 0.16], note: "the plain: ruddy and weathered, warm in the shadow" },
    Hesh: { light: [0.86, 0.71, 0.52], shadow: [0.29, 0.25, 0.22], hair: [0.1, 0.08, 0.07], note: "the hills: an olive light, cooler shadows, black hair" },
    Vell: { light: [0.8, 0.6, 0.45], shadow: [0.26, 0.18, 0.17], hair: [0.12, 0.09, 0.08], note: "the Vellmark: a shade darker (the world bible's own words)" },
  },
};
