// The generated page, without a browser: it parses, holds nothing of the module syntax, and every generated program in it
// comes from core. The pixel comparison with the source page needs a GPU and is recorded in project-docs/LENS-ROOM-PARITY.md.
import test from "node:test";
import vm from "node:vm";
import { readdirSync, readFileSync } from "node:fs";
import { assert } from "./h.mjs";
import { lensRoomPage, CORE } from "../views/lens-room/build.mjs";
import { classic } from "../views/build-view.mjs";

const page = lensRoomPage();
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test("the page keeps its six script blocks and each one parses as a classic script", () => {
  assert.equal(scripts.length, 6);
  for (const s of scripts) new vm.Script(s);
});
test("no module syntax reaches the page", () => {
  for (const s of scripts) {
    assert.doesNotMatch(s, /^import\s/m);
    assert.doesNotMatch(s, /^export\s/m);
  }
});
test("core helpers stay out of the page's globals", () => {
  const a = scripts[0].indexOf("const { unit } = (() => {"),
    b = scripts[0].indexOf("return { unit };");
  const t = scripts[0].indexOf("const TABLE =");
  assert.ok(a >= 0 && a < t && t < b, "TABLE sits inside the sealed scope");
  assert.match(scripts[0], /const \{ CONSTANTS, MATERIAL_RECORDS \} = \(\(\) => \{/);
});
test("every core module the page needs is listed, and only one copy of each table", () => {
  for (const f of CORE) assert.ok(readFileSync(new URL(`../core/${f}`, import.meta.url)));
  for (const name of ["const SH =", "const SCENES =", "const FIELDS =", "const PRESETS =", "const CMF ="])
    assert.equal(page.split(name).length - 1, 1, name);
});
test("view files hold no table or shader the core owns", () => {
  const dir = new URL("../views/lens-room/src/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const s = readFileSync(new URL(f, dir), "utf8");
    assert.doesNotMatch(s, /^(const|function) (SH|SCENES|FIELDS|PRESETS|MAT|lensFS|trainFS|worldFS|fParse)\b/m, f);
  }
});
test("the view reads the same names the core exports", () => {
  const defined = CORE.map((f) => classic(readFileSync(new URL(`../core/${f}`, import.meta.url), "utf8"))).join("\n");
  for (const n of ["lensFS", "trainFS", "worldFS", "fCompile", "dropProfile", "metaPair", "fft2"])
    assert.match(defined, new RegExp(`(function|const) ${n}\\b`), n);
});
test("planted: a stray export in a core module would be caught by the parse", () => {
  assert.throws(() => new vm.Script("export const x = 1;"), SyntaxError);
});
