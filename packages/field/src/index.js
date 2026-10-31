// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field: the core type for values over any domain, with units, uncertainty, provenance, representation and
   a chain ledger; converters as graded transducers; shared operators; a render hook into tools/diagram.
   In Node, require("field/src/index.js"); in a page, load perceive first, then these files in this order
   as classic scripts (window.Field), and call Field.setHasher with a sha256 function. */
"use strict";
require("../../perceive/src/index.js");
for (const f of ["units", "field", "ledger", "grade", "transducer", "ops", "converters", "render"]) require("./" + f + ".js");
module.exports = globalThis.Field;
