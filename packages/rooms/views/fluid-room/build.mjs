// SPDX-License-Identifier: FSL-1.1-MIT
// Fluid Room as a view of solvers/fluid. node packages/rooms/views/fluid-room/build.mjs [out.html]
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage, classic, writePage } from "../build-view.mjs";
import * as S from "../../solvers/fluid/shaders.js";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = dirname(dirname(HERE));
const src = (p) => classic(readFileSync(join(ROOT, p), "utf8"));
/** The 3D reference runs in a worker: the same module source as the CPU tests, with no import left. */
const worker3 = () => ["core/wave.js", "solvers/fluid/fftn.js", "solvers/fluid/spectral3.js", "solvers/fluid/tubes.js"].map(src).join("\n") + "\n" + readFileSync(join(HERE, "worker3.js"), "utf8");
export const fluidRoomPage = () =>
  buildPage({
    shell: "views/fluid-room/shell.html",
    tokens: { vs: S.FLUID_VS, fft: S.FLUID_FFT, prep: S.FLUID_PREP, viewp: S.FLUID_VIEW, nl: S.FLUID_NL, rhs: S.FLUID_RHS, upd: S.FLUID_UPDATE, stir: S.FLUID_STIR, dye: S.FLUID_DYE, show: S.FLUID_SHOW, vol: S.FLUID_VOLUME, worker3: worker3() },
    core: ["wave.js", "solvers/fluid/fftn.js", "solvers/fluid/spectral2.js", "solvers/fluid/bowl.js", "solvers/fluid/regime.js"],
    blocks: [readdirSync(join(HERE, "src")).sort().map((f) => `views/fluid-room/src/${f}`)],
  });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(writePage(fluidRoomPage(), process.argv[2] || "out/rooms/fluid-room.html"));
