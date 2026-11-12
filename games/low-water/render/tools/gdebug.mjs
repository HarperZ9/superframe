// Debug view of a dither G-buffer: R albedo (lit pixels), G light 0 visibility, B haze.
import { renderFlat } from "../pipe_flat.mjs";
import { rn } from "../rn.mjs";
const { isoCamera } = await import(rn("web/shaders/paintover/camera.mjs")), { writePng } = await import(rn("tools/shaders/png.mjs"));
const [scene, out, camJson] = process.argv.slice(2), W = 320, H = 180;
const cam = isoCamera(JSON.parse(camJson));
const g = await renderFlat({ sceneUrl: new URL(`../scenes/${scene}.mjs`, import.meta.url).href, camera: cam, w: W, h: H, kind: "dither" });
const o = new Uint8ClampedArray(W * H * 4); let hits = 0;
for (let i = 0; i < W * H; i++) { if (g.kind[i]) hits++; o[i * 4] = g.kind[i] === 2 ? g.albedo[i] * 255 : g.kind[i] === 1 ? 255 : 0; o[i * 4 + 1] = g.vis[i * 4] * 255; o[i * 4 + 2] = g.haze[i] * 255; o[i * 4 + 3] = 255; }
writePng(out, { width: W, height: H, data: o }); console.log("hits", hits, "of", W * H);
