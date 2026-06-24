import { test } from "node:test";
import assert from "node:assert/strict";
import * as render from "../../render-nd/index.mjs";
import { rasterize } from "../../render-nd/backends/raster.mjs";
import * as sense from "../../sense-core/index.mjs";
import { writeBMP24 } from "../mcp/intake.mjs";
import { makeRenderTool } from "../mcp/render-tool.mjs";

const tool = makeRenderTool({ render: { ...render, rasterize }, sense, intake: { writeBMP24 } }).renderTool;

test("render_nd renders an nD object and perceives it (edges → edgeDensity>0)", async () => {
  const r = await tool.handler({ kind: "cube", n: 4, t: 0.4, width: 192, height: 192 });
  const readout = JSON.parse(r.content[0].text);
  assert.equal(readout.meta.vertices, 16);
  assert.equal(readout.meta.edges, 32);
  assert.ok(readout.edgeDensity > 0, "a rendered wireframe must have measurable edges");
  assert.equal(r.content[1].type, "image");
});
test("render_nd handles n=1..10 and each kind", async () => {
  for (let n = 1; n <= 10; n++) assert.ok((await tool.handler({ kind: "cube", n, width: 96, height: 96 })).content.length === 2);
  for (const kind of ["simplex", "orthoplex", "24cell"]) assert.ok(await tool.handler({ kind, n: 4, width: 96, height: 96 }));
});
