// A skinned hero mesh as glTF 2.0 binary (.glb): one primitive per material with POSITION, NORMAL,
// TANGENT, TEXCOORD_0, COLOR_0, JOINTS_0 (unsigned short) and WEIGHTS_0, in the bind pose. The
// skeleton and clips travel beside it in <id>.char.json (hero/rig.mjs), which the native frame
// reads (native/src/tools/lwframe/lwframe_chars.cpp); the file has no glTF skin node yet (debt).
// Tangents from the uvs (Lengyel), unless a bucket brings its own (hair: along the strand).
function tangents(k) {
  const nv = k.pos.length / 3, t = new Float64Array(nv * 3), bt = new Float64Array(nv * 3), out = new Float32Array(nv * 4);
  for (let q = 0; q < k.idx.length; q += 3) {
    const i = k.idx[q], j = k.idx[q + 1], l = k.idx[q + 2];
    const e1 = [0, 1, 2].map((c) => k.pos[j * 3 + c] - k.pos[i * 3 + c]), e2 = [0, 1, 2].map((c) => k.pos[l * 3 + c] - k.pos[i * 3 + c]);
    const d1 = [k.uv[j * 2] - k.uv[i * 2], k.uv[j * 2 + 1] - k.uv[i * 2 + 1]], d2 = [k.uv[l * 2] - k.uv[i * 2], k.uv[l * 2 + 1] - k.uv[i * 2 + 1]];
    const det = d1[0] * d2[1] - d2[0] * d1[1];
    if (Math.abs(det) < 1e-14) continue;
    const r = 1 / det;
    for (const a of [i, j, l]) for (let c = 0; c < 3; c++) { t[a * 3 + c] += (e1[c] * d2[1] - e2[c] * d1[1]) * r; bt[a * 3 + c] += (e2[c] * d1[0] - e1[c] * d2[0]) * r; }
  }
  for (let a = 0; a < nv; a++) {
    const n = [k.nrm[a * 3], k.nrm[a * 3 + 1], k.nrm[a * 3 + 2]];
    let x = [t[a * 3], t[a * 3 + 1], t[a * 3 + 2]];
    const d = x[0] * n[0] + x[1] * n[1] + x[2] * n[2];
    x = [x[0] - n[0] * d, x[1] - n[1] * d, x[2] - n[2] * d];
    let l = Math.hypot(...x);
    if (!(l > 1e-9)) { x = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]; l = Math.hypot(...x) || 1; }
    const c = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]], w = c[0] * bt[a * 3] + c[1] * bt[a * 3 + 1] + c[2] * bt[a * 3 + 2] < 0 ? -1 : 1;
    out.set([x[0] / l, x[1] / l, x[2] / l, w], a * 4);
  }
  return out;
}

// buckets: Map(material -> { pos, nrm, uv, col, jnt, wgt, idx, tan? })
export function writeGlb(buckets, colours = {}, extras = {}) {
  const chunks = [], views = [], accessors = [], prims = [], materials = [];
  let off = 0;
  const pushView = (arr, target) => {
    const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(bytes, Buffer.alloc(pad)); off += bytes.length + pad;
    return views.length - 1;
  };
  const acc = (arr, type, comps, target, minmax = false) => {
    const ct = arr instanceof Uint32Array ? 5125 : arr instanceof Uint16Array ? 5123 : 5126;
    const a = { bufferView: pushView(arr, target), componentType: ct, count: arr.length / comps, type };
    if (minmax) { const mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30]; for (let i = 0; i < arr.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], arr[i + c]); mx[c] = Math.max(mx[c], arr[i + c]); } a.min = mn; a.max = mx; }
    accessors.push(a); return accessors.length - 1;
  };
  for (const [name, k] of buckets) {
    if (!k.idx.length) continue;
    const attributes = { POSITION: acc(new Float32Array(k.pos), "VEC3", 3, 34962, true), NORMAL: acc(new Float32Array(k.nrm), "VEC3", 3, 34962),
      TANGENT: acc(k.tan ? new Float32Array(k.tan) : tangents(k), "VEC4", 4, 34962), TEXCOORD_0: acc(new Float32Array(k.uv), "VEC2", 2, 34962),
      COLOR_0: acc(new Float32Array(k.col), "VEC4", 4, 34962), JOINTS_0: acc(new Uint16Array(k.jnt), "VEC4", 4, 34962), WEIGHTS_0: acc(new Float32Array(k.wgt), "VEC4", 4, 34962) };
    const c = colours[name] || [0.8, 0.8, 0.8];
    materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [c[0], c[1], c[2], 1], metallicFactor: 0, roughnessFactor: 0.8 } });
    prims.push({ attributes, indices: acc(new Uint32Array(k.idx), "SCALAR", 1, 34963), material: materials.length - 1, mode: 4 });
  }
  const bin = Buffer.concat(chunks);
  const doc = { asset: { version: "2.0", generator: "low-water hero characters (characters/hero)" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: "figure" }],
    meshes: [{ name: "figure", primitives: prims }], materials, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }], extras };
  let json = Buffer.from(JSON.stringify(doc), "utf8");
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, json, bh, bin]);
}
