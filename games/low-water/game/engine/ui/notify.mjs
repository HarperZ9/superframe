// One notification stack for the play screen (coordinator's review, 2026-10-21: FOUND cards stacked on
// each other, PACK tags over them, and both over the place menu; author: a "seamless and intuitive UI").
// Everything that used to toast goes through here:
//   - one column, spaced, at most MAX_SHOWN items; more wait in a queue and show as earlier ones leave;
//   - a note of the same kind arriving while one shows is folded into it ("PACK  The greatcoat, the
//     bowler, a storm lantern"), and its time restarts, so a burst of gains is one line;
//   - the column sits in the margin the panels leave: top right under the top bar while Lamb walks (the
//     place menu is bottom left), top left under the HUD while the talk panel holds the right side; its
//     height is held above any open panel in that column, and what does not fit waits;
//   - cards (a found tool) are items like the others, taller.
//   notify({ kind, text, node, ms, fold })    returns the item's element (or null while queued)
//   placeStack()                              re-place now (the play screen calls it when panels move)
import { h } from "./dom.mjs";

export const MAX_SHOWN = 3, GAP = 6, FOLD_MS = 1500;
const shown = [], queue = [];
let timer = 0;

const box = () => (typeof document !== "undefined" ? document.getElementById("toasts") : null);
// panels a note must never cover, when they are on screen
const PANELS = ["aside.talk", ".screen.play .here", ".fightlayer .dock", ".fightstrip", ".talkoffer", ".hud", ".topbar", ".pause", ".daybook"];
export function panelRects(doc = document) {
  const out = [];
  for (const sel of PANELS) for (const el of doc.querySelectorAll(sel)) {
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.05 || el.inert || el.hidden) continue;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    out.push({ sel, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}
export const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The column: which side, its top, and the height it may use without reaching a panel below it.
export function columnFor(view, rects, width) {
  const talk = rects.find((r) => r.sel === "aside.talk" && r.x > view.w * 0.4);
  const side = talk ? "left" : "right";
  const x = side === "left" ? 16 : view.w - width - 16;
  // start below whatever sits at the top of this column (the HUD card or the top bar)
  const col = { x, w: width };
  let top = 16;
  for (const r of rects) if (r.x < col.x + col.w && col.x < r.x + r.w && r.y < view.h * 0.25) top = Math.max(top, r.y + r.h + 8);
  let bottom = view.h - 16;
  for (const r of rects) if (r.x < col.x + col.w && col.x < r.x + r.w && r.y >= top) bottom = Math.min(bottom, r.y - 8);
  return { side, x, top, bottom };
}

export function placeStack() {
  const B = box(); if (!B || window.__lwNoPlace) return;   // __lwNoPlace: the visual check's control pins the stack
  const view = { w: window.innerWidth, h: window.innerHeight }, width = Math.min(352, view.w - 32);
  const c = columnFor(view, panelRects(), width);
  Object.assign(B.style, { position: "fixed", left: `${c.x}px`, top: `${c.top}px`, right: "auto", transform: "none", width: `${width}px`, display: "flex", flexDirection: "column", gap: `${GAP}px`, alignItems: c.side === "left" ? "flex-start" : "flex-end" });
  B.dataset.side = c.side;
  // anything that would run past the bottom goes back to the front of the queue
  let used = 0;
  for (const it of [...shown]) {
    const hgt = it.el.getBoundingClientRect().height || 40;
    if (c.top + used + hgt > c.bottom && it !== shown[0]) { hide(it, true); continue; }
    used += hgt + GAP;
  }
}

function hide(it, requeue = false) {
  const i = shown.indexOf(it); if (i < 0) return;
  shown.splice(i, 1); clearTimeout(it.t); it.el.remove();
  if (requeue) queue.unshift(it.spec);
  pump();
}
function pump() {
  while (shown.length < MAX_SHOWN && queue.length) show(queue.shift());
}
function show(spec) {
  const B = box(); if (!B) return null;
  const el = spec.node || h("div.toast.fade-in", h("span.caps", spec.kind), h("span.ttext", spec.text));
  el.classList.add("note");
  const it = { spec, el, kind: spec.kind, at: performance.now(), t: 0 };
  it.t = setTimeout(() => hide(it), spec.ms || 3200);
  shown.push(it); B.append(el);
  placeStack();
  return el;
}

export function notify(spec) {
  // fold: a plain note of the same kind still young takes this text into its own line
  if (!spec.node && spec.fold !== false) {
    const same = shown.find((x) => !x.spec.node && x.kind === spec.kind && performance.now() - x.at < FOLD_MS * 2);
    if (same) {
      const t = same.el.querySelector(".ttext"); if (t) t.textContent = `${t.textContent}, ${spec.text}`;
      same.at = performance.now(); clearTimeout(same.t); same.t = setTimeout(() => hide(same), spec.ms || 3200);
      return same.el;
    }
    const q = queue.find((x) => !x.node && x.kind === spec.kind);
    if (q) { q.text = `${q.text}, ${spec.text}`; return null; }
  }
  if (shown.length >= MAX_SHOWN) { queue.push(spec); return null; }
  return show(spec);
}

// keep the column in its margin as panels open and close
export function watchStack() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => { if (shown.length) placeStack(); }, 250);
  window.addEventListener("resize", placeStack);
}
export const _state = () => ({ shown: shown.length, queued: queue.length });
