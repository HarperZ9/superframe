// Shared test setup: the placeholder content, a fresh game, and small play helpers.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, loadContent } from "../game.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SLICE = join(ROOT, "..", "..", "slice", "lamp_quay_2300.lwd");
const FILES = ["rules.lwd", "demo.lwd", "systems.lwd", "yard.lwd"];

export const testSources = () => FILES.map((f) => ({ file: f, text: readFileSync(join(ROOT, "test-content", f), "utf8") }));
let cached = null;
export const testContent = () => (cached ||= loadContent(testSources()));

// A fresh game on the placeholder content. Content is shared (it is never written to).
export function game(opts = {}) {
  const G = createGame({ content: testContent(), seed: 7, ...opts });
  if (opts.mode) G.rs.rules["check-mode"] = opts.mode;
  return G;
}

// Choose the option whose label contains the text; fails loudly when it is not on offer.
export function pick(talk, text, opts) {
  const o = (talk.beat.options || []).find((x) => x.label.includes(text));
  if (!o) throw new Error(`no option "${text}" in ${(talk.beat.options || []).map((x) => x.label).join(" | ")}`);
  return talk.choose(o.index, opts);
}
export const labels = (talk) => (talk.beat.options || []).map((o) => o.label);
export const texts = (beat) => beat.lines.map((l) => l.text);
