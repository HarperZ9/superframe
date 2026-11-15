// Preload for recipe.test.mjs: append to $LW_LOADLOG the URL of every module this thread loads and the path of every
// file it reads with readFileSync (the bake reads some inputs as data: the community stocks for the light model).
// Workers take the parent's --import, so the shade workers record theirs too.
import { registerHooks, syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const out = process.env.LW_LOADLOG;
if (out) {
  const append = fs.appendFileSync, read = fs.readFileSync;
  registerHooks({ load(url, context, next) { if (url.startsWith("file:")) append(out, url + "\n"); return next(url, context); } });
  fs.readFileSync = function (p, ...rest) { if (typeof p === "string" || p instanceof URL) append(out, (p instanceof URL ? p.href : pathToFileURL(p).href) + "\n"); return read.call(this, p, ...rest); };
  syncBuiltinESMExports();
}
