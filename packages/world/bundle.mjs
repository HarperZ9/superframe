// SPDX-License-Identifier: FSL-1.1-MIT
// bundle.mjs: the field as one ES module for a page, dist/world-field.mjs. The site carries this file unchanged.
//
//   node packages/world/bundle.mjs            write dist/world-field.mjs
//   node packages/world/bundle.mjs --check    exit 1 when the file differs from a fresh build
//
// Each source becomes classic code by the rooms view builder's own rule (rooms/views/build-view.mjs, classic():
// import lines dropped, export keywords dropped), inside a function scope that hands out only the names other files
// import from it, so no helper of one core can meet a helper of another. The field's own files hand out what they
// export, and the bundle exports those. The cores are the packages' files as they stand: nothing is copied by hand.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { classic } from "../rooms/views/build-view.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = dirname(dirname(HERE)), OUT = join(HERE, "dist/world-field.mjs");
const OWN = ["field.mjs", "properties.mjs", "scene-read.mjs", "scene.mjs"].map((f) => join(HERE, f));
const IMPORT = /^import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)";/gm;
const EXPORTS = /^export\s+(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
const read = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const names = (list) => list.split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+as\s+/)[0].trim());

// Every file the field reaches, dependencies first, and for each the names the others import from it.
function graph() {
  const order = [], wanted = new Map(), seen = new Set();
  const visit = (f) => {
    if (seen.has(f)) return; seen.add(f);
    for (const m of read(f).matchAll(IMPORT)) {
      const dep = join(dirname(f), m[2]);
      const set = wanted.get(dep) || wanted.set(dep, new Set()).get(dep);
      for (const n of names(m[1])) set.add(n);
      visit(dep);
    }
    order.push(f);
  };
  for (const f of OWN) visit(f);
  return { order, wanted };
}

export function build() {
  const { order, wanted } = graph(), handed = new Map(), parts = [], own = [];
  for (const f of order) {
    const isOwn = OWN.includes(f), src = read(f);
    const list = isOwn ? [...src.matchAll(EXPORTS)].map((m) => m[1]) : [...(wanted.get(f) || [])];
    for (const n of list) { if (handed.has(n) && handed.get(n) !== f) throw new Error(`bundle: ${n} is handed out by ${rel(handed.get(n))} and ${rel(f)}`); handed.set(n, f); }
    if (isOwn) own.push(...list);
    parts.push(`// ---- ${rel(f)} (sha256 ${sha(src)})\nconst { ${list.join(", ")} } = (() => {\n${classic(src)}\nreturn { ${list.join(", ")} };\n})();`);
  }
  const head = `// world-field.mjs: built by packages/world/bundle.mjs from the files named below, each with the sha256 of its source.\n// Do not edit: change the sources and build again. SPDX-License-Identifier: FSL-1.1-MIT\n`;
  return `${head}${parts.join("\n")}\nexport { ${own.join(", ")} };\n`;
}
const rel = (f) => relative(REPO, f).replace(/\\/g, "/");
const sha = (s) => createHash("sha256").update(s).digest("hex");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fresh = build();
  if (process.argv.includes("--check")) {
    let have = "";
    try { have = read(OUT); } catch { /* missing counts as stale */ }
    if (have !== fresh) { console.error("dist/world-field.mjs is stale: run node packages/world/bundle.mjs"); process.exit(1); }
    console.log(`world-field.mjs is current, sha256 ${sha(fresh)}`);
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, fresh);
    console.log(`wrote ${rel(OUT)}, ${fresh.length} bytes, sha256 ${sha(fresh)}`);
  }
}
