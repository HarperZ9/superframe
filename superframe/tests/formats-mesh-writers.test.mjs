// Origin: HarperZ9.github.io system/exporters.test.mjs at commit c8866cc4 (the obj, gltf and discriminator suites), carried on 2026-11-14.
// The site ran the mesh writers through its export registry; the shim below calls the same writers directly.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { meshToOBJ, meshToGLTF } from "../lib/formats/mesh-io.js";
import { discriminateMesh, discriminateOBJText, discriminateGLTF, discriminateSVG, discriminateJSON, discriminatePNG } from "../lib/formats/structure-checks.js";

const StudioExporters = { export: async (name, _canvas, extra) => (name === "obj" ? meshToOBJ(extra.mesh) : meshToGLTF(extra.mesh)) };

// ---------------------------------------------------------------------------
// OBJ exporter -- mesh path (no canvas access)
// ---------------------------------------------------------------------------

describe("obj exporter -- mesh path", () => {
  // The mesh path in exportOBJ never touches the canvas.
  const stubCanvas = {};

  it("should return a string", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.equal(typeof result, "string");
  });

  it("should emit one v line per vertex", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });
    const vLines = result.split("\n").filter(l => l.startsWith("v "));

    assert.equal(vLines.length, 3, "expected exactly 3 vertex lines");
  });

  it("should emit vertex coordinates matching the input", async () => {
    const mesh = {
      vertices: [[1.5, -2.0, 3.75], [0, 0, 0]],
      faces: [],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.ok(result.includes("v 1.5 -2 3.75"), "expected first vertex line");
    assert.ok(result.includes("v 0 0 0"), "expected second vertex line");
  });

  it("should emit face indices as 1-based", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    // Face [0,1,2] must appear as "f 1 2 3".
    assert.ok(result.includes("f 1 2 3"), `expected "f 1 2 3", got:\n${result}`);
  });

  it("should emit one f line per face", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      faces: [[0, 1, 2], [1, 3, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });
    const fLines = result.split("\n").filter(l => l.startsWith("f "));

    assert.equal(fLines.length, 2, "expected exactly 2 face lines");
  });

  it("should emit vn lines when normals are provided", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });
    const vnLines = result.split("\n").filter(l => l.startsWith("vn "));

    assert.equal(vnLines.length, 3, "expected exactly 3 normal lines");
    assert.ok(result.includes("vn 0 0 1"), "expected normal line content");
  });

  it("should end with a newline", async () => {
    const mesh = {
      vertices: [[0, 0, 0]],
      faces: [],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.ok(result.endsWith("\n"), "OBJ string should end with newline");
  });

  it("should include the comment header line", async () => {
    const mesh = { vertices: [], faces: [] };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.ok(result.startsWith("#"), "expected OBJ to start with a comment line");
  });

  it("should handle empty mesh (no vertices, no faces) without throwing", async () => {
    const mesh = { vertices: [], faces: [] };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.equal(typeof result, "string");
    // No v or f lines expected.
    const vLines = result.split("\n").filter(l => l.startsWith("v "));
    const fLines = result.split("\n").filter(l => l.startsWith("f "));
    assert.equal(vLines.length, 0);
    assert.equal(fLines.length, 0);
  });
});


// ---------------------------------------------------------------------------
// GLTF exporter -- mesh path (no canvas access, uses btoa + typed arrays)
// ---------------------------------------------------------------------------

describe("gltf exporter -- mesh path", () => {
  const stubCanvas = {};

  const simpleMesh = {
    vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    faces: [[0, 1, 2]],
  };

  it("should return a string", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });

    assert.equal(typeof result, "string");
  });

  it("should return valid JSON", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });

    assert.doesNotThrow(() => JSON.parse(result), "GLTF output must be valid JSON");
  });

  it("should have asset.version equal to '2.0'", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.asset.version, "2.0");
  });

  it("should have required top-level GLTF 2.0 keys", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    for (const key of ["asset", "buffers", "bufferViews", "accessors", "meshes", "nodes", "scenes", "scene"]) {
      assert.ok(Object.prototype.hasOwnProperty.call(parsed, key), `missing top-level key: ${key}`);
    }
  });

  it("should have exactly one mesh named StudioMesh", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.meshes.length, 1);
    assert.equal(parsed.meshes[0].name, "StudioMesh");
  });

  it("should reference POSITION accessor index 0 in the primitive", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.meshes[0].primitives[0].attributes.POSITION, 0);
  });

  it("should use mode 4 (TRIANGLES) for the primitive", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.meshes[0].primitives[0].mode, 4);
  });

  it("should have a buffer with a positive byteLength and a data URI", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.buffers.length, 1);
    assert.ok(parsed.buffers[0].byteLength > 0, "buffer byteLength must be > 0");
    assert.ok(
      parsed.buffers[0].uri.startsWith("data:application/octet-stream;base64,"),
      "buffer uri must be a base64 data URI"
    );
  });

  it("should have the position accessor reflect the correct vertex count", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      faces: [[0, 1, 2], [1, 3, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    // accessor[0] is positions; count must equal number of vertices.
    assert.equal(parsed.accessors[0].count, 4, "position accessor count must equal vertex count");
    assert.equal(parsed.accessors[0].type, "VEC3");
    assert.equal(parsed.accessors[0].componentType, 5126, "float32 componentType");
  });

  it("should have the index accessor reflect the correct index count", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    // accessor[1] is indices; count = faces * 3.
    assert.equal(parsed.accessors[1].count, 3, "index accessor count must be faces.length * 3");
    assert.equal(parsed.accessors[1].type, "SCALAR");
    assert.equal(parsed.accessors[1].componentType, 5125, "uint32 componentType");
  });

  it("should include bounding box min/max on the position accessor", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [2, 1, 3]],
      faces: [[0, 1, 0]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    const acc = parsed.accessors[0];
    assert.deepEqual(acc.min, [0, 0, 0]);
    assert.deepEqual(acc.max, [2, 1, 3]);
  });

  it("should add a NORMAL attribute when normals match vertex count", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    assert.ok(
      "NORMAL" in parsed.meshes[0].primitives[0].attributes,
      "expected NORMAL attribute when normals provided"
    );
    // Normals should add a third bufferView and accessor.
    assert.equal(parsed.bufferViews.length, 3);
    assert.equal(parsed.accessors.length, 3);
  });

  it("should NOT add a NORMAL attribute when normals array is empty", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    assert.ok(
      !("NORMAL" in parsed.meshes[0].primitives[0].attributes),
      "should not have NORMAL attribute when normals array is empty"
    );
  });

  // Regression: large meshes must export without the spread-args RangeError.
  // The old btoa(String.fromCharCode(...bytes)) form overflowed the call-stack
  // argument limit once the combined buffer passed roughly half a megabyte. A
  // real scene easily exceeds that, so "anything out" demands a chunked encoder.
  it("should export a large mesh without a RangeError (chunked base64)", async () => {
    const N = 50000; // ~600KB of float32 positions, past the spread arg limit
    const vertices = Array.from({ length: N }, (_, i) => [i * 1e-3, (i % 7) * 0.5, (i % 13) * 0.25]);
    const faces = Array.from({ length: Math.floor(N / 3) }, (_, i) => [3 * i, 3 * i + 1, 3 * i + 2]);

    // If the encoder regressed to the spread form, this await rejects with a
    // RangeError and the test fails loudly. That is the guard.
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: { vertices, faces } });
    const parsed = JSON.parse(result);
    const uri = parsed.buffers[0].uri;

    assert.match(uri, /^data:application\/octet-stream;base64,/, "large mesh must still produce a base64 buffer URI");
    const decodedLen = Buffer.from(uri.split(",")[1], "base64").length;
    assert.equal(decodedLen, parsed.buffers[0].byteLength, "decoded buffer length must match the declared byteLength");
  });
});


// ---------------------------------------------------------------------------
// SVG exporter -- vector passthrough path
// SVG uses Blob, but the passthrough branch is the only one we can test.
// In Node, Blob is available (Node 18+). We drive it with the duck-typed input.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Structural discriminators -- deterministic, structural-before-pixel
// ---------------------------------------------------------------------------
describe("discriminateMesh() -- topology range check", () => {
  it("should pass a valid indexed mesh (all face indices in range)", () => {
    assert.equal(discriminateMesh(3, [[0, 1, 2]]), true);
  });

  it("should FAIL a mesh with an out-of-range face index", () => {
    // vertexCount = 3, but a face references index 9.
    assert.equal(discriminateMesh(3, [[0, 1, 9]]), false);
  });

  it("should fail a negative face index", () => {
    assert.equal(discriminateMesh(3, [[0, -1, 2]]), false);
  });

  it("should fail a degenerate face with fewer than 3 indices", () => {
    assert.equal(discriminateMesh(3, [[0, 1]]), false);
  });

  it("should treat a truly empty mesh (0 verts, 0 faces) as well-formed", () => {
    assert.equal(discriminateMesh(0, []), true);
  });

  it("should fail when faces is not an array", () => {
    assert.equal(discriminateMesh(3, "nope"), false);
  });
});

describe("discriminateOBJText() -- re-parse the serialized OBJ", () => {
  it("should pass OBJ text whose face indices all resolve to a vertex", () => {
    const obj = "# header\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n";
    assert.equal(discriminateOBJText(obj), true);
  });

  it("should FAIL OBJ text with an out-of-range 1-based face index", () => {
    // Only 2 vertices declared, face references the 9th.
    const obj = "v 0 0 0\nv 1 0 0\nf 1 2 9\n";
    assert.equal(discriminateOBJText(obj), false);
  });

  it("should fail on empty input", () => {
    assert.equal(discriminateOBJText(""), false);
  });
});

describe("discriminateSVG() -- well-formed + command-valid", () => {
  it("should pass a well-formed SVG with a valid path command", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L10 10 Z"/></svg>';
    assert.equal(discriminateSVG(svg), true);
  });

  it("should fail when the closing </svg> is missing", () => {
    assert.equal(discriminateSVG('<svg><circle r="5"/>'), false);
  });

  it("should fail a path whose d does not start with a move command", () => {
    assert.equal(discriminateSVG('<svg><path d="L10 10"/></svg>'), false);
  });

  it("should fail a path with an invalid command letter", () => {
    assert.equal(discriminateSVG('<svg><path d="M0 0 K99"/></svg>'), false);
  });

  it("should fail on non-string input", () => {
    assert.equal(discriminateSVG(null), false);
  });
});

describe("discriminateJSON() / discriminatePNG()", () => {
  it("discriminateJSON should pass round-trippable JSON text", () => {
    assert.equal(discriminateJSON('{"a":1,"b":[2,3]}'), true);
  });

  it("discriminateJSON should fail malformed JSON text", () => {
    assert.equal(discriminateJSON("{not valid"), false);
  });

  it("discriminatePNG should pass a non-empty Blob and fail an empty/absent one", () => {
    assert.equal(discriminatePNG(new Blob([new Uint8Array([1, 2, 3])])), true);
    assert.equal(discriminatePNG(new Blob([])), false);
    assert.equal(discriminatePNG(null), false);
  });
});

describe("discriminateGLTF() -- valid JSON + topology in range", () => {
  // Build a GLTF whose embedded index buffer can be decoded and range-checked.
  function makeGltf(indices, vertexCount) {
    const pos = new Float32Array(vertexCount * 3); // zeros are fine; count is what matters
    const idx = new Uint32Array(indices);
    const combined = new Uint8Array(pos.byteLength + idx.byteLength);
    combined.set(new Uint8Array(pos.buffer), 0);
    combined.set(new Uint8Array(idx.buffer), pos.byteLength);
    const b64 = Buffer.from(combined).toString("base64");
    return JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: combined.length, uri: "data:application/octet-stream;base64," + b64 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
        { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: vertexCount, type: "VEC3" },
        { bufferView: 1, componentType: 5125, count: idx.length, type: "SCALAR" },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
      nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    });
  }

  it("should pass a GLTF whose decoded indices are all in range", () => {
    assert.equal(discriminateGLTF(makeGltf([0, 1, 2], 3)), true);
  });

  it("should FAIL a GLTF whose decoded index buffer has an out-of-range index", () => {
    assert.equal(discriminateGLTF(makeGltf([0, 1, 9], 3)), false);
  });

  it("should fail malformed JSON", () => {
    assert.equal(discriminateGLTF("{not json"), false);
  });

  it("should pass the real exporter output for a valid mesh (end-to-end)", async () => {
    const mesh = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]], faces: [[0, 1, 2], [1, 3, 2]] };
    const gltf = await StudioExporters.export("gltf", {}, { mesh });
    assert.equal(discriminateGLTF(gltf), true);
  });
});

// ---------------------------------------------------------------------------
// StudioExporters.exportWithReceipt() -- end-to-end witnessed export
// ---------------------------------------------------------------------------
