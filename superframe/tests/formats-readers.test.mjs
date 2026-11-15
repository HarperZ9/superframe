// Readers in superframe/lib/formats/mesh-io.js and the one-page PDF writer.
// The OBJ, PLY, CSV, JSON and GLB fixtures and their expected values are the
// ones in the self test of HarperZ9.github.io system/importers.js at commit
// c8866cc4. The round trips pair each reader with a writer in this folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { meshToOBJ, meshToGLTF, parseOBJ, parsePLY, parseGLTF, parseTable, svgSize } from "../lib/formats/mesh-io.js";
import { heightGridToObj } from "../lib/formats/disciplines.js";
import { discriminateMesh, discriminateOBJText } from "../lib/formats/structure-checks.js";
import { jpegToPdf } from "../lib/formats/pdf-page.js";
import { voxelizeHeightGrid, voxelObj, voxelCount } from "../../packages/voxel/src/voxel.js";

const QUAD = {
  vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0.25]],
  faces: [[0, 1, 2], [1, 3, 2]],
};
const bytesOf = (s) => new TextEncoder().encode(s).buffer;

test("parseOBJ reads the site fixture: 4 vertices, 1 normal, 2 faces, zero-based", () => {
  const mesh = parseOBJ(["v 0 0 0", "v 1 0 0", "v 0 1 0", "v 1 1 0", "vn 0 0 1", "f 1 2 3", "f 2 4 3"].join("\n"));
  assert.equal(mesh.vertices.length, 4);
  assert.equal(mesh.normals.length, 1);
  assert.deepEqual(mesh.faces, [[0, 1, 2], [1, 3, 2]]);
});

test("parseOBJ fans a quad, takes the vertex index from v/t/n and resolves negative indices", () => {
  const mesh = parseOBJ("v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1/1/1 2/2/1 3/3/1 4/4/1\nf -4 -3 -2\n");
  assert.deepEqual(mesh.faces, [[0, 1, 2], [0, 2, 3], [0, 1, 2]]);
  assert.equal(mesh.normals, undefined);
});

test("OBJ round trip: meshToOBJ then parseOBJ returns the mesh", () => {
  const withNormals = { ...QUAD, normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] };
  assert.deepEqual(parseOBJ(meshToOBJ(QUAD)), QUAD);
  assert.deepEqual(parseOBJ(meshToOBJ(withNormals)), withNormals);
});

test("glTF round trip: meshToGLTF then parseGLTF returns the mesh, with float32 positions", () => {
  const back = parseGLTF(bytesOf(meshToGLTF(QUAD)));
  assert.deepEqual(back.faces, QUAD.faces);
  assert.deepEqual(back.vertices, QUAD.vertices);
  assert.equal(back.primitiveCount, 1);
});

test("parseGLTF reads a binary .glb and refuses a wrong magic number", () => {
  const gltf = JSON.parse(meshToGLTF(QUAD));
  const uri = gltf.buffers[0].uri;
  const bin = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
  delete gltf.buffers[0].uri;
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const glb = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  glb.writeUInt32LE(bin.length, 20 + json.length); glb.writeUInt32LE(0x004e4942, 24 + json.length);
  bin.copy(glb, 28 + json.length);
  const ab = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length);
  const back = parseGLTF(ab, true);
  assert.deepEqual(back.vertices, QUAD.vertices);
  assert.deepEqual(back.faces, QUAD.faces);

  const bad = Buffer.from(glb); bad.writeUInt32LE(0x12345678, 0);
  assert.throws(() => parseGLTF(bad.buffer.slice(bad.byteOffset, bad.byteOffset + bad.length), true), /Not a valid GLB/);
});

test("parsePLY reads the site fixture and honours the property order in the header", () => {
  const ply = ["ply", "format ascii 1.0", "element vertex 5", "property float x", "property float y", "property float z",
    "element face 0", "end_header", "0 0 0", "1 0 0", "0 1 0", "1 1 0", "0.5 0.5 0"].join("\n");
  const cloud = parsePLY(ply);
  assert.equal(cloud.vertices.length, 5);
  assert.deepEqual(cloud.vertices[4], [0.5, 0.5, 0]);
  assert.deepEqual(cloud.faces, []);

  const swapped = ["ply", "format ascii 1.0", "element vertex 1", "property float z", "property float x", "property float y",
    "end_header", "3 1 2"].join("\n");
  assert.deepEqual(parsePLY(swapped).vertices, [[1, 2, 3]]);
});

test("parseTable reads the site CSV and JSON fixtures", () => {
  const csv = parseTable("x,y\n1,2\n3,4\n5,6", "csv");
  assert.deepEqual(csv.colNames, ["x", "y"]);
  assert.equal(csv.rows.length, 3);
  assert.equal(csv.isNumericPairs, true);
  assert.deepEqual(csv.rows[1], [3, 4]);

  const nums = parseTable("[10, 20, 30, 40]", "json");
  assert.equal(nums.rows.length, 4);
  assert.deepEqual(nums.rows[2], [2, 30]);

  const words = parseTable("name,kind\noak,tree\nfern,plant", "csv");
  assert.equal(words.isNumericPairs, false);
  assert.deepEqual(words.rows[0], ["oak", "tree"]);

  assert.deepEqual(parseTable("{broken", "json"), { colNames: [], rows: [], isNumericPairs: false });
});

test("svgSize reads width and height, falls back to the viewBox, then to 512", () => {
  assert.deepEqual(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"></svg>'),
    { width: 210, height: 297, viewBox: [0, 0, 210, 297] });
  assert.deepEqual(svgSize('<?xml version="1.0"?>\n<svg viewBox="0 0 640 480"><path d="M0 0"/></svg>'),
    { width: 640, height: 480, viewBox: [0, 0, 640, 480] });
  assert.deepEqual(svgSize("<svg></svg>"), { width: 512, height: 512, viewBox: null });
  assert.equal(svgSize("<p>not a drawing</p>"), null);
});

test("the relief OBJ and the voxel OBJ read back as meshes whose faces all resolve", () => {
  const grid = [[0, 0.5, 1], [0.25, 0.5, 0.75], [1, 0.5, 0]];
  const reliefText = heightGridToObj(grid, 10);
  const relief = parseOBJ(reliefText);
  assert.equal(relief.vertices.length, 9);
  assert.equal(relief.faces.length, 8);
  assert.equal(discriminateOBJText(reliefText), true);
  assert.equal(relief.vertices[2][2], 10, "luma 1 stands at the full depth");

  const vox = voxelizeHeightGrid(grid, 4);
  const shellText = voxelObj(vox);
  const shell = parseOBJ(shellText);
  assert.ok(voxelCount(vox) > 0 && shell.faces.length > 0);
  assert.equal(discriminateMesh(shell.vertices.length, shell.faces), true);
});

test("jpegToPdf: every xref offset lands on its object and the stream length is the JPEG length", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 400, 200, { paper: "letter" });
  const text = Buffer.from(pdf).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4\n"));
  assert.ok(text.endsWith("%%EOF\n"));
  const xrefStart = Number(/startxref\n(\d+)\n/.exec(text)[1]);
  assert.equal(text.slice(xrefStart, xrefStart + 9), "xref\n0 6\n");
  const rows = text.slice(xrefStart).split("\n").slice(3, 8);
  rows.forEach((row, i) => {
    const off = Number(row.slice(0, 10));
    assert.equal(text.slice(off, off + 7), (i + 1) + " 0 obj", "object " + (i + 1));
  });
  assert.match(text, /\/Filter \/DCTDecode \/Length 13 >>/);
  assert.match(text, /\/MediaBox \[0 0 792 612\]/, "a landscape image turns the letter page");
  const at = text.indexOf("stream\n") + 7;
  assert.deepEqual(Array.from(pdf.subarray(at, at + jpeg.length)), Array.from(jpeg));
  // 400 x 200 on 792 x 612 inside a 6% margin: scale = 696.96 / 400.
  assert.match(text, /696\.96 0 0 348\.48 47\.52 131\.76 cm/);
});

test("jpegToPdf refuses bytes that are not a JPEG, and a missing size", () => {
  assert.throws(() => jpegToPdf(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), 4, 4), TypeError);
  assert.throws(() => jpegToPdf(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), 0, 4), RangeError);
});
