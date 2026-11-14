// The Quota slice played in the browser shell, start to coda (systems engineer, engine PROGRESS 37): the real
// page (play.html?content=quota&capture=1, so the page exposes window.__lw), 1920 x 1080, choices made by
// clicking the numbered options as a player would, the class picked first (1 inspector, 2 sergeant), then
// always the option --pick (default 1). Fights are played by combat's pilot in real time. A step that shows no
// new text and no option for --stall seconds is a stall: Enter is pressed once, then the run is called stuck.
// Writes a still per new scene, the page's warnings and errors, and summary.json under --out.
// --movement union|league|alliance|well|none takes that door at era 5's movement choice (e5.move) instead of --pick;
// with --alone the run starts at era 5 itself (e5.start, the class's man made directly, no earlier era played, so
// no mark an earlier era leaves is held), so one movement is replayed alone to THE END (tools/endingcheck.mjs plays
// every movement headless; this is the same choice in the real page).
//   node tools/quota-shell.mjs --class 1|2 [--port 8754] [--pick 1] [--movement m [--alone]] [--out dir] [--stall 20] [--iters 400]
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./visualcheck/cdp.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const here = dirname(fileURLToPath(import.meta.url)), port = +(opt.port || 8754), cls = +(opt.class || 1), pick = +(opt.pick || 1), STALL = +(opt.stall || 20) * 1000;
// the movement doors at e5.move, by their option text (content/quota/e5_vote.lwd)
const ITERS = +(opt.iters || 400); // polls of the page before the run gives up; the five-era game needs more than the era 2 slice did
const MOVES = { union: /Plain Union/, league: /League's banner/, alliance: /Alliance/, well: /Well House/, none: /car and go home/ };
const movement = opt.movement ? String(opt.movement) : null, alone = !!opt.alone;
if (movement && !MOVES[movement]) { console.error(`quota-shell: --movement is one of ${Object.keys(MOVES).join(", ")}`); process.exit(2); }
if (alone && !movement) { console.error("quota-shell: --alone replays one movement; give --movement"); process.exit(2); }
const out = opt.out || join(here, "..", "..", "capture", "quota-shell-2026-10-22", `class${cls}${movement ? `-${movement}${alone ? "-alone" : ""}` : ""}`);
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9500 + Math.floor(Math.random() * 300) });
const STATE = String.raw`(() => { const opts = [...document.querySelectorAll('button')].filter((b) => /^\d+\.\s/.test(b.innerText) && b.offsetParent); const c = window.__lw, C = c && c.G && c.G.ext && c.G.ext.combat;
  const talk = document.querySelector('aside.talk, .talk'); return { inner: !!document.querySelector('iframe.innerframe'), end: !!document.querySelector('.endnote'), opts: opts.map((b) => b.innerText.replace(/\s+/g, ' ').slice(0, 90)), fight: !!(C && C.current && !C.current.W.result), text: (talk ? talk.innerText : document.body.innerText).replace(/\s+/g, ' ').slice(-400), place: (document.querySelector('.hud') || document.body).innerText.split('\n').slice(0, 3).join(' / '), node: c && c.G && ((c.G.activeTalk && c.G.activeTalk.node) || (c.G.state && c.G.state.node)) || null }; })()`;
const click = (i) => String.raw`(() => { const opts = [...document.querySelectorAll('button')].filter((b) => /^\d+\.\s/.test(b.innerText) && b.offsetParent); const b = opts[Math.min(${i}, opts.length - 1)]; if (!b) return null; const t = b.innerText.replace(/\s+/g, ' ').slice(0, 90); b.click(); return t; })()`;
const clickText = (re) => String.raw`(() => { const opts = [...document.querySelectorAll('button')].filter((b) => /^\d+\.\s/.test(b.innerText) && b.offsetParent); const re = ${re}; const b = opts.find((x) => re.test(x.innerText.replace(/\s+/g, ' ').trim())); if (!b) return null; const t = b.innerText.replace(/\s+/g, ' ').slice(0, 90); b.click(); return t; })()`;
const summary = { cls, pick, movement, alone, moved: null, steps: [], stills: [], stalls: [], fights: 0, inners: 0, ended: false, logs: [] };
try {
  const P = await B.page(1920, 1080);
  await P.go(`http://127.0.0.1:${port}/engine/play.html?content=quota&capture=1`);
  await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
  await P.eval(`(async () => { const c = window.__lw; const { createPilot } = await import('/engine/combat/tools/pilot.mjs'); const C = c.G.ext.combat, step = C.step.bind(C), pilot = createPilot(); C.step = (input) => step(C.current && !C.current.W.result ? pilot(C.current.W) : input); return true; })()`);
  await P.eval(`(() => { window.__lwInnerBot = "auto"; return true; })()`); // the inner fights the story opens play themselves (ui/inneroverlay.mjs)
  await P.shot(join(out, "00-title.png")); summary.stills.push("00-title.png");
  // --alone: the class's man made directly (as the class option does: q_class and become), then era 5's first node
  if (alone) await P.eval(`(() => { const c = window.__lw; c.newGame(); const errs = c.G.create({ archetype: ${cls === 2 ? "'q.will'" : "'q.ned'"} }); c.G.state.vars.q_class = ${cls === 2 ? "'militia'" : "'inspector'"}; c.play('e5.start'); return errs; })()`);
  else await P.eval(`(() => { window.__lw.create(); return true; })()`);
  await sleep(2500);
  let last = "", since = Date.now(), n = 0, first = !alone, enter = false, wasFight = false, wasInner = false;
  for (let k = 0; k < ITERS; k++) {
    const s = await P.eval(STATE);
    if (s.inner) { if (!wasInner) { summary.inners++; await sleep(1500); await P.shot(join(out, `${String(++n).padStart(2, "0")}-inner.png`)); summary.stills.push(`${String(n).padStart(2, "0")}-inner.png`); } wasInner = true; since = Date.now(); await sleep(1000); continue; }
    wasInner = false;
    if (s.fight) { if (!wasFight) { summary.fights++; await P.shot(join(out, `${String(++n).padStart(2, "0")}-fight.png`)); summary.stills.push(`${String(n).padStart(2, "0")}-fight.png`); } wasFight = true; since = Date.now(); await sleep(1000); continue; }
    wasFight = false;
    const key = s.text + "|" + s.opts.join("|");
    if (key !== last) { last = key; since = Date.now(); enter = false; const name = `${String(++n).padStart(2, "0")}.png`; await sleep(400); await P.shot(join(out, name)); summary.stills.push(name); summary.steps.push({ n, place: s.place, node: s.node, opts: s.opts.length, text: s.text.slice(-160) }); }
    if (s.end && !s.opts.length) { summary.ended = true; break; }   // the end screen itself (the old text test matched "at the end of the table" while the witness still held its last lines)
    if (s.opts.length) {
      let chosen = null;
      if (movement && s.node === "e5.move") { chosen = await P.eval(clickText(MOVES[movement])); summary.moved = chosen; if (!chosen) { summary.stalls.push({ n, place: s.place, node: s.node, text: `no option for the ${movement} movement` }); break; } }
      else chosen = await P.eval(click(first ? cls - 1 : pick - 1));
      first = false; summary.steps.push({ node: s.node, chose: chosen }); await sleep(900); continue;
    }
    if (Date.now() - since > STALL) {
      if (!enter) { await P.eval(`(() => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', bubbles: true })); return true; })()`); enter = true; since = Date.now(); continue; }
      summary.stalls.push({ n, place: s.place, node: s.node, text: s.text.slice(-200) }); break;
    }
    await sleep(700);
  }
  summary.logs = P.logs.slice(0, 40);
  await P.shot(join(out, "zz-last.png")); summary.stills.push("zz-last.png");
  await P.close();
} finally { await B.close(); }
await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ cls, movement, alone, moved: summary.moved, ended: summary.ended, steps: summary.steps.filter((x) => x.chose).length, scenes: summary.stills.length, fights: summary.fights, inners: summary.inners, stalls: summary.stalls, logs: summary.logs.slice(0, 8) }, null, 1));
