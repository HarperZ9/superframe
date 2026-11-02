// SPDX-License-Identifier: FSL-1.1-MIT
// Sound Room as a view of solvers/sound. node packages/rooms/views/sound-room/build.mjs [out.html]
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage, writePage } from "../build-view.mjs";
import { VS_SHADER, STEP_SHADER, MIC_SHADER, SHOW_SHADER } from "../../solvers/sound/shaders.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const soundRoomPage = () =>
  buildPage({
    shell: "views/sound-room/shell.html",
    tokens: { vs: VS_SHADER, step: STEP_SHADER, mic: MIC_SHADER, show: SHOW_SHADER },
    core: ["units.js", "provenance.js", "constants.js", "solvers/sound/params.js", "solvers/sound/rooms.js"],
    sealed: { "units.js": ["unit"], "provenance.js": ["constant"], "constants.js": ["CONSTANTS"] },
    blocks: [readdirSync(join(HERE, "src")).sort().map((f) => `views/sound-room/src/${f}`)],
  });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(writePage(soundRoomPage(), process.argv[2] || "out/rooms/sound-room.html"));
