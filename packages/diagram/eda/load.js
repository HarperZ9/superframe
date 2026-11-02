// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Load the board layer (on top of the engine, the CAD layer and the simulator) into Node. */
"use strict";
const path = require("path");
const CAD = require(path.join(__dirname, "..", "cad", "load.js"));
require(path.join(__dirname, "..", "sim", "load.js"));
const EDA_SRC = ["geom", "footprints", "board", "route", "autoroute", "pour", "drc", "font", "view2d", "gerber", "excellon", "fabcsv", "render3d"];
for (const f of EDA_SRC) require(path.join(__dirname, "src", f + ".js"));
module.exports = Object.assign({}, CAD, { E: globalThis.Diagram.EDA, S: globalThis.Diagram.SIM, EDA_SRC });
