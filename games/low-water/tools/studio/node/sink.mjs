// The Node sink for the Studio's writers (export.mjs, store.mjs): files under the repo root.
//   nodeSink(root) -> { image(path, w, h, rgba8), json(path, obj), text(path, s), readJson, readText, readImage }
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writePng, readPng } from "../../../characters/render/io.mjs";

export function nodeSink(root) {
  const at = (p) => { const f = join(root, p); mkdirSync(dirname(f), { recursive: true }); return f; };
  return {
    written: [],
    async image(p, w, h, data) { writePng(at(p), { width: w, height: h, data }); this.written.push(p); },
    async json(p, obj) { writeFileSync(at(p), JSON.stringify(obj, null, 1) + "\n"); this.written.push(p); },
    async text(p, str) { writeFileSync(at(p), str); this.written.push(p); },
    async readText(p) { return readFileSync(join(root, p), "utf8"); },
    async readJson(p) { return JSON.parse(readFileSync(join(root, p), "utf8")); },
    async readImage(p) { const r = readPng(join(root, p)); return { width: r.width, height: r.height, data: r.data }; },
  };
}
