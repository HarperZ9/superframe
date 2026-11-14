// The granary door (The Quota slice, e.q_granary) played by the scripted player for each class and each figure
// reported, over seeds: how often it is won, talked out, lost. The Militia fights it (combat/tools/pilot.mjs,
// the fighting build's habits); the Inspector takes the talk-out once it is offered, as tools/playthrough.mjs
// does for a talking build, and otherwise fights the same way.
//   node tools/quota/doorbench.mjs [--seeds 1-20] [--classes militia,inspector] [--figures true,inflated,blamed] [--notalk] (--notalk: the Inspector fights it out)
import { readFile } from "node:fs/promises";
import { loadAct } from "../../dialogue/book.mjs";
import { loadContent, createFullGame } from "../../full.mjs";
import { createPilot } from "../../combat/tools/pilot.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const [a, b] = String(opt.seeds || "1-20").split("-").map(Number), SEEDS = Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i);
const CLASSES = String(opt.classes || "militia,inspector").split(","), FIGURES = String(opt.figures || "true,inflated,blamed").split(",");
const ROOT = new URL("../../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const content = loadContent((await loadAct(`${ROOT}quota/slice.lwd`, (p) => readFile(p, "utf8"))).sources);
const ARCH = { inspector: "q.ned", militia: "q.will" }; // the builds' sheets (tools/quota/policy.mjs)

export function playDoor(cls, report, seed) {
  const G = createFullGame({ content, seed });
  G.create({ archetype: ARCH[cls], enter: false });
  Object.assign(G.state.vars, { q_class: cls, q_figure: report });
  if (cls === "inspector") G.setFlag("q.true_in_hand", true); // the inspector's own count, from the returns room
  const C = G.ext.combat, W = C.start("e.q_granary"), pilot = createPilot();
  for (let i = 0; i < 60 * 180 && !W.result; i++) {
    const inp = pilot(W);
    C.step(cls === "inspector" && W.talk && !opt.notalk ? { ...inp, press: [...(inp.press || []), "talk"] } : inp);
  }
  return { outcome: W.result ? W.result.outcome : "none", secs: +(W.tick / 60).toFixed(1), left: +W.lamb().hp.toFixed(1), boss: +(W.fighters.find((F) => W.defs[F.id].boss) || { hp: 0 }).hp.toFixed(1) };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/quota/doorbench.mjs");
if (isMain) {
  for (const cls of CLASSES) for (const report of FIGURES) {
    const rows = SEEDS.map((s) => playDoor(cls, report, s)), n = (o) => rows.filter((r) => r.outcome === o).length;
    const won = n("win") + n("yield");
    console.log(`${cls.padEnd(9)} ${report.padEnd(9)} won ${won}/${rows.length} (${Math.round((100 * won) / rows.length)}%), talked ${n("talk")}, lost ${n("down")}, left ${n("fled")}; median ${med(rows.map((r) => r.secs))} s`);
  }
}
function med(xs) { const s = [...xs].sort((x, y) => x - y), k = s.length; return k ? (k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2) : null; }
