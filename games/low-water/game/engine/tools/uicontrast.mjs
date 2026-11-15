// WCAG contrast of each era's inks on its aged paper (the UI art lead's, 2026-10-21). The paper is the
// game's own (ui/paper.mjs), made at a talk page's size for several seeds with the burn at its highest;
// the inks are read from ui/era.css. Each ink is measured against the paper's median and against its 2nd
// percentile (the darkest stain, foxing or grime a line can fall on; the burnt rim, 30 px in, is left out,
// as no text sits there). Glyph mode's typed matter (ui/typed.mjs) is measured at its weakest strike.
// Exits 1 if a text ink falls under 4.5:1 (AA, body text) on the darker paper.
//   node game/engine/tools/uicontrast.mjs [--json out.json]
import { readFile, writeFile } from "node:fs/promises";
import { paperPixels } from "../ui/paper.mjs";
import { MATTER } from "../ui/typed.mjs";

const argv = process.argv.slice(2), jsonOut = argv[argv.indexOf("--json") + 1];
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = (s) => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim()); if (!m) return null; const v = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); };

const css = await readFile(new URL("../ui/era.css", import.meta.url), "utf8");
const TEXT = ["--ink", "--ink-2", "--graphite", "--carbon", "--hand-ink"], DECOR = ["--stamp-ink"];
const rows = [], darkest = [], medians = [];
for (const era of [1, 2, 3, 4, 5]) {
  const block = new RegExp(`body\\[data-ui-era="${era}"\\] \\{([^}]*)\\}`).exec(css)[1];
  const tok = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
  const lum = [];
  for (const seed of [3, 17, 29, 41, 53]) {
    const P = paperPixels({ w: 340, h: 720, era, seed, kind: "talk", burn: 1.2 });
    for (let y = 30; y < P.h - 30; y += 2) for (let x = 30; x < P.w - 30; x += 2) { const o = (y * P.w + x) * 4; lum.push([P.data[o], P.data[o + 1], P.data[o + 2]]); }
  }
  lum.sort((a, b) => L(a) - L(b));
  const med = lum[lum.length >> 1], p2 = lum[Math.floor(lum.length * 0.02)]; darkest.push(p2); medians.push(med);
  for (const k of [...TEXT, ...DECOR]) { const c = tok[k] && hex(tok[k]); if (!c) continue; rows.push({ era, look: "painted", ink: k, color: tok[k].trim(), median: +ratio(c, med).toFixed(2), dark2: +ratio(c, p2).toFixed(2), text: TEXT.includes(k) }); }
  const M = MATTER[era], weak = M.ink.map((v, i) => Math.round(M.ground[i] + (v - M.ground[i]) * 0.72));
  rows.push({ era, look: "glyph", ink: "typed, weakest strike", color: `rgb(${weak})`, median: +ratio(weak, M.ground).toFixed(2), dark2: +ratio(weak, M.ground).toFixed(2), text: true });
}
// each writer's ink (lettering/hands.json) on every era's darker paper: handwriting appears in every era
const hands = JSON.parse(await readFile(new URL("../ui/lettering/hands.json", import.meta.url), "utf8")).hands;
for (const [id, hd] of Object.entries(hands)) { const c = hex(hd.ink || "#2a2622"); if (!c) continue; const worst = Math.min(...darkest.map((p) => ratio(c, p))); rows.push({ era: "all", look: "hand", ink: `${id} (${hd.tool})`, color: hd.ink, median: +ratio(c, medians[1]).toFixed(2), dark2: +worst.toFixed(2), text: true }); }
for (const r of rows) console.log(`era ${String(r.era).padEnd(3)} ${r.look.padEnd(7)} ${r.ink.padEnd(22)} ${r.color.padEnd(18)} median ${String(r.median).padStart(5)}:1   darkest 2% ${String(r.dark2).padStart(5)}:1${r.text && r.dark2 < 4.5 ? "   UNDER AA" : ""}`);
if (jsonOut) await writeFile(jsonOut, JSON.stringify(rows, null, 2));
if (rows.some((r) => r.text && r.dark2 < 4.5)) process.exitCode = 1;
