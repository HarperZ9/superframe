// Scripted runs of era 5's inner fights, each played to its end by a scripted player (tools/innerbots.mjs) and
// written as a combat trace (tools/trace.mjs format, design/DETMATH.md section 4), so the C++ port replays the same
// fights byte for byte. A run of several worlds (the Descent's rings, the Adversary's movements) is one file with a
// `crun` line before each world.
//   says-force, says-endure     Everybody Says beaten into posting (forced, heads) and endured at the stone
//   order-force, order-yield    Order brought down with the baton (forced, fall) and the baton dropped (laid, outlast)
//   descent                     a run that cut back PRUDENCE and LOYALTY by force, resolved OBEDIENCE and SPITE without
//                               force, and heard Nobody Checks: four gates (the traits pass), two of them snow
//   adversary                   the Host in three movements, its limbs the Descent's kept flaws
//   fond, goats, barn, figure   the last four bosses (combat/data/flaws-later.mjs), by force and by their way without it
// Every resolution without force fights until the boss's second phase first (the fight is joined).
//   node combat/tools/innerfights.mjs [outdir]    (default combat/tests/traces-inner; writes manifest.json with sha-256)
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeG } from "../tests/helpers.mjs";
import { FLAWS } from "../data/flaws.mjs";
import { createInnerWorld } from "../arena/innerworld.mjs";
import { createInnerRun } from "../arena/inner.mjs";
import { createDescent } from "../arena/descent.mjs";
import { forceBot, resolveBot } from "./innerbots.mjs";
import { traceFight } from "./trace.mjs";

export const LEVELS = { grip: 5, ballast: 5, coat: 5, knees: 5, pen: 4, nose: 4 };
const LIMIT = 60 * 240;

// one world to its end under a bot, traced; returns the trace text and the result
function play(W, bot, { seed, arena, head }) {
  const tr = traceFight(W, { seed, arena });
  let text = head ? JSON.stringify({ t: "crun", ...head, s: "h" }) + "\n" : "";
  tr.begin();
  for (let i = 0; i < LIMIT && !W.result; i++) tr.step({ lamb: bot(W) });
  return { text: text + tr.finish(), result: W.result, secs: +(W.tick / 60).toFixed(1) };
}
const toward = (key) => (W) => { const [x, z] = W.field.arena.anchors[key][0], L = W.lamb(), d = Math.hypot(x - L.x, z - L.z) || 1; return { mx: (x - L.x) / d, mz: (z - L.z) / d }; };

function single(id, verb, seed) {
  const W = createInnerWorld({ G: makeG(), flaw: FLAWS[id], seed, levels: LEVELS });
  const r = play(W, verb === "force" ? forceBot() : resolveBot(W, verb), { seed, arena: FLAWS[id].arena });
  return { ...r, ends: [r.result && r.result.outcome] };
}

export function descentRun(seed = 1) {
  const D = createDescent({ resolved: { prudence: "force", forty: "yield", order: "force", says: "endure" }, heard: [{ id: "q.sl.check" }], levels: LEVELS, seed });
  let text = "", ends = [];
  while (D.stage().kind === "ring") {
    const st = D.stage(), W = D.world(makeG());
    const r = play(W, st.empty ? toward("stove") : forceBot(), { seed: seed + st.ring, arena: st.empty ? "snow" : FLAWS[st.flaw].arena, head: { ring: st.ring, flaw: st.flaw, empty: st.empty } });
    text += r.text; ends.push(r.result && r.result.outcome); D.finish(W);
  }
  return { text, ends, kept: D.stage().kept };
}

export function adversaryRun(seed = 1, kept = ["prudence", "order"]) {
  const R = createInnerRun({ flaw: "host", kept, heard: [{ id: "e5.sl.order" }, { id: "e5.sl.says" }], seed, levels: LEVELS }); // the build the other scripted runs fight with
  let text = "", ends = [];
  while (R.stage().kind === "fight") {
    const st = R.stage(), W = R.world(makeG()), verb = st.movement === 0 ? "endure" : "name";
    const r = play(W, resolveBot(W, verb), { seed, arena: "ice", head: { movement: st.movement, name: st.name } });
    text += r.text; ends.push(r.result && r.result.outcome); R.finish(W);
  }
  return { text, ends, stage: R.stage().kind };
}

export const RUNS = {
  "says-force": () => single("says", "force", 1),
  "says-endure": () => single("says", "endure", 1),
  "order-force": () => single("order", "force", 3),
  "order-yield": () => single("order", "yield", 1),
  "fond-force": () => single("fond", "force", 1),
  "fond-refuse": () => single("fond", "refuse", 1),
  "goats-force": () => single("goats", "force", 1),
  "goats-yield": () => single("goats", "yield", 1),
  "barn-force": () => single("barn", "force", 1),
  "barn-endure": () => single("barn", "endure", 1),
  "figure-force": () => single("figure", "force", 1),
  "figure-endure": () => single("figure", "endure", 1),
  descent: () => descentRun(1),
  adversary: () => adversaryRun(1),
};

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("combat/tools/innerfights.mjs")) {
  const dir = process.argv[2] || new URL("../tests/traces-inner/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
  mkdirSync(dir, { recursive: true });
  const manifest = {};
  for (const [name, fn] of Object.entries(RUNS)) {
    const r = fn(); writeFileSync(`${dir}/${name}.jsonl`, r.text);
    manifest[name] = { sha256: createHash("sha256").update(r.text).digest("hex"), lines: r.text.split("\n").length - 1, ends: r.ends };
    console.log(`${name}: ${r.ends.join(", ")}; ${manifest[name].lines} lines`);
  }
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 1) + "\n");
}
