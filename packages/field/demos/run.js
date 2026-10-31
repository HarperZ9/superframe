// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Run every demo, write out/demo.json (grades and numbers), one chain ledger per demo (out/ledger-*.jsonl)
   and the rendered views through tools/diagram (out/*.svg, out/panels.json).
   node demos/run.js */
"use strict";
const fs = require("fs");
const path = require("path");
const F = require("../src/index.js");
const OUT = path.join(__dirname, "..", "out");

const strip = (o) => { const c = Object.assign({}, o); delete c.field; return c; };
const save = (name, f, opt) => {
  fs.writeFileSync(path.join(OUT, "ledger-" + name + ".jsonl"), F.ledgerJSONL(f.ledger));
  fs.writeFileSync(path.join(OUT, name + ".svg"), F.svg(f, opt));
  return { ledger_ok: F.verifyLedger(f.ledger).ok, entries: f.ledger.length, panel: F.panel(f, opt) };
};

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now(), res = { date: new Date().toISOString(), node: process.version };
  const text = require("./text.js").run();
  res.text = {};
  for (const k of Object.keys(text)) { res.text[k] = strip(text[k]); res.text[k].render = save("text-" + k, text[k].field, { half: true }); }
  const image = await require("./image.js").run();
  res.image = strip(image); res.image.render = save("image", image.field, { log: true });
  const room = require("./room.js").run();
  res.room = strip(room);
  const R = room.field.domain.record;
  res.room.render = { ledger_ok: F.verifyLedger(room.field.ledger).ok, entries: room.field.ledger.length };
  fs.writeFileSync(path.join(OUT, "ledger-room.jsonl"), F.ledgerJSONL(room.field.ledger));
  res.room.record = { modes_hz: R.modes_hz, decay_per_s: R.decay_per_s };
  res.cad = require("./cad.js").run();
  res.float = require("./float.js").run();
  res.seconds = (Date.now() - t0) / 1000;
  const panels = Object.fromEntries(Object.entries(res.text).map(([k, v]) => ["text-" + k, v.render.panel]).concat([["image", res.image.render.panel]]));
  fs.writeFileSync(path.join(OUT, "panels.json"), JSON.stringify(panels));
  for (const v of Object.values(res.text)) delete v.render.panel;
  delete res.image.render.panel;
  fs.writeFileSync(path.join(OUT, "demo.json"), JSON.stringify(res, null, 1));
  console.log("wrote", path.join(OUT, "demo.json"), "in", res.seconds, "s");
};

main().catch((e) => { console.error("demo run failed:", e); process.exit(1); });
