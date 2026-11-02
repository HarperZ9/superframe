// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Load the circuit simulator into Node; returns D.SIM. The engine's core is loaded for its seeded generator. */
"use strict";
const path = require("path");
require(path.join(__dirname, "..", "src", "core.js"));
const SIM_SRC = ["linalg", "circuit", "stamp", "analyses", "spice"];
for (const f of SIM_SRC) require(path.join(__dirname, "src", f + ".js"));
module.exports = { D: globalThis.Diagram, S: globalThis.Diagram.SIM, SIM_SRC };
