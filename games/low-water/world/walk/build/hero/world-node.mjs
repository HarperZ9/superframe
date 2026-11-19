// The generated world in node: data.mjs's loadWorld reads it over fetch, so this answers fetch
// from the output folder on disk. Only the hero emitter uses it; the browser never loads this file.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadWorld } from "../../data.mjs";

export async function loadWorldNode(dir) {
  const fetchFile = async (url) => {
    const p = join(dir, url.replace(/^disk:\/*/, ""));
    try {
      const b = await readFile(p);
      return { ok: true, json: async () => JSON.parse(b.toString("utf8")), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    } catch { return { ok: false, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0) }; }
  };
  const before = globalThis.fetch;
  globalThis.fetch = fetchFile;
  try { return await loadWorld("disk:"); } finally { globalThis.fetch = before; }
}
