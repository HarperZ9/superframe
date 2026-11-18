// The built places that are made at ground level: the snow town and its villages (town.mjs) and
// the works (works.mjs). Each is a site: a plan made at start (cheap: where things stand, so the
// near maps and the forest know), and a mesh with its lamps made when the walker first comes
// within reach.
import * as town from "./town.mjs";
import * as works from "./works.mjs";

export async function makeBuilt({ dev, stage, world, roads, near, lights, vbuf }) {
  const mod = await stage.module("materials.wgsl", "built.wgsl");
  const layout = [{ arrayStride: 48, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }, { shaderLocation: 2, offset: 24, format: "float32x2" }, { shaderLocation: 3, offset: 32, format: "float32x4" }] },
    { arrayStride: 16, stepMode: "instance", attributes: [{ shaderLocation: 4, offset: 0, format: "float32x4" }] }];
  const pipe = stage.pipe(mod, "vsBuilt", "fsBuilt", layout), shadowPipe = stage.pipe(mod, "vsBuilt", "fsBuiltShadow", layout, { format: null });
  const sites = [];
  for (const s of world.json.settlements) if (s.region === 1) { const P = town.plan(world, roads, s); sites.push({ x: P.cx, z: P.cz, reach: P.reach, from: 2600, stamp: (t) => town.stamp(P, t), build: () => town.mesh(world, P, lights), plan: P }); }
  for (const P of works.plans(world)) sites.push({ x: P.cx, z: P.cz, reach: P.reach, from: 9000, stamp: (t) => works.stamp(P, t), build: () => works.mesh(world, P, lights), plan: P });
  near.stampers.push((t) => { for (const s of sites) if (Math.abs(s.x - (t.ox + t.N / 2)) < t.N / 2 + s.reach && Math.abs(s.z - (t.oz + t.N / 2)) < t.N / 2 + s.reach) s.stamp(t); });
  let tris = 0;
  function update({ cam }) {
    // one site a frame at most: a town is a few megabytes of vertices
    const s = sites.find((q) => !q.buf && Math.hypot(q.x - cam.x, q.z - cam.z) < q.from + q.reach);
    if (!s) return;
    const m = s.build();
    s.buf = vbuf(m.data); s.n = m.data.length / 12; s.inst = vbuf(new Float32Array([m.origin[0], m.origin[1], m.origin[2], 0])); tris += s.n / 3;
  }
  function draw(pass, which) {
    pass.setPipeline(which === "shadow" ? shadowPipe : pipe);
    for (const s of sites) if (s.buf) { pass.setVertexBuffer(0, s.buf); pass.setVertexBuffer(1, s.inst); pass.draw(s.n, 1); }
  }
  // settlements and landmarks that are drawn here and so must not be drawn as placeholder masses
  const owns = { settlement: (s) => s.region === 1, mark: (m) => works.owns(m) };
  return { sites, update, draw, owns, stats: () => ({ builtTriangles: tris, sites: sites.filter((s) => s.buf).length }) };
}
