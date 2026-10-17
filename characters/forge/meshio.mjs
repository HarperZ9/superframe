// Forged meshes on disk, so the browser and the bake never re-sculpt at run time.
// .lwmesh: "LWM1", a uint32 header length, a JSON header (counts, part names, tool and grips), then
// the typed arrays in a fixed order. Pure: works on ArrayBuffers in Node and the browser.
import { Mesh, bind } from "../rig/body.mjs";

const ARR = [["pos", Float32Array], ["nrm", Float32Array], ["loc", Float32Array], ["col", Float32Array], ["ww", Float32Array], ["wj", Uint8Array], ["mat", Uint8Array], ["part", Uint8Array], ["tri", Uint32Array]];

export function packMesh(built) {
  const M = built.M, arrays = ARR.map(([k, T]) => T.from(M[k]));
  const head = JSON.stringify({ parts: M.parts, grips: built.grips, hands: built.hands, tool: built.tool ? { id: built.tool.id, cls: built.tool.cls, twoHand: built.tool.twoHand, blade: built.tool.blade, left: built.tool.left } : null, lengths: arrays.map((a) => a.length) });
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
  return { M, B: bind(P), grips: head.grips, hands: head.hands, tool: head.tool };
}
