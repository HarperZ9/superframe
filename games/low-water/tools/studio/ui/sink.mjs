// The browser sink for the Studio's writers: PNGs encoded by the browser's canvas and posted to the
// Studio server (tools/studio/serve.mjs), which writes them under the repo. Reads are plain fetches.
// A canvas stores colour premultiplied, so a layer pixel with partial alpha reads back within a few
// levels of what was written; the strokes are the exact record, the layer PNG is a cache of them.
//   browserSink() -> { image, json, text, readJson, readText, readImage, written }
async function post(path, body, type) {
  const r = await fetch(`/studio/write?path=${encodeURIComponent(path)}`, { method: "POST", headers: { "Content-Type": type }, body });
  if (!r.ok) throw new Error(`studio: could not write ${path}: ${r.status} ${await r.text()}`);
}
function pngBlob(w, h, data) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("studio: PNG encode failed"))), "image/png"));
}
export function browserSink() {
  return {
    written: [],
    async image(path, w, h, data) { await post(path, await pngBlob(w, h, data), "image/png"); this.written.push(path); },
    async json(path, obj) { await post(path, JSON.stringify(obj, null, 1) + "\n", "application/json"); this.written.push(path); },
    async text(path, str) { await post(path, str, "text/plain"); this.written.push(path); },
    async readText(path) { const r = await fetch(`/${path}`); if (!r.ok) throw new Error(`studio: no ${path} (${r.status})`); return r.text(); },
    async readJson(path) { const r = await fetch(`/${path}`); if (!r.ok) throw new Error(`studio: no ${path} (${r.status})`); return r.json(); },
    async readImage(path) {
      const r = await fetch(`/${path}`); if (!r.ok) throw new Error(`studio: no ${path} (${r.status})`);
      const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; const g = c.getContext("2d"); g.drawImage(bmp, 0, 0);
      return { width: bmp.width, height: bmp.height, data: g.getImageData(0, 0, bmp.width, bmp.height).data };
    },
  };
}
