// Origin: HarperZ9.github.io system/exporters.js (structural discriminators) at commit c8866cc4, carried on 2026-11-14; the functions are unchanged and are exported at the end.
// structure-checks.js
// Yes-or-no structural checks of a written file: read the serialised text back and confirm it holds together.

// ---- structural discriminators (deterministic, structural-before-pixel) ------
//
// Each discriminator is a deterministic STRUCTURAL test of the exported artifact
// (the spec's "structural oracle" / structural-before-pixel rule). It returns a
// boolean. No pixel diffing, no model, no floating-point faithfulness score:
// a named, re-runnable check with a yes/no verdict.

/**
 * OBJ / GLTF mesh structural check: vertex and face counts present, geometry is
 * indexed, and EVERY face index is in range [0, vertexCount). Out-of-range index
 * -> false (this is what catches a malformed mesh).
 */
function discriminateMesh(vertexCount, faces) {
  if (!Number.isInteger(vertexCount) || vertexCount < 0) return false;
  if (!Array.isArray(faces)) return false;
  if (vertexCount === 0 && faces.length === 0) return true; // empty mesh is well-formed
  for (const f of faces) {
    if (!Array.isArray(f) || f.length < 3) return false;
    for (const idx of f) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= vertexCount) return false;
    }
  }
  return true;
}

/**
 * OBJ text structural check: re-parse the emitted text and confirm every face
 * line's 1-based indices resolve to a declared vertex. Verifies the SERIALIZED
 * artifact, not just the source mesh.
 */
function discriminateOBJText(objText) {
  if (typeof objText !== "string" || objText.length === 0) return false;
  let vCount = 0;
  const faces = [];
  for (const raw of objText.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("v ")) vCount++;
    else if (line.startsWith("f ")) {
      const idx = line.slice(2).trim().split(/\s+/).map(t => parseInt(t.split("/")[0], 10) - 1);
      faces.push(idx);
    }
  }
  return discriminateMesh(vCount, faces);
}

/**
 * SVG structural check: well-formed-enough for our zero-dep purpose -- a single
 * root <svg ...> with a matching </svg>, balanced angle brackets, no obviously
 * broken tag. When DOMParser exists (browser) we additionally reject a parser
 * error. Command-validity for path data is checked when a <path d="..."> exists.
 */
function discriminateSVG(svgText) {
  if (typeof svgText !== "string" || svgText.length === 0) return false;
  if (!/<svg[\s>]/i.test(svgText) || !/<\/svg>/i.test(svgText)) return false;
  // Balanced angle brackets (cheap well-formedness signal).
  const opens = (svgText.match(/</g) || []).length;
  const closes = (svgText.match(/>/g) || []).length;
  if (opens !== closes) return false;
  // Path command validity: every d="..." must start with a move command and use
  // only valid SVG path command letters.
  const pathMatches = svgText.match(/\bd\s*=\s*"([^"]*)"/gi) || [];
  for (const m of pathMatches) {
    const d = m.replace(/.*?"([^"]*)".*/, "$1").trim();
    if (d.length === 0) continue;
    if (!/^[Mm]/.test(d)) return false;
    if (/[^MmLlHhVvCcSsQqTtAaZz0-9eE\s,.\-+]/.test(d)) return false;
  }
  // Browser DOMParser secondary check (skipped in Node where DOMParser is absent).
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
      if (doc.getElementsByTagName("parsererror").length > 0) return false;
    } catch (_) { /* parser unavailable; the textual checks above stand */ }
  }
  return true;
}

/** JSON structural check: the emitted string round-trips through JSON.parse. */
function discriminateJSON(jsonText) {
  if (typeof jsonText !== "string" || jsonText.length === 0) return false;
  try { JSON.parse(jsonText); return true; }
  catch (_) { return false; }
}

/** GLTF structural check: valid JSON AND mesh topology in range. */
function discriminateGLTF(gltfText) {
  if (!discriminateJSON(gltfText)) return false;
  let g;
  try { g = JSON.parse(gltfText); } catch (_) { return false; }
  if (!g.asset || !g.meshes || !g.accessors) return false;
  // Resolve the POSITION accessor count and the index accessor, confirm in range.
  const prim = g.meshes[0] && g.meshes[0].primitives && g.meshes[0].primitives[0];
  if (!prim) return false;
  const posIdx = prim.attributes && prim.attributes.POSITION;
  if (posIdx == null || !g.accessors[posIdx]) return false;
  const vertexCount = g.accessors[posIdx].count;
  if (prim.indices == null) return Number.isInteger(vertexCount) && vertexCount >= 0;
  const idxAcc = g.accessors[prim.indices];
  if (!idxAcc) return false;
  // The index buffer lives in a data URI; decode and range-check every index.
  const faces = _decodeGltfIndices(g, prim.indices);
  if (faces == null) {
    // Cannot decode (non-data-uri): fall back to count sanity only.
    return Number.isInteger(idxAcc.count) && idxAcc.count % 3 === 0;
  }
  return discriminateMesh(vertexCount, faces);
}

/** Decode an index accessor from an embedded base64 data-URI buffer. */
function _decodeGltfIndices(gltf, accIdx) {
  try {
    const acc = gltf.accessors[accIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const buf = gltf.buffers[bv.buffer];
    if (!buf || typeof buf.uri !== "string" || !buf.uri.startsWith("data:")) return null;
    const b64 = buf.uri.slice(buf.uri.indexOf(",") + 1);
    const raw = atob(b64);
    const u8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const CT = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array };
    const TA = CT[acc.componentType] || Uint32Array;
    const flat = new TA(u8.buffer, byteOffset, acc.count);
    const faces = [];
    for (let i = 0; i + 2 < flat.length; i += 3) faces.push([flat[i], flat[i + 1], flat[i + 2]]);
    return faces;
  } catch (_) { return null; }
}

/** PNG structural check: a non-empty Blob (the spec's stated PNG rule). */
function discriminatePNG(blob) {
  return !!(blob && typeof blob.size === "number" && blob.size > 0);
}

export { discriminateMesh, discriminateOBJText, discriminateSVG, discriminateJSON, discriminateGLTF, discriminatePNG };
