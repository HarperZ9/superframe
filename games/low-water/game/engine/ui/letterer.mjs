// The lettered surfaces (the UI art lead's, 2026-10-21): titles, place names, chapter cards, speaker
// names and the record's headings written in the game's own lettering (ui/lettering/) where a story opts
// in (@meta ui-era). Each surface keeps its words in the page, for screen readers, glyph mode and the
// plain-text setting (ux era.css shows them and hides the canvas); the lettering is a canvas beside them.
// Which tool letters what comes from the era's CSS: --hand (brush, flat, pen, stamp or none), --hand-size,
// --hand-ink and --hand-case (title: "MOTT" is lettered "Mott").
//   installLetterer(root) -> { stop, refresh }
import { loadHand, drawLettering } from "./lettering/hand.mjs";
import { loadHands, handOf, writeHand } from "./lettering/handwrite.mjs";

export const LETTERED = [".placecard .pname", ".placecard > .caps", ".ln .who", ".portrait .pname", ".voiceline .who", ".ttitle", ".dtitle", ".leaf .ltitle", ".lenspanel > .caps", ".hud .place", ".talk.record .log > .ln:first-child", ".record-stamp", ".menu h1", ".ln.hw", ".dbook .entries li > span:not(.t)"].join(", ");
// round two (2026-10-22): a writer's own hand. A line marked {hand: <who>} (talk.mjs .ln.hw), a speaker's name
// where the era says names are signed (--hand-own: 1), and the daybook's notes in the player's hand
// (globalThis.__lwWriter) are written by lettering/handwrite.mjs; the clean words show on hover and focus.
const ATLAS = new Set(["brush", "flat", "pen", "stamp", "insular", "insularround", "textura", "bastarda"]);
async function writerFor(el, cs) {
  if (el.matches(".ln.hw")) return { hand: el.dataset.hand, mood: el.dataset.mood || null };
  if (el.matches(".dbook .entries li > span")) { const w = globalThis.__lwWriter && globalThis.__lwWriter(); return w ? { hand: w } : null; }
  if (cs.getPropertyValue("--hand-own").trim() === "1" && el.matches(".ln .who, .portrait .pname")) return { hand: el.dataset.bl, own: true };
  return null;
}
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const strHash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };

async function letter(el, text) {
  const cs = getComputedStyle(el), W = await writerFor(el, cs);
  if (W && W.hand && !ATLAS.has(W.hand)) { const hand = handOf(await loadHands(), W.hand); if (hand) return written(el, text, cs, hand, W); if (!W.own) return; }
  const tool = W && ATLAS.has(W.hand) ? W.hand : cs.getPropertyValue("--hand").trim();
  if (!tool || tool === "none") return;
  let H; try { H = await loadHand(tool); } catch (e) { console.warn(`letterer: ${e.message}; the words stay in type`); return; }
  if (el.dataset.bl !== text) return;   // the words changed while the hand loaded; the newer call letters them
  const px = parseFloat(cs.fontSize) * (+cs.getPropertyValue("--hand-size") || 1.2), inline = cs.display.startsWith("inline");
  const casing = cs.getPropertyValue("--hand-case").trim(), shown = casing === "title" ? titleCase(text) : cs.textTransform === "uppercase" ? text.toUpperCase() : text;
  const max = inline ? Infinity : Math.max(px * 3, el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  const align = cs.textAlign === "center" ? "center" : cs.textAlign === "right" || cs.textAlign === "end" ? "right" : "left";
  const ink = cs.getPropertyValue("--hand-ink").trim() || cs.getPropertyValue("--ink").trim() || "#1d1418";
  let cv = el.querySelector(":scope > canvas.bl-c");
  if (!cv) { cv = document.createElement("canvas"); cv.className = "bl-c"; cv.setAttribute("aria-hidden", "true"); el.append(cv); }
  drawLettering(cv, H, shown, { px, max, seed: strHash(text + (el.dataset.blSeed || "")), ink, align, fit: inline ? 0 : max });
}

// in a writer's hand: a name signed, a note, a document's line; the clean words on hover and focus (era.css)
function written(el, text, cs, hand, W) {
  if (el.dataset.bl !== text) return;
  const inline = cs.display.startsWith("inline"), px = parseFloat(cs.fontSize) * (W.own ? 1.15 : 1.05);
  const max = inline && W.own ? Infinity : Math.max(px * 4, (el.clientWidth || el.parentElement.clientWidth) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  let cv = el.querySelector(":scope > canvas.bl-c");
  if (!cv) { cv = document.createElement("canvas"); cv.className = "bl-c"; cv.setAttribute("aria-hidden", "true"); el.append(cv); }
  writeHand(cv, W.own ? titleCase(text).split(" ").pop() : text, hand, { px, max, mood: W.mood, seed: strHash(text) % 997 });
  el.classList.add("handed"); if (!W.own && !el.hasAttribute("tabindex")) el.tabIndex = 0;   // focusable, so the keyboard reaches the clean words too
}

// wrap an element's words for lettering: the words in a span the page keeps, the canvas beside it
function take(el) {
  const text = el.textContent.replace(/\s+/g, " ").trim();
  if (!text || (el.dataset.bl === text && el.firstElementChild && el.firstElementChild.classList.contains("bl-src"))) return;   // the same words, already taken (a page that sets the same words again replaces our span)
  el.dataset.bl = text;
  const src = document.createElement("span"); src.className = "bl-src"; src.textContent = text;
  el.replaceChildren(src); el.classList.add("bl");
  letter(el, text).catch((e) => console.error(`letterer: ${text}: ${e.message}`));
}

export function installLetterer(root = document.body) {
  const active = () => !!document.body.dataset.uiEra;
  const scan = (node) => { if (!(node instanceof Element)) return; if (node.matches(LETTERED)) take(node); for (const e of node.querySelectorAll(LETTERED)) take(e); };
  const mo = new MutationObserver((list) => {
    if (!active()) return;
    for (const m of list) {
      const t = m.target instanceof Element ? m.target : m.target.parentElement;
      const host = t && t.closest(LETTERED); if (host) take(host);
      for (const n of m.addedNodes) scan(n);
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  // a new size (window, text size, era) letters everything again
  const refresh = () => { if (!active()) return; for (const e of root.querySelectorAll(".bl")) { e.dataset.bl = ""; take(e); } };
  let tm = 0; const onResize = () => { clearTimeout(tm); tm = setTimeout(refresh, 150); };
  window.addEventListener("resize", onResize); window.addEventListener("lw:restyle", onResize);
  if (active()) scan(root);
  return { refresh, rescan: () => active() && scan(root), stop() { mo.disconnect(); window.removeEventListener("resize", onResize); window.removeEventListener("lw:restyle", onResize); } };
}
