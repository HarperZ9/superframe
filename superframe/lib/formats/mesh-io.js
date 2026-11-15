// Origin: HarperZ9.github.io system/exporters.js and system/importers.js at commit c8866cc4, carried on 2026-11-14.
// mesh-io.js
// Mesh and table readers and writers with no browser API. A mesh is
// { vertices: [[x,y,z],...], faces: [[i,j,k],...], normals?: [[x,y,z],...] }.
//
// On the site each reader sat inside an import handler that took a File, read
// it with FileReader and drew a preview on a canvas, and each writer sat inside
// an export handler that took a canvas. The parsing and serialising statements
// below are the site's; the File, canvas and preview lines stayed behind, and
// each function now takes text or bytes and returns data.
//
// Writers: meshToOBJ, meshToGLTF.
// Readers: parseOBJ, parsePLY (ASCII), parseGLTF (.gltf with data URIs, .glb),
//          parseTable (CSV, JSON), svgSize.

// Base64 in fixed chunks: one fromCharCode call over a large buffer overflows
// the argument limit, so a big mesh would throw RangeError.
function bytesToBase64(bytes) {
  let binary = "";
  const CHUNK = 0x8000; // 32768 bytes per call, well under any arg limit
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ---- writers ----------------------------------------------------------------

/** Wavefront OBJ text from a mesh. Faces are written 1-based. */
export function meshToOBJ(mesh) {
  const { vertices = [], faces = [], normals = [] } = mesh;
  const lines = ["# Exported by Studio / exporters.js"];
  for (const [x, y, z] of vertices) lines.push(`v ${x} ${y} ${z}`);
  for (const [x, y, z] of normals) lines.push(`vn ${x} ${y} ${z}`);
  for (const f of faces) {
    // OBJ faces are 1-based.
    lines.push("f " + f.map(i => i + 1).join(" "));
  }
  return lines.join("\n") + "\n";
}

/**
 * glTF 2.0 JSON text from a mesh, with positions (float32), indices (uint32)
 * and, when one normal per vertex is given, normals, in one embedded data URI.
 */
export function meshToGLTF(mesh) {
  const { vertices = [], faces = [], normals = [] } = mesh;

  // Build flat Float32 buffer for positions and Uint32 buffer for indices.
  const posFlat = new Float32Array(vertices.length * 3);
  vertices.forEach(([x, y, z], i) => { posFlat[i * 3] = x; posFlat[i * 3 + 1] = y; posFlat[i * 3 + 2] = z; });
  const idxFlat = new Uint32Array(faces.length * 3);
  faces.forEach(([a, b, c], i) => { idxFlat[i * 3] = a; idxFlat[i * 3 + 1] = b; idxFlat[i * 3 + 2] = c; });

  // Compute bounding box for the accessor.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of vertices) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  // Combine position and index buffers into one ArrayBuffer.
  const posByteLength = posFlat.byteLength;
  const idxByteLength = idxFlat.byteLength;
  const combined = new ArrayBuffer(posByteLength + idxByteLength);
  new Uint8Array(combined).set(new Uint8Array(posFlat.buffer));
  new Uint8Array(combined, posByteLength).set(new Uint8Array(idxFlat.buffer));

  // Encode as data URI.
  const b64 = bytesToBase64(new Uint8Array(combined));
  const dataUri = "data:application/octet-stream;base64," + b64;

  const gltf = {
    asset: { version: "2.0", generator: "Studio exporters.js" },
    buffers: [{ byteLength: combined.byteLength, uri: dataUri }],
    bufferViews: [
      { buffer: 0, byteOffset: 0,             byteLength: posByteLength, target: 34962 },
      { buffer: 0, byteOffset: posByteLength,  byteLength: idxByteLength, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0, byteOffset: 0, componentType: 5126, count: vertices.length,
        type: "VEC3", min: [minX, minY, minZ], max: [maxX, maxY, maxZ],
      },
      {
        bufferView: 1, byteOffset: 0, componentType: 5125, count: faces.length * 3,
        type: "SCALAR",
      },
    ],
    meshes: [{
      name: "StudioMesh",
      primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }],
    }],
    nodes:  [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene:  0,
  };

  // Append normals as an additional accessor + attribute if provided.
  if (normals && normals.length === vertices.length) {
    const normFlat = new Float32Array(normals.length * 3);
    normals.forEach(([x, y, z], i) => { normFlat[i * 3] = x; normFlat[i * 3 + 1] = y; normFlat[i * 3 + 2] = z; });
    // Rebuild the combined buffer with normals appended.
    const normByteLength = normFlat.byteLength;
    const combined2 = new ArrayBuffer(posByteLength + idxByteLength + normByteLength);
    new Uint8Array(combined2).set(new Uint8Array(posFlat.buffer));
    new Uint8Array(combined2, posByteLength).set(new Uint8Array(idxFlat.buffer));
    new Uint8Array(combined2, posByteLength + idxByteLength).set(new Uint8Array(normFlat.buffer));
    const b64n = bytesToBase64(new Uint8Array(combined2));
    gltf.buffers[0] = { byteLength: combined2.byteLength, uri: "data:application/octet-stream;base64," + b64n };
    gltf.bufferViews.push({ buffer: 0, byteOffset: posByteLength + idxByteLength, byteLength: normByteLength, target: 34962 });
    gltf.accessors.push({ bufferView: 2, byteOffset: 0, componentType: 5126, count: normals.length, type: "VEC3" });
    gltf.meshes[0].primitives[0].attributes.NORMAL = 2;
  }

  return JSON.stringify(gltf, null, 2);
}

// ---- readers ----------------------------------------------------------------

/**
 * OBJ: vertices (v), faces (f) and optional normals (vn). Quads and larger
 * polygons become a triangle fan. Negative (relative) indices are supported.
 * Texture coordinates, materials and groups are ignored.
 */
export function parseOBJ(text) {
  const vertices = [];
  const normals  = [];
  const faces    = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const p = line.slice(2).trim().split(/\s+/).map(Number);
      if (p.length >= 3) vertices.push([p[0], p[1], p[2]]);
    } else if (line.startsWith("vn ")) {
      const n = line.slice(3).trim().split(/\s+/).map(Number);
      if (n.length >= 3) normals.push([n[0], n[1], n[2]]);
    } else if (line.startsWith("f ")) {
      // Face entries: "f v" or "f v/t" or "f v/t/n" or "f v//n"; take the vertex index only.
      const tokens = line.slice(2).trim().split(/\s+/);
      const idx = tokens.map(t => {
        const v = parseInt(t.split("/")[0], 10);
        return v < 0 ? vertices.length + v : v - 1; // OBJ is 1-based, support negative
      });
      // Triangulate quads and larger polygons via fan decomposition.
      for (let i = 1; i < idx.length - 1; i++) {
        faces.push([idx[0], idx[i], idx[i + 1]]);
      }
    }
  }
  const mesh = { vertices, faces };
  if (normals.length) mesh.normals = normals;
  return mesh;
}

/**
 * PLY, ASCII only: reads the header for the vertex count and the x, y, z
 * property positions, then one vertex per line. Faces are not read; the mesh
 * comes back as a point cloud with `faceCount` taken from the header.
 */
export function parsePLY(text) {
  const lines = text.split("\n");

  let inHeader = true;
  let vertexCount = 0;
  let faceCount   = 0;
  let xIdx = 0, yIdx = 1, zIdx = 2;
  const propNames = [];

  for (const line of lines) {
    const t = line.trim();
    if (t === "end_header") { inHeader = false; break; }
    if (!inHeader) break;
    if (t.startsWith("element vertex")) vertexCount = parseInt(t.split(/\s+/)[2], 10);
    if (t.startsWith("element face"))   faceCount   = parseInt(t.split(/\s+/)[2], 10);
    if (t.startsWith("property float") || t.startsWith("property double") || t.startsWith("property int")) {
      const pname = t.split(/\s+/).pop();
      propNames.push(pname);
    }
  }
  xIdx = propNames.indexOf("x"); if (xIdx < 0) xIdx = 0;
  yIdx = propNames.indexOf("y"); if (yIdx < 0) yIdx = 1;
  zIdx = propNames.indexOf("z"); if (zIdx < 0) zIdx = 2;

  // Find header end and read vertex data lines.
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "end_header") { dataStart = i + 1; break; }
  }

  const vertices = [];
  for (let i = dataStart; i < dataStart + vertexCount && i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/).map(Number);
    if (parts.length >= 3) {
      vertices.push([
        isNaN(parts[xIdx]) ? parts[0] : parts[xIdx],
        isNaN(parts[yIdx]) ? parts[1] : parts[yIdx],
        isNaN(parts[zIdx]) ? parts[2] : parts[zIdx],
      ]);
    }
  }

  return { vertices, faces: [], format: "ascii", faceCount };
}

/**
 * glTF 2.0: `ab` is an ArrayBuffer holding a .gltf JSON file or, with
 * isGLB true, a binary .glb. Only the first primitive's POSITION and indices
 * are read. Buffers must be the GLB bin chunk or a data URI; an external URI
 * gives an empty mesh. No materials, no skins.
 */
export function parseGLTF(ab, isGLB = false) {
  let json, binChunk = null;

  if (isGLB) {
    const view = new DataView(ab);
    // GLB header: magic 0x46546C67, version uint32, length uint32
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) throw new Error("Not a valid GLB file");
    // First chunk: JSON
    const chunk0Len  = view.getUint32(12, true);
    const chunk0Type = view.getUint32(16, true);
    if (chunk0Type !== 0x4E4F534A) throw new Error("GLB first chunk is not JSON");
    const jsonBytes = new Uint8Array(ab, 20, chunk0Len);
    json = JSON.parse(new TextDecoder().decode(jsonBytes));
    // Second chunk (optional): BIN
    const binOffset = 20 + chunk0Len;
    if (binOffset + 8 <= ab.byteLength) {
      const chunk1Len  = view.getUint32(binOffset,     true);
      const chunk1Type = view.getUint32(binOffset + 4, true);
      if (chunk1Type === 0x004E4942) {
        binChunk = ab.slice(binOffset + 8, binOffset + 8 + chunk1Len);
      }
    }
  } else {
    const text = new TextDecoder().decode(ab);
    json = JSON.parse(text);
  }

  const buffers   = json.buffers   || [];
  const bufViews  = json.bufferViews || [];
  const accessors = json.accessors  || [];
  const meshes    = json.meshes     || [];

  // Resolve a buffer: GLB bin chunk or a data URI.
  function resolveBuffer(bufIdx) {
    const buf = buffers[bufIdx];
    if (!buf) return null;
    if (isGLB && bufIdx === 0 && binChunk) return binChunk;
    if (buf.uri && buf.uri.startsWith("data:")) {
      const comma = buf.uri.indexOf(",");
      const b64   = buf.uri.slice(comma + 1);
      const raw   = atob(b64);
      const u8    = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      return u8.buffer;
    }
    return null; // external URIs are not read
  }

  // Read accessor data into a typed array.
  function readAccessor(accIdx) {
    const acc = accessors[accIdx];
    if (!acc) return null;
    const bvIdx = acc.bufferView;
    if (bvIdx == null) return null;
    const bv = bufViews[bvIdx];
    if (!bv) return null;
    const abBuf = resolveBuffer(bv.buffer || 0);
    if (!abBuf) return null;
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const count = acc.count;
    const CT = {
      5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array,
      5125: Uint32Array, 5126: Float32Array,
    };
    const TypedArr = CT[acc.componentType] || Float32Array;
    const components = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT2:4, MAT3:9, MAT4:16 }[acc.type] || 1;
    return new TypedArr(abBuf, byteOffset, count * components);
  }

  // Extract first primitive.
  let vertices = [], faces = [];
  let primitiveCount = 0;
  for (const mesh of meshes) {
    for (const prim of (mesh.primitives || [])) {
      primitiveCount++;
      if (vertices.length) break; // only first primitive
      const posIdx = prim.attributes && prim.attributes.POSITION;
      if (posIdx == null) continue;
      const posData = readAccessor(posIdx);
      if (!posData) continue;
      for (let i = 0; i < posData.length; i += 3) {
        vertices.push([posData[i], posData[i + 1], posData[i + 2]]);
      }
      if (prim.indices != null) {
        const idxData = readAccessor(prim.indices);
        if (idxData) {
          for (let i = 0; i < idxData.length; i += 3) {
            faces.push([idxData[i], idxData[i + 1], idxData[i + 2]]);
          }
        }
      } else {
        // No index buffer: generate sequential triangles.
        for (let i = 0; i < vertices.length - 2; i += 3) {
          faces.push([i, i + 1, i + 2]);
        }
      }
    }
    if (vertices.length) break;
  }

  return { vertices, faces, primitiveCount };
}

/**
 * Tables. kind "csv": the first line names the columns when there is more than
 * one line; a file whose first two columns are numeric in its first ten rows
 * comes back as number pairs. kind "json": an array of numbers becomes
 * [index, value] rows, an array of {x, y} becomes [x, y] rows, and an array of
 * objects becomes one row per object under the first object's keys.
 * Returns { colNames, rows, isNumericPairs }. The CSV split is on commas only:
 * quoted fields that hold a comma are not handled.
 */
export function parseTable(text, kind) {
  let rows = [];
  let colNames = [];
  let isNumericPairs = false;

  if (kind === "json") {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) {
        const first = parsed[0];
        if (typeof first === "number") {
          // Array of numbers: single-column, use index as X.
          rows = parsed.map((v, i) => [i, v]);
          colNames = ["index", "value"];
          isNumericPairs = true;
        } else if (typeof first === "object" && first !== null && ("x" in first || "y" in first)) {
          rows = parsed.map(r => [r.x != null ? r.x : r[0], r.y != null ? r.y : r[1]]);
          colNames = ["x", "y"];
          isNumericPairs = rows.every(r => typeof r[0] === "number" && typeof r[1] === "number");
        } else {
          // Object array: one row per object.
          const keys = Object.keys(first);
          colNames = keys;
          rows = parsed.map(o => keys.map(k => o[k]));
        }
      }
    } catch (_) { /* not JSON: the caller gets an empty table */ }
  } else if (kind === "csv") {
    const allLines = text.trim().split("\n").map(l => l.split(",").map(s => s.trim()));
    if (allLines.length > 1) {
      colNames = allLines[0];
      rows = allLines.slice(1);
    } else {
      rows = allLines;
    }
    // Detect 2-column numeric CSV.
    if (rows.length && rows[0].length >= 2) {
      isNumericPairs = rows.slice(0, 10).every(r => !isNaN(parseFloat(r[0])) && !isNaN(parseFloat(r[1])));
      if (isNumericPairs) rows = rows.map(r => [parseFloat(r[0]), parseFloat(r[1])]);
    }
  }
  return { colNames, rows, isNumericPairs };
}

/**
 * The declared size of an SVG document: the root element's width and height,
 * then its viewBox, then 512 by 512. The site read the root with DOMParser and
 * drew the picture through an Image element; here the root tag is found with a
 * regular expression, and nothing is drawn. Path data is not parsed.
 */
export function svgSize(text) {
  const root = /<svg\b[^>]*>/i.exec(String(text || ""));
  if (!root) return null;
  const attr = (name) => {
    const m = new RegExp("\\s" + name + "\\s*=\\s*[\"']([^\"']*)[\"']", "i").exec(root[0]);
    return m ? m[1] : null;
  };
  let sw = parseInt(attr("width"),  10);
  let sh = parseInt(attr("height"), 10);
  const vb = attr("viewBox");
  let viewBox = null;
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts.every(Number.isFinite)) viewBox = parts.slice(0, 4);
  }
  if (viewBox && (isNaN(sw) || isNaN(sh))) { sw = viewBox[2]; sh = viewBox[3]; }
  if (isNaN(sw) || isNaN(sh)) { sw = 512; sh = 512; }
  return { width: sw, height: sh, viewBox };
}
