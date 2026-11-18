// A HeroMesh as glTF 2.0 binary (.glb): one mesh, one primitive per material, with POSITION,
// NORMAL, TANGENT (from the uvs, per vertex, w the handedness), TEXCOORD_0, COLOR_0 and uint32
// indices. Materials carry only their names and a base colour; the native frame binds each name to
// its scanned texture set (native/src/tools/lwframe/lwframe_materials.cpp). Written from the
// Khronos glTF 2.0 specification.

function tangents(k) {
  const nv = k.pos.length / 3, t = new Float64Array(nv * 3), bt = new Float64Array(nv * 3), out = new Float32Array(nv * 4);
  for (let q = 0; q < k.idx.length; q += 3) {
    const [i, j, l] = [k.idx[q], k.idx[q + 1], k.idx[q + 2]], P = (a) => [k.pos[a * 3], k.pos[a * 3 + 1], k.pos[a * 3 + 2]], U = (a) => [k.uv[a * 2], k.uv[a * 2 + 1]];
    const p0 = P(i), e1 = P(j).map((v, c) => v - p0[c]), e2 = P(l).map((v, c) => v - p0[c]), u0 = U(i), d1 = [U(j)[0] - u0[0], U(j)[1] - u0[1]], d2 = [U(l)[0] - u0[0], U(l)[1] - u0[1]];
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
    if (l < 1e-9) { x = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]; l = Math.hypot(...x); }
    if (!(l > 1e-9)) { x = [1, 0, 0]; l = 1; }
    const c = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]], w = c[0] * bt[a * 3] + c[1] * bt[a * 3 + 1] + c[2] * bt[a * 3 + 2] < 0 ? -1 : 1;
    out.set([x[0] / l, x[1] / l, x[2] / l, w], a * 4);
  }
  return out;
}

// mesh: a HeroMesh; colours: { material: [r, g, b] } base colours for viewers without the textures;
// extras: anything for the document's extras (the generator's seed and view)
export function writeGlb(mesh, colours = {}, extras = {}) {
  const chunks = [], views = [], accessors = [], prims = [], materials = [];
  let off = 0;
  const pushView = (arr, target) => {
    const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(bytes, Buffer.alloc(pad)); off += bytes.length + pad;
    return views.length - 1;
  };
  const acc = (arr, type, comps, target, minmax = false) => {
    const a = { bufferView: pushView(arr, target), componentType: arr instanceof Uint32Array ? 5125 : 5126, count: arr.length / comps, type };
    if (minmax) { const mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30]; for (let i = 0; i < arr.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], arr[i + c]); mx[c] = Math.max(mx[c], arr[i + c]); } a.min = mn; a.max = mx; }
    accessors.push(a); return accessors.length - 1;
  };
  for (const [name, k] of mesh.b) {
    if (!k.idx.length) continue;
    const pos = new Float32Array(k.pos);
    const attributes = { POSITION: acc(pos, "VEC3", 3, 34962, true), NORMAL: acc(new Float32Array(k.nrm), "VEC3", 3, 34962), TANGENT: acc(tangents(k), "VEC4", 4, 34962),
      TEXCOORD_0: acc(new Float32Array(k.uv), "VEC2", 2, 34962), COLOR_0: acc(new Float32Array(k.col), "VEC4", 4, 34962) };
    const c = colours[name] || [0.8, 0.8, 0.8];
    materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [c[0], c[1], c[2], 1], metallicFactor: 0, roughnessFactor: 0.8 } });
    prims.push({ attributes, indices: acc(new Uint32Array(k.idx), "SCALAR", 1, 34963), material: materials.length - 1, mode: 4 });
  }
  const bin = Buffer.concat(chunks);
  const doc = { asset: { version: "2.0", generator: "low-water hero kit (walk/build/hero)" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: "hero" }],
    meshes: [{ name: "hero", primitives: prims }], materials, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }], extras };
  let json = Buffer.from(JSON.stringify(doc), "utf8");
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, json, bh, bin]);
}
