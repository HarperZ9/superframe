// SPDX-License-Identifier: FSL-1.1-MIT
// PCB Room as a view of solvers/pcb. node packages/rooms/views/pcb-room/build.mjs [out.html]
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage, writePage } from "../build-view.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = "constants footprints netlist placement router plane copper drc formulas field-solve cg dc heat tline cut gerber reader schematic examples checks".split(" ");
export const pcbRoomPage = () =>
  buildPage({
    shell: "views/pcb-room/shell.html",
    core: ["units.js", "provenance.js", "constants.js", ...ENGINE.map((e) => `solvers/pcb/${e}.js`)],
    sealed: { "units.js": ["unit"], "provenance.js": ["constant"], "constants.js": ["CONSTANTS"] },
    blocks: [readdirSync(join(HERE, "src")).sort().map((f) => `views/pcb-room/src/${f}`)],
  });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(writePage(pcbRoomPage(), process.argv[2] || "out/rooms/pcb-room.html"));
