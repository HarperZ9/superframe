// Forged meshes on disk, so the browser and the bake never re-sculpt at run time.
// .lwmesh: "LWM1", a uint32 header length, a JSON header (counts, part names, tool and grips), then
// the typed arrays in a fixed order, then any per-vertex maps (Float32, one value a vertex: the
// head sculptor's curvature, thickness and cavity) named in header.maps. Pure: works on
// ArrayBuffers in Node and the browser. Files without maps read as before.
import { Mesh, bind } from "../rig/body.mjs";

const ARR = [["pos", Float32Array], ["nrm", Float32Array], ["loc", Float32Array], ["col", Float32Array], ["ww", Float32Array], ["wj", Uint8Array], ["mat", Uint8Array], ["part", Uint8Array], ["tri", Uint32Array]];

export function packMesh(built, maps = null) {
  const M = built.M, names = maps ? Object.keys(maps) : [], arrays = [...ARR.map(([k, T]) => T.from(M[k])), ...names.map((n) => Float32Array.from(maps[n]))];
  const head = JSON.stringify({ parts: M.parts, grips: built.grips, hands: built.hands, tool: built.tool ? { id: built.tool.id, cls: built.tool.cls, twoHand: built.tool.twoHand, blade: built.tool.blade, left: built.tool.left } : null, lengths: arrays.map((a) => a.length), maps: names, meta: built.meta || null });
  const hb = new TextEncoder().encode(head), pad = (n) => (n + 3) & ~3;
  let size = 8 + pad(hb.length); for (const a of arrays) size += pad(a.byteLength);
  const buf = new ArrayBuffer(size), dv = new DataView(buf); new Uint8Array(buf).set([76, 87, 77, 49], 0); dv.setUint32(4, hb.length, true); new Uint8Array(buf, 8).set(hb);
  let off = 8 + pad(hb.length); for (const a of arrays) { new Uint8Array(buf, off, a.byteLength).set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); off += pad(a.byteLength); }
  return buf;
}
export function unpackMesh(buf, P) {
  const u8 = new Uint8Array(buf); if (String.fromCharCode(...u8.subarray(0, 4)) !== "LWM1") throw new Error("lwmesh: not a forged mesh");
  const hl = new DataView(buf).getUint32(4, true), head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl))), pad = (n) => (n + 3) & ~3, M = new Mesh();
  let off = 8 + pad(hl);
  ARR.forEach(([k, T], i) => { const n = head.lengths[i], bytes = n * T.BYTES_PER_ELEMENT, copy = new Uint8Array(bytes); copy.set(u8.subarray(off, off + bytes)); M[k] = Array.from(new T(copy.buffer)); off += pad(bytes); });
  M.parts = head.parts;
  const maps = {}; (head.maps || []).forEach((n, j) => { const i = ARR.length + j, len = head.lengths[i], bytes = len * 4, copy = new Uint8Array(bytes); copy.set(u8.subarray(off, off + bytes)); maps[n] = new Float32Array(copy.buffer); off += pad(bytes); });
  return { M, B: P ? bind(P) : null, grips: head.grips, hands: head.hands, tool: head.tool, maps, meta: head.meta || null };
}
