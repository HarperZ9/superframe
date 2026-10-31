/* transducers: every kernel takes a field and returns a field. In Node, require this file. In a page, the build
   inlines the same modules in this order as classic scripts (window.Transducers). */
"use strict";
for (const f of T_FILES()) require("./" + f + ".js");
function T_FILES() { return ["adapter", "core", "lens", "transparency", "pixels", "analog", "noise", "time", "organic", "membrane", "pattern", "machine", "dp", "bio", "space", "structure", "chain", "demos"]; }
module.exports = globalThis.Transducers;
module.exports.FILES = T_FILES();
