// The mole by day for the interlude: Mother a white tower with a green-and-gold head, Wenna on the
// bollard at the end of the mole (drawn by the game), Merrow's boat on the mud by the mole steps.
import { harbour } from "../worlds/harbour.mjs";
import { surf, sky, ripple, footing, paintId } from "./_common.mjs";
import M from "./mole.mjs";
import QD from "./quay_day.mjs";
const H = harbour({ set: "day" });
export default { name: "mole_day", world: H.world, lights: H.lights, surf, sky, ripple, paintId, camera: M.camera, paint: M.paint, variants: { day: QD.variants.day }, walk: M.walk, footing: footing(), marks: H.marks, notes: "Daylight mole for the interlude." };
