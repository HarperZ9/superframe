// What stands on the island, as the frame loop sees it: one object that updates each part for
// the walker's place and draws the parts in order. The forest is grown by rule (flora/); the
// masses (masses.mjs) are the placeholder architecture of the regions not yet built at ground level.
import { MESHES, architecture } from "./masses.mjs";
import { drawAtlas, uploadAtlas } from "./flora/atlas.mjs";
import { makeForest } from "./flora/forest.mjs";
import { makeUnderstory } from "./flora/understory.mjs";

export async function makeScene(ctx) {
  const { stage, world, vbuf, say } = ctx;
  say("Drawing the leaves");
  stage.set("atlas", uploadAtlas(ctx.dev, drawAtlas(world.json.seed)));
  const massM = await stage.module("mass.wgsl");
  const massBuffers = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }] },
    { arrayStride: 48, stepMode: "instance", attributes: [{ shaderLocation: 2, offset: 0, format: "float32x4" }, { shaderLocation: 3, offset: 16, format: "float32x4" }, { shaderLocation: 4, offset: 32, format: "float32x4" }] }];
  const massPipe = stage.pipe(massM, "vsMass", "fsMass", massBuffers);
  const meshBuf = Object.fromEntries(Object.entries(MESHES).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 6 }]));
  const arch = architecture(world), archBuf = Object.fromEntries(Object.entries(arch).filter(([, v]) => v.length).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 12 }]));
  say("Growing the forest");
  const forest = await makeForest(ctx), parts = [forest, makeUnderstory(ctx, forest)];
  return {
    forest,
    update(f) { for (const p of parts) p.update(f); },
    draw(pass, which) {
      pass.setPipeline(massPipe);
      for (const [k, b] of Object.entries(archBuf)) { pass.setVertexBuffer(0, meshBuf[k].buf); pass.setVertexBuffer(1, b.buf); pass.draw(meshBuf[k].count, b.count); }
      for (const p of parts) p.draw(pass, which);
    },
    drawAir() {}, shadow() {}, before() {},
    stats() { return Object.assign({}, ...parts.map((p) => p.stats())); },
  };
}
