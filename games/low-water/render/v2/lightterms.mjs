// The light lead's stroke-light terms (game/engine/light, design/state/light.md) for a baked plate, at the plate's
// resolution, in the shape render/v2/strokelight.mjs reads: family (0 shadow .. 1 light, soft across the terminator),
// warm (-1 cool .. 1 warm, from the key's colour temperature), strength (the key's irradiance), and per pixel the
// ruling source's screen position when it is a lamp (so strokes radiate from it) or its screen direction when it
// is the sun, the moon or the sky. Node only (it reads the plate's files).
//   lightTerms({ dir, W, H, hour, state, pj }) -> { family, shade, warm, strength, srcX, srcY, dirX, dirY } | null
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export async function lightTerms({ dir, W, H, hour = null, state = "start", pj = null }) {
  // pj: the place.json the bake is about to write (render/bake2.mjs); without it, the one in dir
  if ((!pj && !existsSync(join(dir, "place.json"))) || !existsSync(join(dir, "geo-pos.f32"))) return null;
  const { sceneLight } = await import("../../game/engine/light/proof.mjs"), { stocksReader } = await import("../../game/engine/light/tools/stocks.mjs");
  pj ||= JSON.parse(readFileSync(join(dir, "place.json"), "utf8")); const b = readFileSync(join(dir, "geo-pos.f32"));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) };
  const L = sceneLight({ pj, geo, read: stocksReader(repo, state), hour: hour ?? pj.variantInfo[pj.variants[0]].hour }), F = L.S.F, M = L.S.M, R = F.rec;
  // the plate camera (orthographic): world to plate pixels
  const c = pj.camera, y = (c.yawDeg * Math.PI) / 180, e = (c.elevDeg * Math.PI) / 180, ppm = pj.pxPerMetre || c.ppm || H / 2 / c.scale;
  const fwd = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)], right = [Math.cos(y), 0, -Math.sin(y)], up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const toScr = (p) => { const r = [p[0] - c.target[0], p[1] - c.target[1], p[2] - c.target[2]]; return [W / 2 + (r[0] * right[0] + r[1] * right[1] + r[2] * right[2]) * ppm, H / 2 - (r[0] * up[0] + r[1] * up[1] + r[2] * up[2]) * ppm]; };
  const lamp = M.lights.map((l) => (l.at ? toScr(l.at) : null));
  const n = W * H, shade = new Float32Array(n), family = new Float32Array(n), warm = new Float32Array(n), strength = new Float32Array(n), srcX = new Float32Array(n).fill(NaN), srcY = new Float32Array(n).fill(NaN), dirX = new Float32Array(n), dirY = new Float32Array(n);
  // the key's strength relative to this plate's own strong key (its 95th percentile): a dawn sun and a candle both count
  const ks = Array.from(R.keyE).filter((v) => v > 0).sort((a, b) => a - b), k95 = Math.max(8, ks.length ? ks[Math.floor(ks.length * 0.95)] : 255);
  const sx = F.w / W, sy = F.h / H;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const j = Math.min(F.h - 1, Math.floor(py * sy)) * F.w + Math.min(F.w - 1, Math.floor(px * sx)), i = py * W + px;
    const s = R.side[j] / 127, t = R.term[j] / 255, k = Math.min(1, R.keyE[j] / k95);
    family[i] = clamp(0.5 + s * (1.6 - 1.1 * t)) * clamp(k * 3);   // soft across the terminator, none where the key is weak
    shade[i] = clamp(-s * 2.2) * (1 - t * 0.5);   // the true shadow side (faces away from the key), for the glaze
    warm[i] = clamp((4200 - (R.K[j] || 4200)) / 2200, -1, 1); strength[i] = k;
    const id = R.key[j], L0 = lamp[id];
    if (id < 250 && L0) { srcX[i] = L0[0]; srcY[i] = L0[1]; }
    const d = [R.dir[j * 3] / 127, R.dir[j * 3 + 1] / 127, R.dir[j * 3 + 2] / 127], ds = [d[0] * right[0] + d[1] * right[1] + d[2] * right[2], -(d[0] * up[0] + d[1] * up[1] + d[2] * up[2])], dl = Math.hypot(ds[0], ds[1]) || 1;
    dirX[i] = ds[0] / dl; dirY[i] = ds[1] / dl;
  }
  return { family, shade, warm, strength, srcX, srcY, dirX, dirY, lights: M.lights.length };
}
