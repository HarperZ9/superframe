// SPDX-License-Identifier: FSL-1.1-MIT
// Lens Room as a view of core. node packages/rooms/views/lens-room/build.mjs [out.html]; default out/rooms/lens-room.html
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage, writePage } from "../build-view.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CORE = [
  "units.js",
  "provenance.js",
  "constants.js",
  "shapes.js",
  "formula.js",
  "scenes.js",
  "shaders/common.js",
  "scatter.js",
  "inner.js",
  "shaders/lens.js",
  "shaders/train.js",
  "shaders/world.js",
  "shaders/display.js",
  "train.js",
  "fields.js",
  "matrix.js",
  "materials.js",
  "liquid.js",
  "frames.js",
  "wave.js",
  "data/cie.js",
  "spectra.js",
];
// The page's own script boundaries stay, so an error in one block leaves the next to run, as before.
const BOUNDARIES = [1, 8, 20, 25, 33, 43];
export function lensRoomPage() {
  const files = readdirSync(join(HERE, "src")).sort();
  const blocks = BOUNDARIES.map((end, i) => files.slice(i ? BOUNDARIES[i - 1] : 0, end).map((f) => `views/lens-room/src/${f}`));
  return buildPage({
    shell: "views/lens-room/shell.html",
    core: CORE,
    sealed: {
      "units.js": ["unit"],
      "provenance.js": ["constant"],
      "constants.js": ["CONSTANTS", "MATERIAL_RECORDS"],
    },
    blocks,
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(writePage(lensRoomPage(), process.argv[2] || "out/rooms/lens-room.html"));
}
