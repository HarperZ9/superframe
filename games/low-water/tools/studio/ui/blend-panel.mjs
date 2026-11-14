// The blend panel: per region, how much of the paint shows over the underpainting (0: the
// underpainting's own strokes; 1: the paint at full strength). Each change is one undoable record.
import { el, slider } from "./dom.mjs";
import { REGIONS, OVER } from "../core/blend.mjs";

export function blendPanel(app, ops) {
  const d = app.sitting?.doc; if (!d?.ref) return null;
  const v = d.meta.blend || {};
  return el("section", {}, el("h2", {}, "Underpainting and paint"), el("p", { class: "hint" }, "0 shows the underpainting's strokes, 1 the paint."),
    ...Object.keys({ ...REGIONS, ...OVER }).map((k) => slider(k, v[k] ?? 1, 0, 1, 0.05, null, (x) => ops.blend(k, x))));
}
