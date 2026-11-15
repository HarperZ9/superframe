// UI stills for the Quota (the UI art lead's, 2026-10-21): the start, the wide lens, a dialogue, the
// pause menu's pages (the Daybook until 2026-10-23) and the read-back, each in painted and glyph style, headless
// with the GPU off.
//   node game/engine/tools/uistills.mjs --port 8800 --out game/capture/ui-2026-10-21/after [--query "era=2"]
//        [--only start,wide,talk,menu,menu-character,menu-inventory,menu-map,readback] [--looks paint,glyph]
//        [--size 1280x720] [--tag e2]
// Writes <out>/<tag->state-look.png and <out>/stills.json (what each still shows, page errors kept).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { launch, sleep } from "./visualcheck/cdp.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8800), out = opt.out || "game/capture/ui-stills", tag = opt.tag ? `${opt.tag}-` : "";
const [W, H] = String(opt.size || "1280x720").split("x").map(Number);
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;

// each state from a fresh page: steps run in the page, in order
const START = "(async () => { window.__lw.create(); await new Promise((r) => setTimeout(r, 900)); return true; })()";
const NED = "(async () => { window.__lw.play.choose(0); await new Promise((r) => setTimeout(r, 600)); return true; })()";
const OUT = "(async () => { window.__lw.play.close(); await new Promise((r) => setTimeout(r, 900)); return true; })()";
const DOWN = "(async () => { window.__lw.play.choose(0); await new Promise((r) => setTimeout(r, 1200)); return true; })()";
const page = (id) => `(async () => { window.__lw.daybook('${id}'); await new Promise((r) => setTimeout(r, 900)); return true; })()`;
const BOOK = page("notes");
// the read-back with a run's worth of record: the pencil kept, the promise to Tomas, the true figure, the door talked
const RECORD = `(async () => { const c = window.__lw, G = c.G, s = G.scope;
  s.assign('var.q_class', 'inspector'); s.assign('var.q_figure', 'true'); s.assign('var.q_door', 'talked'); s.assign('var.q_cart', 'through');
  for (const f of ['q.pencil_kept', 'q.promised_hill', 'said.ned_report_true']) G.setFlag(f, true);
  c.play.startTalk('q.readback'); await new Promise((r) => setTimeout(r, 1400)); return true; })()`;
// the dialogue box framing a painted portrait: Ned's (the Studio's ned@e2), put in the slot by hand, since in
// the slice Ned is the player in the scenes the stills reach and the slot shows the other speaker
const FACE = "(async () => { await window.__lw.play.els.portrait.update({ speaker: 'Ned', face: 'lying', light: 'paraffin' }); await new Promise((r) => setTimeout(r, 900)); return true; })()";
// the journal with two notes in it, so the notes show in the player's hand
const NOTES = "(() => { const G = window.__lw.G; G.quests.write('fact', 'ui.note1', 'Haldane barns: 190 in my pencil, 310 in Mott’s ink over it.'); G.quests.write('fact', 'ui.note2', 'Tomas at the door at twenty to nine, with the girl’s tally.'); return true; })()";
export const STATES = {
  start: { why: "the start: the tower over Exchange Square, the class choice", steps: [START] },
  wide: { why: "the wide lens at the tower, the district panel and the ways down", steps: [START, NED, OUT] },
  talk: { why: "a dialogue: the returns room, Mott at the desk", steps: [START, NED, DOWN] },
  portrait: { why: "the dialogue box with a painted portrait in the era's mount (Ned, lying face, set by hand)", steps: [START, NED, DOWN, FACE] },
  plain: { why: "a dialogue with the Plain text setting on: clean faces and clean paper", steps: ["(() => { document.documentElement.classList.add('plaintext'); window.dispatchEvent(new Event('lw:restyle')); return true; })()", START, NED, DOWN] },
  menu: { why: "the pause menu's Journal over the wide lens, two notes in the player's hand", steps: [START, NED, OUT, NOTES, BOOK] },
  "menu-character": { why: "the pause menu's Character page", steps: [START, NED, OUT, page("build")] },
  "menu-inventory": { why: "the pause menu's Inventory page", steps: [START, NED, OUT, page("pack")] },
  "menu-map": { why: "the pause menu's Map page", steps: [START, NED, OUT, page("map")] },
  readback: { why: "the read-back of the day, as the record", steps: [START, NED, RECORD] },
};
// glyph mode: wait for the renderer to take the frame
const GLYPHED = "(async () => { const p = window.__lw.play; await p.renderersReady; for (let i = 0; i < 120 && !(p.renderers && p.renderers.mode() === 'glyph'); i++) await new Promise((r) => setTimeout(r, 50)); await new Promise((r) => setTimeout(r, 700)); return !!(p.renderers && p.renderers.mode() === 'glyph'); })()";

const states = (opt.only ? String(opt.only).split(",") : Object.keys(STATES));
const looks = String(opt.looks || "paint,glyph").split(",");
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9333 + Math.floor(Math.random() * 500) }), report = [];
try {
  for (const look of looks) for (const id of states) {
    const S = STATES[id]; if (!S) throw new Error(`uistills: no state ${id}`);
    const P = await B.page(W, H), file = `${tag}${id}-${look}.png`, r = { id, look, why: S.why, file, query: opt.query || "", errors: [] };
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?content=quota&capture=1&tips=0&smoke=0${look === "glyph" ? "&look=glyph" : ""}${opt.query ? `&${opt.query}` : ""}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      for (const s of S.steps) await P.eval(s);
      if (look === "glyph") r.glyph = await P.eval(GLYPHED);
      await sleep(400);
      await P.shot(join(out, file));
    } catch (e) { r.errors.push(String(e.message || e)); console.error(`uistills: ${id} ${look}: ${e.message}`); }
    r.errors.push(...P.logs.filter((l) => /exception|error/.test(l) && !/no plate|cannot be decoded/.test(l)));
    report.push(r); await P.close();
    console.log(`${file}${r.errors.length ? `  ERRORS ${r.errors.length}` : ""}`);
  }
} finally { await B.close(); }
await writeFile(join(out, `${tag}stills.json`), JSON.stringify(report, null, 2));
if (report.some((r) => r.errors.length)) process.exitCode = 1;
