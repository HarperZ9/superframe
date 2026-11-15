// The close look at a prop (the author's reference, RENDER-INSPIRATION section 16: retro interiors where the camera
// pushes in slowly on objects and the objects tell the story). A @prop with macro: (world/props.mjs) gets, when
// examined: a slow push-in on its plate mark (ui/platecam.mjs macro), a shallow-focus request to the effects lead's
// camera post (event camera.focus { at, range } and globalThis.__lwFocusRequest, read by the depth of field in
// game/engine/fx/post.mjs if they wire it), and the prop's text once the camera has settled. Any key, click or pad
// press skips straight to the text; the look lets go at the next input or after a few seconds. It never runs
// under reduced motion, with "Close looks" off in the settings, or where the plate has no mark for the prop: then
// the text comes at once, as for any verb.
//   examineLook(ctx, api, lines, show)      show(lines) is called once, now or when the look has settled
import { h } from "./dom.mjs";
import { notify } from "./notify.mjs";
const HOLD_MS = 6000;

// what a prop says, as a note card in the margin (free roam has no talk panel open, so a verb's lines would land in
// a log nobody can see); it stays for its reading time. For any examined prop, with or without the close look.
export function propNote(ctx, lines) {
  for (const l of lines.filter((x) => x.prop)) {
    const p = ctx.G && ctx.G.props ? ctx.G.props.all[l.prop] : null, words = String(l.text).split(/\s+/).length;
    notify({ kind: "look", text: l.text, node: h("div.look.sheet.fade-in", h("div.caps", p ? p.name : ""), h("p", l.text)), ms: 4000 + 300 * words, fold: false });
  }
}

export function examineLook(ctx, api, lines, show) {
  const m = lines.find((l) => l.macro), prefs = ctx.prefs || {}, cam = api && api.cam;
  if (!m || prefs.calm || prefs.closeLooks === false || !cam || !cam.macro) return show(lines);
  const pj = cam.place && cam.place(), spot = pj && pj.marks && (pj.marks.spots || []).find((s) => s.id === m.macro.mark);
  if (!spot || !spot.at) return show(lines);
  const at = [spot.at[0], spot.at[1] + (m.macro.height ?? 0.9), spot.at[2]], G = ctx.G; // marks are on the floor; the thing sits on a table or a shelf
  let shown = false, timer = 0, holdT = 0;
  const focus = (on) => { globalThis.__lwFocusRequest = on ? { at, range: 0.5, prop: m.prop } : null; if (G) G.emit("camera.focus", on ? { at, range: 0.5, prop: m.prop } : { at: null }); };
  const release = () => { clearInterval(timer); clearTimeout(holdT); removeEventListener("keydown", onInput, true); removeEventListener("pointerdown", onInput, true); removeEventListener("gamepadbutton", onInput, true); cam.macro(null); focus(false); };
  const reveal = () => { if (shown) return; shown = true; clearInterval(timer); show(lines); holdT = setTimeout(release, HOLD_MS); };
  // the first input skips to the text; the next lets the look go
  function onInput() { if (!shown) { cam.macro(at, { zoom: m.macro.zoom, skip: true }); reveal(); } else release(); }
  addEventListener("keydown", onInput, true); addEventListener("pointerdown", onInput, true); addEventListener("gamepadbutton", onInput, true);
  cam.macro(at, { zoom: m.macro.zoom, secs: m.macro.secs }); focus(true);
  timer = setInterval(() => { if (cam.macroSettled()) reveal(); }, 100);
  if (G) G.emit("examine.macro", { prop: m.prop, at, zoom: m.macro.zoom, secs: m.macro.secs });
  return null;
}
