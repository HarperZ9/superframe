// The aged pages in the game (the UI art lead's, 2026-10-21): every paper panel of a story that opts in
// (@meta ui-era) gets its own page from ui/paper.mjs, seeded by the panel and the run, so no two match.
// A page is made when the panel first shows and again when its size changes; one page a frame at most.
// When the record takes an event (community.record), the burn on the record's pages creeps: the talk
// page and the HUD are made again over a second with the edge eaten a little further. Nothing per frame
// otherwise. Glyph mode and the plain-text setting take none (era.css draws them plain).
//   installAged({ root, G }) -> { stop, burn(), bind(G) (a new game) }
import { paperPixels } from "./paper.mjs";

export const PAPER = { ".talk": "talk", ".dbook": "book", ".hud": "chip", ".placecard": "sheet", ".lenspanel": "sheet", ".here": "sheet", ".chip": "chip", ".toast": "chip", ".leaf": "sheet", ".menu": "sheet", ".strip": "sheet", ".vl": "chip", ".gearcard": "chip", ".edgemark": "chip", ".hint.prompts": "chip" };
const SEL = Object.keys(PAPER).join(", ");
const RECORD_PAGES = new Set(["talk", "chip"]);

export function installAged({ root = document.body, G = null, runSeed = 1 } = {}) {
  const era = () => +document.body.dataset.uiEra || 0, off = () => !era() || document.documentElement.classList.contains("look-glyph-ui") || document.documentElement.classList.contains("plaintext");
  let count = 0, burn = 0, stopped = false; const queue = new Set(), urls = new WeakMap();
  const kindOf = (el) => PAPER[Object.keys(PAPER).find((s) => el.matches(s))] || "sheet";
  // the pixels off the frame in a worker (a talk page is about 24 ms); in this thread where workers fail
  let worker = null, wid = 0; const waiting = new Map();
  try { worker = new Worker(new URL("./paperworker.mjs", import.meta.url), { type: "module" }); worker.onmessage = (e) => { const W = waiting.get(e.data.id); waiting.delete(e.data.id); if (W) (e.data.error ? W.no(new Error(e.data.error)) : W.ok(e.data)); }; worker.onerror = (e) => { console.warn(`aged: worker failed (${e.message}); pages in this thread`); worker = null; for (const W of waiting.values()) W.no(new Error("worker failed")); waiting.clear(); }; }
  catch (e) { console.warn(`aged: no worker (${e.message}); pages in this thread`); }
  const pixels = (opts) => (worker ? new Promise((ok, no) => { const id = ++wid; waiting.set(id, { ok, no }); worker.postMessage({ id, opts }); }) : Promise.resolve(paperPixels(opts)));
  let raf = 0; const kick = () => { if (!raf && !stopped) raf = requestAnimationFrame(pump); };
  const ro = new ResizeObserver((es) => { for (const e of es) queue.add(e.target); kick(); });
  function adopt(el) {
    if (el.dataset.paperSeed) return;
    el.dataset.paperSeed = String((Math.imul(++count, 2654435761) ^ runSeed) >>> 0); el.classList.add("aged");
    ro.observe(el); queue.add(el); kick();
  }
  function make(el) {
    if (!el.isConnected || off()) return;
    const r = el.getBoundingClientRect(), w = Math.round(r.width / 4) * 4, h = Math.round(r.height / 4) * 4; if (w < 16 || h < 16) return;
    const kind = kindOf(el), b = RECORD_PAGES.has(kind) ? burn : 0, key = `${era()}|${w}|${h}|${b.toFixed(2)}`;
    if (el.dataset.paperKey === key) return; el.dataset.paperKey = key;
    const opts = { w, h, era: era(), seed: +el.dataset.paperSeed, kind, scale: Math.min(1, 560 / Math.max(w, h)), burn: b ? Math.min(1.2, (paperBurn(era()) || 0.2) + b) : null };
    pixels(opts).then((base) => { if (el.dataset.paperKey === key) show(el, key, base); }).catch((e) => console.error(`aged: ${e.message}`));
  }
  function show(el, key, base) {
    const c = document.createElement("canvas"); c.width = base.w; c.height = base.h;
    c.getContext("2d").putImageData(new ImageData(base.data, base.w, base.h), 0, 0);
    c.toBlob((blob) => { if (!blob || el.dataset.paperKey !== key) return; const old = urls.get(el), url = URL.createObjectURL(blob); urls.set(el, url); el.style.setProperty("--paper-img", `url(${url})`); if (old) setTimeout(() => URL.revokeObjectURL(old), 500); });
  }
  // one page a frame, and no frame asked for while nothing waits
  function pump() { raf = 0; if (stopped) return; const el = queue.values().next().value; if (!el) return; queue.delete(el); try { make(el); } catch (e) { console.error(`aged: ${e.message}`); } kick(); }
  const scan = (n) => { if (!(n instanceof Element)) return; if (n.matches(SEL)) adopt(n); for (const e of n.querySelectorAll(SEL)) adopt(e); };
  const mo = new MutationObserver((list) => { if (!era()) return; for (const m of list) for (const n of m.addedNodes) scan(n); });
  mo.observe(root, { childList: true, subtree: true });
  scan(root);
  const redo = () => { for (const el of root.querySelectorAll(".aged")) { el.dataset.paperKey = ""; queue.add(el); } kick(); };
  window.addEventListener("lw:restyle", redo);
  // the burn creeps over about a second, in four steps, when an event goes on the record
  const creep = () => { const to = Math.min(0.9, burn + 0.12); let k = 0; const step = () => { if (stopped) return; burn += (to - burn) / (4 - k); k++; for (const el of root.querySelectorAll(".talk.aged, .hud.aged")) { el.dataset.paperKey = ""; queue.add(el); } kick(); if (k < 4) setTimeout(step, 260); }; step(); };
  let offRec = null;
  const bind = (g) => { if (offRec) offRec(); burn = 0; offRec = g && g.on ? g.on("community.record", creep) : null; };
  bind(G);
  return { burn: creep, redo, bind, stop() { stopped = true; if (worker) worker.terminate(); mo.disconnect(); ro.disconnect(); window.removeEventListener("lw:restyle", redo); if (offRec) offRec(); } };
}
const paperBurn = (era) => ({ 1: 0.35, 2: 0.8, 3: 0.45, 4: 0.15, 5: 0.05 })[era];
