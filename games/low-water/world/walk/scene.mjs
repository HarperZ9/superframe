// What stands on the island, as the frame loop sees it: one object that updates each part for
// the walker's place and draws the parts in order. The masses (masses.mjs) are the placeholder
// architecture of the regions not yet built at ground level.
import { MESHES, architecture, flora } from "./masses.mjs";

export async function makeScene({ dev, stage, world, quality, vbuf }) {
  const massM = await stage.module("mass.wgsl");
  const massBuffers = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }] },
    { arrayStride: 48, stepMode: "instance", attributes: [{ shaderLocation: 2, offset: 0, format: "float32x4" }, { shaderLocation: 3, offset: 16, format: "float32x4" }, { shaderLocation: 4, offset: 32, format: "float32x4" }] }];
  const massPipe = stage.pipe(massM, "vsMass", "fsMass", massBuffers);
  const meshBuf = Object.fromEntries(Object.entries(MESHES).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 6 }]));
  const arch = architecture(world), archBuf = Object.fromEntries(Object.entries(arch).filter(([, v]) => v.length).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 12 }]));
  const FLORA_MAX = 90000, mk = () => ({ buf: dev.createBuffer({ size: FLORA_MAX * 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }), count: 0 }), floraBuf = { cone: mk(), cyl: mk() };
  let floraAt = [1e12, 1e12];
  function growFlora(x, z) {
    if (Math.hypot(x - floraAt[0], z - floraAt[1]) < 6) return;
    floraAt = [x, z];
    const f = flora(world, x, z, 2200 * quality, 26 * Math.min(1, quality * 1.5));
    for (const k of ["cone", "cyl"]) { const n = Math.min(FLORA_MAX, f[k].length / 12); floraBuf[k].count = n; if (n) dev.queue.writeBuffer(floraBuf[k].buf, 0, f[k], 0, n * 12); }
  }
  return {
    update({ cam }) { growFlora(cam.x, cam.z); },
    draw(pass) {
      pass.setPipeline(massPipe);
      for (const set of [archBuf, floraBuf]) for (const [k, b] of Object.entries(set)) if (b.count) { pass.setVertexBuffer(0, meshBuf[k].buf); pass.setVertexBuffer(1, b.buf); pass.draw(meshBuf[k].count, b.count); }
    },
    drawAir() {}, shadow() {}, before() {},
    stats() { return { trees: floraBuf.cone.count + floraBuf.cyl.count, triangles: Object.values(floraBuf).reduce((a, b) => a + b.count * 14, 0) }; },
  };
}
