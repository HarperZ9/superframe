// SPDX-License-Identifier: FSL-1.1-MIT
// Scene IR to triangles, JavaScript twin of scene_ir.py (same order as raw-native).
const quad = (a, b, c, d, n, alb) => [[[a, b, c], n, alb], [[a, c, d], n, alb]];

function box(c, h, alb) {
  const [x0, y0, z0] = [c[0] - h, c[1] - h, c[2] - h];
  const [x1, y1, z1] = [c[0] + h, c[1] + h, c[2] + h];
  const faces = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
  ];
  return faces.flatMap(([a, b, cc, d, n]) => quad(a, b, cc, d, n, alb));
}

export function triangles(scene) {
  const tris = [];
  for (const m of scene.meshes) {
    if (m.shape === 'quad') tris.push(...quad(...m.corners, m.normal, m.albedo));
    else if (m.shape === 'box') tris.push(...box(m.center, m.half, m.albedo));
    else throw new Error('unsupported shape ' + m.shape);
  }
  return {
    verts: new Float32Array(tris.flatMap((t) => t[0].flat())),
    normals: new Float32Array(tris.flatMap((t) => t[1])),
    albedo: new Float32Array(tris.flatMap((t) => t[2])),
    count: tris.length,
  };
}
