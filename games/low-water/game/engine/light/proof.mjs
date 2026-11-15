// One proof scene's light, the same in node and in the browser: the plate's scene built (scene.mjs), its light
// as the plate was baked (the relight's denominator) and as it is now for the scene's clock, street state and
// time, with the moving lights added. The proof tools (tools/oilsheet.mjs, tools/harness.mjs) call this.
//   sceneLight({ pj, geo, read, hour, t }) -> { S, Ebake, Enow, gains, dyn, ratio, emit }
import { buildScene } from "./scene.mjs";
import { addLights } from "./field.mjs";
import { relightRatio, paneEmit } from "./consume.mjs";

export function sceneLight({ pj, geo, read, hour, t = 0, terms = null }) {
  const v = pj.variants[0], S = buildScene({ pj, geo, variant: v, read, terms });
  const Ebake = S.compose({ hour: pj.variantInfo[v].hour, asBaked: true, out: new Float32Array(S.F.n * 3) }).slice();
  S.M.setHour(hour); const gains = S.M.gains(t), Enow = S.compose({ hour, t, gains }).slice();
  const dyn = S.M.dynamic(t); if (dyn.length) addLights(S.F, dyn, Enow, { step: 2 });
  return { S, Ebake, Enow, gains, dyn, ratio: relightRatio(S.F, Enow, Ebake, { owners: S.owners, gains }), emit: paneEmit(S.F, S.owners, S.M.lights, gains) };
}
