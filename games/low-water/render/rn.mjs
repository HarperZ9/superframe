// Where the raw-native engine modules come from: the Low Water worktree (feat/low-water-host, which
// serves the game), never the canonical checkout. Override with RN_ROOT (a directory holding web/ and tools/).
//   git -C C:/dev/public/raw-native archive -o rn.tar origin/main web tools docs/images project-docs
import { pathToFileURL } from "node:url";
const DEFAULT = "C:/dev/worktrees/raw-native-lowwater";
export const RN_ROOT = process.env.RN_ROOT || DEFAULT;
export const rn = (rel) => pathToFileURL(`${RN_ROOT}/${rel}`).href;
export const engine = async () => {
  const [cam, proj, painter, grade, keys, sodium, spectra, lens, lensParams, lensSettings, dl, dlLights, pl, plPal, kit, png] = await Promise.all([
    import(rn("web/shaders/paintover/camera.mjs")), import(rn("web/shaders/paintover/projector.mjs")), import(rn("web/shaders/paintover/painter.mjs")),
    import(rn("web/shaders/paintover/grade.mjs")), import(rn("web/look/keys.mjs")), import(rn("web/shaders/sodium/shade.mjs")),
    import(rn("web/shaders/sodium/spectra.mjs")), import(rn("web/shaders/lens/lens.mjs")), import(rn("web/shaders/lens/params.mjs")),
    import(rn("web/shaders/lens/settings.mjs")), import(rn("web/shaders/ditherlight/ditherlight.mjs")), import(rn("web/shaders/ditherlight/lights.mjs")),
    import(rn("web/shaders/palettelight/palettelight.mjs")), import(rn("web/shaders/palettelight/palette.mjs")), import(rn("web/shaders/lab/gpu-kit.mjs")),
    import(rn("tools/shaders/png.mjs")),
  ]);
  return { cam, proj, painter, grade, keys, sodium, spectra, lens, lensParams, lensSettings, dl, dlLights, pl, plPal, kit, png };
};
