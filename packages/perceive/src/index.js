// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive: bring any band of any spectrum, and any field, into sight, sound and touch, and state what each
   view keeps and loses. In Node, require("perceive/src/index.js"); in a page, load the files as classic
   scripts in this order (window.Perceive). */
"use strict";
for (const f of ["cmf", "spectral", "signal", "loss", "fields", "polar", "surface", "dims", "registry"]) require("./" + f + ".js");
module.exports = globalThis.Perceive;
