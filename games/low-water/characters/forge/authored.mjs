// Authored heads: a hand-built head from the asset toolchain (raw-native tools/asset) placed in the figure's
// mesh in place of the code-generated sculpt. The source is characters/assets/heads/<id>.sculpt.json and
// .paint.json; the built file is <id>.rna (RNA1: JSON header plus aligned typed arrays). This adapter owns
// the game's side: material ids, joint weights, the neck tube, and the per-vertex curvature and cavity maps.
import { limb, INDEX } from "../rig/body.mjs";
import { MATS } from "../rig/materials.mjs";

const TYPES = { f32: Float32Array, u32: Uint32Array, u16: Uint16Array, u8: Uint8Array }, pad4 = (n) => (n + 3) & ~3;
export function readRna(buf) {
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  if (String.fromCharCode(...u8.subarray(0, 4)) !== "RNA1") throw new Error("authored: not an RNA1 file");
  const hl = new DataView(u8.buffer, u8.byteOffset).getUint32(4, true), head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl))), arrays = {};
  let off = 8 + pad4(hl);
  for (const a of head.arrays) { const T = TYPES[a.type], bytes = a.length * T.BYTES_PER_ELEMENT, copy = new Uint8Array(bytes); copy.set(u8.subarray(off, off + bytes)); arrays[a.name] = new T(copy.buffer); off += pad4(bytes); }
  return { meta: head.meta, arrays };
}

const J = (B, j) => B[INDEX[j]].p, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LOD = { near: "portrait", mid: "play", far: "far" };

// returns the head's centre c, as the generated head does, so hats and props sit as before
export function authoredHead(M, B, o, lod, asset) {
  const hj = J(B, "head"), nj = J(B, "neck"), R = o.r, s = R / 0.105, c = [hj[0], hj[1] + R * 0.9, hj[2] + R * 0.05], prev = M.cur;
  M.begin("head");
  limb(M, B, "neck", "head", o.neck || 0.055, (o.neck || 0.055) * 0.92, MATS[o.skin || "flesh"].id, { rings: 4, seg: 12, over: 0.15 });
  const wHead = (y) => { const t = sm(nj[1] + 0.01, hj[1] + 0.04, y); return { head: t, neck: 1 - t }; };
  const k = LOD[lod] || "far", A = asset.arrays, pos = A[`${k}.pos`], nrm = A[`${k}.nrm`], tri = A[`${k}.tri`], col = A[`${k}.col`], hair = A[`${k}.hair`], curv = A[`${k}.curv`], cav = A[`${k}.cav`];
  const start = M.pos.length / 3, hairMat = MATS[o.hairMat || "hair"], skin = MATS[o.skin || "flesh"];
  for (let v = 0; v < pos.length / 3; v++) {
    const p = [c[0] + pos[v * 3] * s, c[1] + pos[v * 3 + 1] * s, c[2] + pos[v * 3 + 2] * s], mat = hair[v] ? hairMat : skin, base = mat.c;
    M.paint = () => [0, 1, 2].map((i) => Math.max(0, Math.min(1.8, col[v * 3 + i] / base[i])));
    M.vert(p, [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]], mat.id, wHead(p[1])); M.paint = null;
  }
  for (let i = 0; i < tri.length; i++) M.tri.push(start + tri[i]);
  M.headMaps = { v0: start, n: pos.length / 3, curv, cav };
  asset.meta.eyes.forEach((e) => {
    const ep = A[`${e.array}.pos`], en = A[`${e.array}.nrm`], et = A[`${e.array}.tri`], mat = MATS[e.material.replace("eye_", "")], b0 = M.pos.length / 3;
    for (let v = 0; v < ep.length / 3; v++) { const p = [c[0] + ep[v * 3] * s, c[1] + ep[v * 3 + 1] * s, c[2] + ep[v * 3 + 2] * s]; M.vert(p, [en[v * 3], en[v * 3 + 1], en[v * 3 + 2]], mat.id, wHead(p[1])); }
    for (let i = 0; i < et.length; i += 3) M.tri.push(b0 + et[i], b0 + et[i + 2], b0 + et[i + 1]);   // the game's winding is the reverse of the tool's for these parts
  });
  M.cur = prev; return c;
}
