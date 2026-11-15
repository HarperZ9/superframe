// A piece of the town's propaganda, as its era printed it (the UI art lead's, 2026-10-22). The words are the
// claim's own (world/discourse.mjs @claim words, the story's); the picture is the caricature (figure.mjs, through
// guard.mjs) printed by the era's process (print.mjs) on the era's paper (ui/paper.mjs), lettered with the era's
// tools (ui/lettering). A notice can be torn (a piece gone) or have the true figure pasted over it in the
// player's own hand. Browser module.
//   await renderNotice(canvas, { era, words, carrier, people, myth, seed, torn, pasted: { words, hand } }) -> canvas
import { drawFigure } from "./figure.mjs";
import { PROCESSES, PROCESS } from "./print.mjs";
import { paperPixels } from "../paper.mjs";
import { loadHand, drawLettering } from "../lettering/hand.mjs";
import { loadHands, handOf, writeHand } from "../lettering/handwrite.mjs";

const toCanvas = (P) => { const c = document.createElement("canvas"); c.width = P.w; c.height = P.h; c.getContext("2d").putImageData(new ImageData(P.data, P.w, P.h), 0, 0); return c; };
// the era's look: its paper, process, inks and lettering for the words
const LOOK = {
  1: { paper: 1, process: "engraving", hand: "textura", ink: "#24170e", frame: "double" },
  2: { paper: 2, process: "woodcut", hand: "stamp", ink: "#18161b", frame: "rule" },
  3: { paper: 3, process: "litho", hand: "flat", ink: "#b02a20", frame: "none" },
  4: { paper: 4, process: "halftone", hand: "brush", ink: "#141414", frame: "collage" },
  5: { paper: 5, process: "meme", hand: "brush", ink: "#ffffff", frame: "phone" },
};

async function lettered(g, tool, text, x, y, px, max, ink, align = "center", outline = null) {
  const H = await loadHand(tool), c = document.createElement("canvas");
  drawLettering(c, H, text, { px, max, ink, align, fit: max, dpr: 1 });
  if (outline) { const o = document.createElement("canvas"); drawLettering(o, H, text, { px, max, ink: outline, align, fit: max, dpr: 1 }); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.drawImage(o, x + dx, y + dy); }
  g.drawImage(c, x, y); return c.height;
}

function tear(g, w, h, seed) {   // a piece torn away from the lower corner: the wall shows through
  let s = seed; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  g.save(); g.globalCompositeOperation = "destination-out"; g.beginPath(); g.moveTo(w, h * 0.45);
  for (let t = 0; t <= 1; t += 0.05) g.lineTo(w - w * 0.62 * t + (r() - 0.5) * 14, h * 0.45 + h * 0.55 * t * t + (r() - 0.5) * 14);
  g.lineTo(w, h); g.closePath(); g.fill(); g.restore();
}

export async function renderNotice(canvas, { era = 2, words = "", carrier = "", people = "hesh", myth = "hoard", seed = 7, torn = false, pasted = null, w = 420, h = 600 } = {}) {
  const L = LOOK[era] || LOOK[2]; canvas.width = w; canvas.height = h; const g = canvas.getContext("2d");
  if (L.frame === "phone") { g.fillStyle = "#111317"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8e8e8"; g.font = "13px sans-serif"; g.fillText("09:41", 18, 22); g.fillText("shared from a shared post", 18, h - 16); }
  else g.drawImage(toCanvas(paperPixels({ w, h, era: L.paper, seed, kind: "sheet", scale: 0.8 })), 0, 0, w, h);
  // the picture
  const fw = w - 60, fh = Math.round(h * 0.52), fig = document.createElement("canvas"); fig.width = fw; fig.height = fh;
  drawFigure(fig.getContext("2d"), { people, myth, w: fw, h: fh, seed });
  const src = fig.getContext("2d").getImageData(0, 0, fw, fh), inked = toCanvas((PROCESSES[L.process] || PROCESSES[PROCESS[era]])({ w: fw, h: fh, data: src.data }, { seed }));
  const top = L.frame === "phone" ? 70 : era === 3 ? h * 0.3 : 40;
  if (L.frame === "collage") { g.save(); g.translate(w / 2, top + fh / 2); g.rotate(-0.04); g.fillStyle = "#fbfbf6"; g.fillRect(-fw / 2 - 8, -fh / 2 - 8, fw + 16, fh + 16); g.drawImage(inked, -fw / 2, -fh / 2); g.fillStyle = "rgba(230, 220, 170, 0.75)"; g.fillRect(-fw / 2 - 20, -fh / 2 - 14, 70, 22); g.restore(); }
  else { if (L.frame === "phone") { g.fillStyle = "#f2f2f2"; g.fillRect(30, top, fw, fh); } g.drawImage(inked, 30, top); }
  if (L.frame === "double") { g.strokeStyle = L.ink; g.lineWidth = 3; g.strokeRect(22, top - 8, fw + 16, fh + 16); g.lineWidth = 1; g.strokeRect(17, top - 13, fw + 26, fh + 26); }
  if (L.frame === "rule") { g.fillStyle = L.ink; g.fillRect(26, top + fh + 10, fw + 8, 4); }
  // the words
  const big = era === 5 ? 30 : era === 3 ? 34 : 26;
  if (era === 3) await lettered(g, L.hand, words, 24, 20, big, w - 48, L.ink);
  else if (era === 5) { await lettered(g, L.hand, words, 24, 34, big * 0.8, w - 48, L.ink, "center", "#000"); }
  else await lettered(g, L.hand, words, 24, top + fh + 24, big, w - 48, L.ink);
  if (carrier) { g.fillStyle = era === 5 ? "#9aa0a8" : L.ink; g.font = `${era === 5 ? 12 : 13}px Consolas, monospace`; g.textAlign = "center"; g.fillText(carrier.toUpperCase(), w / 2, h - (era === 5 ? 36 : 22)); g.textAlign = "left"; }
  if (torn) tear(g, w, h, seed + 3);
  if (pasted && pasted.words) {   // a slip pasted over the words, written by hand
    const sh = 120, sy = top + fh + 10; g.save(); g.translate(w / 2, sy + sh / 2); g.rotate(0.025); g.fillStyle = "#efe9da"; g.fillRect(-w / 2 + 30, -sh / 2, w - 60, sh); g.restore();
    const hand = handOf(await loadHands(), pasted.hand || "ned"); if (hand) { const c = document.createElement("canvas"); writeHand(c, pasted.words, hand, { px: 18, max: w - 90, dpr: 1, seed }); g.drawImage(c, 40, sy + 14); }
  }
  return canvas;
}
