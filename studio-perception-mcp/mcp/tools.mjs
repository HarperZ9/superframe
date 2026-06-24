// tools.mjs — the MCP tool definitions. Perception readouts are sense-core's assembleFullPerception.
function readoutContent(sense, intake, frame, source) {
  const readout = sense.assembleFullPerception(frame.data, frame.width, frame.height, 4, { source });
  readout.description = sense.describeFrame(sense.richFeatures(frame.data, frame.width, frame.height, 4));
  const bmp = intake.writeBMP24(frame).toString("base64");
  return { content: [{ type: "text", text: JSON.stringify(readout) }, { type: "image", data: bmp, mimeType: "image/bmp" }] };
}
export function makeTools({ sense, render, intake, live }) {
  const tools = [
    { name: "perceive_image", description: "Perceive an image file or base64 → complete layered readout (+ raw pixels).",
      inputSchema: { type: "object", properties: { path: { type: "string" }, base64: { type: "string" } } },
      handler: async (a) => { const f = await intake.toRGBA(a); live.setSource(f); return readoutContent(sense, intake, f, "image"); } },
    { name: "perceive_screen", description: "Capture the screen (optional region) → complete layered readout (+ raw pixels).",
      inputSchema: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } } },
      handler: async (a) => { const f = await intake.toRGBA({ screen: a }); live.setSource(f); return readoutContent(sense, intake, f, "screen"); } },
    { name: "measure", description: "Re-read the current live source → readout (poll a changing subject).",
      inputSchema: { type: "object", properties: {} },
      handler: async () => { const f = live.current(); if (!f) throw new Error("no live source yet — call perceive_screen/perceive_image first"); return readoutContent(sense, intake, f, "live"); } },
  ];
  if (render) tools.push(render.renderTool); // added in 4.4
  return tools;
}
