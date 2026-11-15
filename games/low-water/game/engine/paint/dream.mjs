// The dream look (the story lead's precognitive dreams between nights: Lamb sees fragments of scenes to come,
// which later play out exactly). One hook for the story side, both renderers answering it:
//   globalThis.__lwDream.set(k)   k 0..1: how far into the dream the view is (ease it in and out as you like)
//   globalThis.__lwDream.cue()    the recognition cue when the real scene arrives: the dream look for one
//                                 frame (two at 30 fps), then straight back
//   ?dream=0.8 sets it from the address (stills and tests)
// Painted: strokes loosen (the brush painter paints figures with longer, broader strokes, its broken colour
// stronger), the colour drifts off the hour's palette (a slow hue drift and less saturation over the whole
// view), and the edges go soft (a blurred vignette ring). Glyph: the tone map washes toward its middle,
// half the type goes missing by blue noise (world-anchored, so it does not crawl), and what remains drops to
// lighter, half-formed glyphs. Original code.
const LAYERS = "canvas.platecam-img, canvas.paintlight, canvas.weathercanvas, canvas.peoplecanvas, canvas.fightcanvas";
export function installDream({ root, glyph }) {
  const D = { k: 0, cueUntil: 0, raf: 0 };
  const veil = document.createElement("div"); veil.className = "dreamveil";
  veil.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;backdrop-filter:blur(3px);-webkit-mask-image:radial-gradient(ellipse at center, transparent 45%, black 85%);mask-image:radial-gradient(ellipse at center, transparent 45%, black 85%)";
  // the soft edge sits just over the painted layers and under the paper UI (placed after the people layer each frame)
  const place = () => { const p = root.querySelector("canvas.fightcanvas") || root.querySelector("canvas.peoplecanvas"); if (p && p.parentElement && p.nextSibling !== veil) p.after(veil); else if (!veil.isConnected) root.append(veil); };
  const apply = (k, t) => {
    if (k > 0) place(); globalThis.__lwDreamK = k;   // read by paint/install.mjs for the brush painter
    const glyphOn = glyph && glyph.canvas && !glyph.canvas.hidden;   // glyph mode dreams in its own type (compose.mjs); the grid's panels stay sharp
    const f = k > 0 && !glyphOn ? `saturate(${(1 - 0.45 * k).toFixed(3)}) hue-rotate(${(k * (18 + 14 * Math.sin(t / 1300))).toFixed(1)}deg) blur(${(0.6 * k).toFixed(2)}px) brightness(${(1 + 0.08 * k).toFixed(3)})` : "";
    for (const el of root.querySelectorAll(LAYERS)) if (el.style.filter !== f) el.style.filter = f;   // the painted layers only: the paper UI stays sharp
    veil.style.opacity = glyphOn ? "0" : k.toFixed(3);
    if (glyph) { const g = glyph.opts; if (Math.abs((g.dream || 0) - k) > 0.02 || (k === 0 && g.dream)) { g.dream = k; glyph.state.key = ""; } }
  };
  const tick = (t) => { D.raf = requestAnimationFrame(tick); const k = t < D.cueUntil ? 1 : D.k; apply(k, t); };
  D.raf = requestAnimationFrame(tick);
  const api = { set(k) { D.k = Math.max(0, Math.min(1, +k || 0)); }, cue() { D.cueUntil = performance.now() + 40; }, get k() { return D.k; }, stop() { cancelAnimationFrame(D.raf); apply(0, 0); veil.remove(); } };
  globalThis.__lwDream = api;
  const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("dream") : null; if (q != null) api.set(+q);
  return api;
}
