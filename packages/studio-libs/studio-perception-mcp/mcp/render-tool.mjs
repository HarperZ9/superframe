// render-tool.mjs — render an nD object, then PERCEIVE the render (the generate→perceive loop, native).
export function makeRenderTool({ render, sense, intake }) {
  const renderTool = {
    name: "render_nd",
    description: "Render a 1-D…10-D polytope (cube/simplex/orthoplex/24cell) with full nD rotation + a chosen projection, then perceive the rendered frame. Returns the layered readout + the rendered image.",
    inputSchema: { type: "object", properties: {
      kind: { type: "string", enum: ["cube", "simplex", "orthoplex", "24cell"] },
      n: { type: "number", minimum: 1, maximum: 10 }, t: { type: "number" },
      rotation: { type: "string", enum: ["all", "isoclinic"] },
      projection: { type: "string", enum: ["perspective", "orthographic", "stereographic"] },
      width: { type: "number" }, height: { type: "number" } } },
    handler: async (a) => {
      const width = a.width || 384, height = a.height || 384;
      const scene = render.renderScene({ kind: a.kind || "cube", n: a.n || 4, t: a.t || 0,
        rotation: a.rotation || "all", projection: { mode: a.projection || "perspective", dist: 3 } });
      const fb = render.rasterize(scene, { width, height });
      const readout = sense.assembleFullPerception(fb.data, width, height, 4, { source: "render_nd" });
      readout.meta = scene.meta;
      const bmp = intake.writeBMP24(fb).toString("base64");
      return { content: [{ type: "text", text: JSON.stringify(readout) }, { type: "image", data: bmp, mimeType: "image/bmp" }] };
    },
  };
  return { renderTool };
}
