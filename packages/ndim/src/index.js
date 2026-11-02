// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim: an n-dimensional renderer core with no dependencies. In Node, require("ndim/src/index.js");
   in a page, load vec, polytopes, lattice, slice, coxeter, project and fields as classic scripts (window.NDim). */
"use strict";
for (const f of ["vec", "polytopes", "lattice", "slice", "coxeter", "project", "fields"]) require("./" + f + ".js");
module.exports = globalThis.NDim;
