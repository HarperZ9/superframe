// SPDX-License-Identifier: FSL-1.1-MIT
// Map Room as a thin view of maps/. node packages/rooms/views/map-room/build.mjs [out.html]
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage, writePage } from "../build-view.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = dirname(dirname(HERE));
export const mapRoomPage = () =>
  buildPage({
    shell: "views/map-room/shell.html",
    tokens: { registry: readFileSync(join(ROOT, "maps/registry.json"), "utf8").replace(/<\//g, "<\\/") },
    core: ["../maps/map.js", "../maps/bond.js"],
    blocks: [readdirSync(join(HERE, "src")).sort().map((f) => `views/map-room/src/${f}`)],
  });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(writePage(mapRoomPage(), process.argv[2] || "out/rooms/map-room.html"));
