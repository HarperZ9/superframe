// The canvas a person paints on: shows the painting or a reference pass, redraws only what changed, and
// holds the view (zoom, pan, rotate, mirror). The view never changes the painting; pointer positions are
// mapped back through it (toCanvas). An overlay above the canvas draws the brush cursor and the lasso.
// When the active layer is a mask, the area it clips away is tinted (state colour), so its clip shows.
//   createView(el, app) -> { draw(rect?), fit(), setMode(mode), toCanvas(e), toClient(x, y), view, overlay }
import { lum, edgesToRgba } from "../core/passes.mjs";
import { layerById } from "../core/doc.mjs";
import { formView } from "../core/form.mjs";

export const MODES = { paint: "Painting", form: "Form light", value: "Value check", ref: "Reference: colour", refvalue: "Reference: value", edges: "Reference: edges", under: "Underpainting" };
const FLAG = [0.86, 0.55, 0.12];   // state colour: needs repainting, or clipped away by the active mask

function sourceFor(app, mode) {
  const s = app.sitting, d = s.doc;
  if (mode === "ref" && s.ref) return s.ref.colour;
  if (mode === "refvalue" && s.ref) return s.ref.value;
  if (mode === "edges" && s.ref) return s._edges || (s._edges = edgesToRgba(s.ref.edges, d.w, d.h));
  if (mode === "under") return d.layers[0].rgba;
  if (mode === "form") return formView(d);   // the painted planes, lit by the key
  return d.out;
}
function paintRect(app, img, rect, mode) {
  const d = app.sitting.doc, src = sourceFor(app, mode), grey = mode === "value" || app.valueCheck, flags = app.showFlags ? d.meta.repaint : null, bg = 0.32;
  const act = layerById(d, d.active), clip = act?.kind === "mask" ? act.rgba : null;
  for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) {
    const i = y * d.w + x, a = src[i * 4 + 3] ?? 1; let r = src[i * 4] * a + bg * (1 - a), g = src[i * 4 + 1] * a + bg * (1 - a), b = src[i * 4 + 2] * a + bg * (1 - a);
    if (grey) r = g = b = lum(r, g, b);
    const f = (flags && flags[i] ? 0.5 : 0) || (clip ? 0.45 * (1 - clip[i * 4 + 3]) : 0);
    if (f) { r = r * (1 - f) + FLAG[0] * f; g = g * (1 - f) + FLAG[1] * f; b = b * (1 - f) + FLAG[2] * f; }
    const o = i * 4; img.data[o] = r * 255; img.data[o + 1] = g * 255; img.data[o + 2] = b * 255; img.data[o + 3] = 255;
  }
}

export function createView(el, app) {
  const cv = el.querySelector("canvas"), g = cv.getContext("2d"), overlay = el.querySelector("canvas.overlay"), view = { zoom: 1, pan: [0, 0], rot: 0, flip: false };
  let img = null, mode = "paint";
  const doc = () => app.sitting?.doc;
  function draw(rect = null) {
    const d = doc(); if (!d) return;
    if (cv.width !== d.w || cv.height !== d.h || !img) { cv.width = d.w; cv.height = d.h; img = g.createImageData(d.w, d.h); rect = null; fit(); }
    const r = rect || { x0: 0, y0: 0, x1: d.w, y1: d.h }; paintRect(app, img, r, mode);
    g.putImageData(img, 0, 0, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  }
  function place() {
    const d = doc(); if (!d) return;
    cv.style.width = `${d.w * view.zoom}px`; cv.style.height = `${d.h * view.zoom}px`;
    cv.style.transform = `translate(${view.pan[0]}px, ${view.pan[1]}px) rotate(${view.rot}deg) scaleX(${view.flip ? -1 : 1})`;
    overlay.width = el.clientWidth; overlay.height = el.clientHeight;
  }
  function fit() { const d = doc(); if (!d) return; view.zoom = Math.min((el.clientWidth - 24) / d.w, (el.clientHeight - 24) / d.h); view.pan = [0, 0]; place(); }
  // the canvas's centre on screen (the stage centres it; pan moves it)
  const centre = () => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2 + view.pan[0], b.top + b.height / 2 + view.pan[1]]; };
  function toCanvas(e) {
    const [cx, cy] = centre(), a = (-view.rot * Math.PI) / 180; let vx = e.clientX - cx, vy = e.clientY - cy;
    [vx, vy] = [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)]; if (view.flip) vx = -vx;
    return [vx / view.zoom + cv.width / 2, vy / view.zoom + cv.height / 2];
  }
  function toClient(x, y) {   // canvas point -> overlay point
    const b = el.getBoundingClientRect(), [cx, cy] = centre(), a = (view.rot * Math.PI) / 180; let vx = (x - cv.width / 2) * view.zoom, vy = (y - cv.height / 2) * view.zoom;
    if (view.flip) vx = -vx; return [cx - b.left + vx * Math.cos(a) - vy * Math.sin(a), cy - b.top + vx * Math.sin(a) + vy * Math.cos(a)];
  }
  el.addEventListener("wheel", (e) => { e.preventDefault(); view.zoom = Math.max(0.1, Math.min(8, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); place(); }, { passive: false });
  addEventListener("resize", () => place());
  return { draw, fit, place, toCanvas, toClient, view, overlay, canvas: cv, setMode(m) { mode = m; draw(); }, get mode() { return mode; } };
}
