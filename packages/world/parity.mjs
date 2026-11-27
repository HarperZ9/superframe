// SPDX-License-Identifier: MIT
// parity.mjs: every feature of every package the field touches, and whether each one is still there.
//
//   node packages/world/parity.mjs           check parity.json against the repository; exit 1 when a feature is gone
//   node packages/world/parity.mjs --write   take the snapshot again (only to add features; never to drop one)
//
// The field runs on these packages as they stand and changes none of them. A row is one feature: an export of an ES
// module, a member of a classic (UMD) module, a Python function or class, or a file (a page builder, a record, a
// schema). `field` names the property that reaches it from the field, or null where it stays reachable in its own
// package only. tests/parity.test.mjs fails when any row stops resolving, and on a planted row that never existed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = dirname(dirname(HERE)), FILE = join(HERE, "parity.json");
const require = createRequire(import.meta.url);

// Package, the files whose features are listed, and which property of the field reaches each named export.
const ESM = [
  ["rooms lens", "packages/rooms/core/trace.js", { rk4: "lens" }],
  ["rooms lens", "packages/rooms/core/fields.js", { FIELDS: "lens" }],
  ["rooms lens", "packages/rooms/core/constants.js", { MATERIAL_RECORDS: "lens" }],
  ["rooms lens", "packages/rooms/core/registry.js", {}],
  ["rooms lens", "packages/rooms/core/train.js", {}],
  ["rooms lens", "packages/rooms/core/wave.js", {}],
  ["rooms lens", "packages/rooms/core/spectra.js", {}],
  ["rooms lens", "packages/rooms/core/units.js", {}],
  ["rooms lens", "packages/rooms/core/provenance.js", {}],
  ["rooms fluid", "packages/rooms/solvers/fluid/index.js", {}],
  ["superframe medium", "superframe/lib/medium/grid.mjs", { advect: "flow", diffuse: "flow", project: "flow", confine: "flow" }],
  ["creation", "creation/lib/gen/advect.mjs", {}],
  ["rooms sound", "packages/rooms/solvers/sound/fdtd.js", { WaveField: "sound" }],
  ["rooms sound", "packages/rooms/solvers/sound/rooms.js", {}],
  ["rooms pcb", "packages/rooms/solvers/pcb/index.js", { hammerstad: "circuit", STACKS: "circuit" }],
  ["rooms map", "packages/rooms/maps/map.js", { statusFrom: "map", WORDS: "map" }],
  ["rooms map", "packages/rooms/maps/bond.js", {}],
  ["rooms properties", "packages/rooms/properties/model.js", { propertyObject: "all", instrument: "measure", plainLabel: "measure" }],
  ["rooms properties", "packages/rooms/properties/polarisation.js", {}],
  ["rooms properties", "packages/rooms/properties/impedance.js", {}],
];
const UMD = [["diagram cad", "packages/diagram/cad/load.js", "C", { hasTol: "shape" }]];
const PY = [["lenspipe", "packages/lenspipe/lenspipe"], ["instruments", "packages/instruments/room"]];
const FILES = [
  ["rooms lens", "packages/rooms/views/lens-room/build.mjs", null], ["rooms fluid", "packages/rooms/views/fluid-room/build.mjs", null],
  ["rooms map", "packages/rooms/views/map-room/build.mjs", null], ["rooms pcb", "packages/rooms/views/pcb-room/build.mjs", null],
  ["rooms sound", "packages/rooms/views/sound-room/build.mjs", null], ["rooms", "packages/rooms/views/build-view.mjs", "all"],
  ["rooms map", "packages/rooms/maps/registry.json", null], ["rooms lens", "packages/rooms/tests/golden/lens-page.json", null],
  ["instruments", "packages/instruments/schemas/instrument.schema.json", "measure"], ["instruments", "packages/instruments/schemas/receipt.schema.json", "measure"],
  ["instruments", "packages/instruments/records/room.json", null], ["instruments", "packages/instruments/records/jnt.json", null], ["instruments", "packages/instruments/records/polariscope.json", null],
  ["diagram cad", "packages/diagram/cad/src/blueprint.js", null], ["diagram cad", "packages/diagram/cad/src/kicad.js", null], ["diagram cad", "packages/diagram/cad/export.js", null],
  ["lenspipe", "packages/lenspipe/data/glass_catalog.json", null], ["shaders", "native/web/shaders/lens", null], ["shaders", "native/web/shaders/cascades", null], ["shaders", "native/web/shaders/cascades3d", null],
];

const read = (rel) => readFileSync(join(REPO, rel), "utf8");
const pyDefs = (dir) => {
  const out = [];
  for (const f of require("node:fs").readdirSync(join(REPO, dir)).filter((n) => n.endsWith(".py") && !n.startsWith("test_"))) {
    for (const m of read(`${dir}/${f}`).matchAll(/^(?:def|class)\s+([A-Za-z]\w*)/gm)) out.push([`${dir}/${f}`, m[1]]);
  }
  return out;
};

export async function snapshot() {
  const rows = [];
  for (const [pkg, file, reach] of ESM) for (const name of Object.keys(await import(pathToFileURL(join(REPO, file)).href)).sort()) rows.push({ package: pkg, file, kind: "export", name, field: reach[name] ?? null });
  for (const [pkg, file, key, reach] of UMD) for (const name of Object.keys(require(join(REPO, file))[key]).sort()) rows.push({ package: pkg, file, kind: "umd", key, name, field: reach[name] ?? null });
  for (const [pkg, dir] of PY) for (const [file, name] of pyDefs(dir)) rows.push({ package: pkg, file, kind: "py", name, field: null });
  for (const [pkg, file, field] of FILES) rows.push({ package: pkg, file, kind: "file", name: file.split("/").pop(), field });
  return rows;
}

// The rows that no longer resolve, each with the reason.
export async function missing(rows) {
  const out = [], mods = new Map();
  for (const r of rows) {
    if (!existsSync(join(REPO, r.file))) { out.push({ ...r, why: "the file is gone" }); continue; }
    if (r.kind === "export") {
      if (!mods.has(r.file)) mods.set(r.file, await import(pathToFileURL(join(REPO, r.file)).href));
      if (!(r.name in mods.get(r.file))) out.push({ ...r, why: "the export is gone" });
    } else if (r.kind === "umd") {
      if (!(r.name in require(join(REPO, r.file))[r.key])) out.push({ ...r, why: "the member is gone" });
    } else if (r.kind === "py") {
      if (!new RegExp(`^(?:def|class)\\s+${r.name}\\b`, "m").test(read(r.file))) out.push({ ...r, why: "the definition is gone" });
    }
  }
  return out;
}
export const load = () => JSON.parse(readFileSync(FILE, "utf8"));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--write")) {
    const before = existsSync(FILE) ? load().rows : [], rows = await snapshot();
    const dropped = before.filter((b) => !rows.some((r) => r.file === b.file && r.name === b.name));
    if (dropped.length) { console.error(`refused: the snapshot would drop ${dropped.length} features, first ${dropped[0].file} ${dropped[0].name}`); process.exit(1); }
    writeFileSync(FILE, JSON.stringify({ comment: "Every feature of every package the field touches. Written by node packages/world/parity.mjs --write; tests/parity.test.mjs fails when one stops resolving.", rows }, null, 1) + "\n");
    console.log(`parity.json: ${rows.length} features in ${new Set(rows.map((r) => r.package)).size} packages, ${rows.filter((r) => r.field).length} reached from the field`);
  } else {
    const gone = await missing(load().rows);
    for (const g of gone) console.error(`gone: ${g.package} ${g.file} ${g.name}: ${g.why}`);
    if (gone.length) process.exit(1);
    console.log(`parity: every listed feature resolves`);
  }
}
