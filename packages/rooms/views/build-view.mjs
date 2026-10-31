// SPDX-License-Identifier: FSL-1.1-MIT
// A view is a shell of HTML plus classic scripts, generated from core ES modules. The modules become classic code by
// dropping import and export keywords. Modules named in `sealed` go in a function scope and show only the names listed,
// so a helper such as `d` in units.js never becomes a page global.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IMPORT = /^import\s*(?:\{([\s\S]*?)\}\s*from\s*)?"[^"]+";[ \t]*\r?\n?/gm;

export function classic(src) {
  const aliases = [];
  const body = src
    .replace(IMPORT, (_, names) => {
      for (const n of (names || "").split(",")) {
        const m = /(\w+)\s+as\s+(\w+)/.exec(n);
        if (m) aliases.push(`const ${m[2]} = ${m[1]};`);
      }
      return "";
    })
    .replace(/^export\s+\{[^}]*\};?[ \t]*\r?\n?/gm, "")
    .replace(/^export\s+(?=const |let |function |class )/gm, "");
  return (aliases.length ? aliases.join("\n") + "\n" : "") + body;
}
const read = (p) => readFileSync(join(ROOT, p), "utf8");

export function buildPage({ shell, core, sealed = {}, blocks }) {
  const coreCode = core
    .map((f) => {
      const code = classic(read(`core/${f}`));
      const names = sealed[f];
      if (!names) return code;
      const list = names.join(", ");
      return `const { ${list} } = (() => {\n${code}\nreturn { ${list} };\n})();\n`;
    })
    .join("\n");
  const scripts = blocks.map((files, i) => {
    const code = files.map((f) => read(f)).join("\n");
    return `<script>\n"use strict";\n${i === 0 ? coreCode + "\n" : ""}${code}</script>\n`;
  });
  const page = read(shell);
  if (!page.includes("<!-- ROOM-SCRIPT -->")) throw new Error("shell has no script marker");
  return page.replace("<!-- ROOM-SCRIPT -->\n", () => scripts.join("\n")).replace("<!-- ROOM-SCRIPT -->", () => scripts.join("\n"));
}
export function writePage(html, out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return out;
}
