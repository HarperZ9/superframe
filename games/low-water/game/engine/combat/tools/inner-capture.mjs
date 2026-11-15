// The inner arena in the browser (the arena page's ?mode=inner, combat/arena/innerpage.mjs), headless, GPU off, one
// fixed frame at a time with a scripted player: stills of each boss's phases and morphs, and the feel bounds that
// need the drawn picture (combat/PROGRESS.md 29):
//   F4  the view's shake while any tell shows, at 1080p (the arena's 640 buffer x 3): at most 3 px
//   F5  flash and red (design/sensory/05-CARE.md section 2): per window of 1/16 of the frame (sliding by half),
//       a transition is a change of 0.1 relative luminance (10% of 1.0, WCAG 2.x) with the darker under 0.80; at most 3 flashes (6
//       transitions) in any second; any red transition fails, by WCAG 2.2's rule on the window's mean colour (cine/redflash.mjs:
//       one state R / (R + G + B) >= 0.8, the states over 0.2 apart in u'v'; 2026-10-23, before it any 0.05 change in the
//       share of saturated-red pixels; WCAG 2.0's (R - G - B) x 320 count is kept beside it for the record)
//   F6  the character and the boss inside the frame on every captured frame
// Controls that must fail: a 5 Hz full-frame flash and a 2 Hz red pulse over a quarter of the frame (F5); a shake
// planted while a tell shows with ?shakeclamp=off (F4); the 40 m control room (F6). A 0.5 Hz 5% breath must pass.
//   node combat/tools/inner-capture.mjs [--port 8754] [--out dir] [--only prudence:force,friday:lose] [--frames 2400]
//     [--query innerfx=debris,smoke] (added to every case's address)  [--dump] (each case's frames as JSON)
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { PAGE, judgePlayer, judgeFeatures, judgeSilhouettes } from "./innermeasure.mjs";
import { redTransitions } from "../../cine/redflash.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const here = dirname(fileURLToPath(import.meta.url)), port = +(opt.port || 8754), FRAMES = +(opt.frames || 2400);
const out = opt.out || join(here, "..", "..", "..", "capture", "inner-2026-10-22");
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;

export const CASES = [
  ["prudence", "force"], ["prudence", "yield"], ["friday", "force"], ["friday", "lose"], ["withme", "force"], ["withme", "yield"],
  ["nearest", "force"], ["nearest", "yield"], ["only", "force"], ["only", "refuse"], ["forty", "force"], ["forty", "yield"], ["check", "endure"],
  ["host:0", "endure"], ["host:1", "force"], ["host:1", "name"], ["host:2", "name"],
  ["order", "force"], ["order", "yield"], ["says", "force"], ["says", "endure"], // era 5 (combat/data/flaws-e5.mjs)
  ["fond", "force"], ["fond", "refuse"], ["goats", "force"], ["goats", "yield"], ["barn", "force"], ["barn", "endure"], ["figure", "force"], ["figure", "endure"], // combat/data/flaws-later.mjs
  ["jealousy", "force"], ["dread", "force"], ["shame", "force"], // the traits pass's lesser beings (combat/data/flaws-traits.mjs)
  ["gate:coat", "force"], ["gate:nose", "force"], ["gate:pen", "force"], ["gate:hat", "force"], // the Descent's four gates (descent.mjs gateFlaw)
];
const CONTROLS = [
  { id: "control-flash5", flaw: "check", bot: "endure", plant: "flash5", expect: "F5" },
  { id: "control-red2", flaw: "check", bot: "endure", plant: "red2", expect: "F5" },
  { id: "control-dimred", flaw: "check", bot: "endure", plant: "dimred", expect: "F5" },
  { id: "control-breath", flaw: "check", bot: "endure", plant: "breath", expect: null },
  { id: "control-dimswing", flaw: "check", bot: "endure", plant: "dimswing", expect: null }, // a flash by the old wording only
  { id: "control-shake", flaw: "prudence", bot: "force", plant: "shake", query: "&shakeclamp=off", expect: "F4" },
  { id: "control-wide", flaw: "prudence", bot: "force", query: "&arena=control-wide", expect: "F6" },
  { id: "control-flatplayer", flaw: "prudence", bot: "force", query: "&innerfx=rim,lambflat", expect: "P2", frames: 600 },
  { id: "control-parts", flaw: "friday", bot: "force", plantParts: true, expect: "F1: planted", frames: 120 },
];

// in the page, per frame: the shake and whether a tell shows, both bodies in frame, and the luminance and saturated
// red share per window (1/16 of the frame, sliding by half; every pixel: a sample of every 4th pixel aliased thin bright
// lines, the character's place ring and his hat brim, into false flashes in the dark inner rooms, PROGRESS 30)
const PROBE = `(() => {
  const A = window.__arena, W = A.W, V = A.view, c = document.getElementById('c'), g = c.getContext('2d');
  const { width: w, height: h } = c, d = g.getImageData(0, 0, w, h).data, ww = w / 4, wh = h / 4, n = 7, L = new Array(n * n).fill(0), R = new Array(n * n).fill(0), N = new Array(n * n).fill(0);
  const LIN = window.__lin ||= Float32Array.from({ length: 256 }, (_, v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }), lin = (v) => LIN[v];
  // sums per half-window cell (8 x 8), then each window is four cells; ?__flashStep = 4 gives the old sampling back
  const STEP = window.__flashStep || 1, CL = new Float64Array(64), CR = new Float64Array(64), CE = new Float64Array(64), CS = new Float64Array(192), CN = new Float64Array(64), cw2 = ww / 2, ch2 = wh / 2, E = new Array(n * n).fill(0), M = Array.from({ length: n * n }, () => [0, 0, 0]);
  for (let y = 0; y < h; y += STEP) { const cy = Math.min(7, Math.floor(y / ch2)); for (let x = 0; x < w; x += STEP) {
    const i = (y * w + x) * 4, r = lin(d[i]), gg = lin(d[i + 1]), b = lin(d[i + 2]), k = cy * 8 + Math.min(7, Math.floor(x / cw2));
    const sat = r / Math.max(1e-6, r + gg + b) >= 0.8; CL[k] += 0.2126 * r + 0.7152 * gg + 0.0722 * b; CR[k] += sat && r > 0.05 ? 1 : 0; CE[k] += sat ? Math.max(0, r - gg - b) * 320 : 0; CS[k * 3] += r; CS[k * 3 + 1] += gg; CS[k * 3 + 2] += b; CN[k]++;
  } }
  for (let oy = 0; oy < n; oy++) for (let ox = 0; ox < n; ox++) { const k = oy * n + ox; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const c2 = (oy + dy) * 8 + ox + dx; L[k] += CL[c2]; R[k] += CR[c2]; E[k] += CE[c2]; N[k] += CN[c2]; for (let j = 0; j < 3; j++) M[k][j] += CS[c2 * 3 + j]; } }
  const inF = (F) => { if (!F) return true; const [x, y] = V.proj(F.x, F.z), [, yt] = V.proj(F.x, F.z, W.defs[F.id].height); return x >= 0 && x <= 640 && y >= 0 && yt <= 360 && y <= 360; };
  const B = W.byId('boss');
  return { tick: W.tick, shake: V.shakeNow || { px: 0, tell: false }, inFrame: inF(W.lamb()) && inF(B && !B.out ? B : null), L: L.map((s, k) => +(s / Math.max(1, N[k])).toFixed(4)), R: R.map((s, k) => +(s / Math.max(1, N[k])).toFixed(4)), E: E.map((s, k) => +(s / Math.max(1, N[k])).toFixed(2)), M: M.map((m, k) => m.map((x) => +(x / Math.max(1, N[k])).toFixed(6))),
    phase: B && B.mem ? B.mem.phase : null, morph: W.events.filter((e) => e.type === 'morph').map((e) => e.phase), tell: W.fighters.some((F) => F.team !== 'lamb' && F.act && W.moves[F.act.id].tell && F.act.f >= W.moves[F.act.id].tell.at[0] && F.act.f <= W.moves[F.act.id].tell.at[1]),
    result: W.result ? W.result.outcome : null, lamb: window.__lambMeasure ? window.__lambMeasure(d, w) : null };
})()`;
// at each still: the parts the forms name, measured in the finished frame, and each form's silhouette alone
const STILL = (plant) => `(() => { const c = document.getElementById('c'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; return window.__stillMeasure(d, c.width, ${plant ? JSON.stringify(plant) : "null"}); })()`;
const PLANTED = [{ name: "planted:empty", box: [604, 318, 10, 10] }, { name: "planted:speck", box: [320, 40, 1, 1] }];
const PLANT = {
  flash5: "(t) => { if (Math.floor(t / 6) % 2) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); } }",
  red2: "(t) => { if (Math.floor(t / 15) % 2) { g.fillStyle = '#ff0000'; g.fillRect(0, 0, c.width / 2, c.height / 2); } }",
  dimred: "(t) => { if (Math.floor(t / 15) % 2) { g.fillStyle = '#5a0000'; g.fillRect(0, 0, c.width / 2, c.height / 2); } }", // (R - G - B) x 320 of about 33, just over WCAG's 20
  dimswing: "(t) => { if (Math.floor(t / 6) % 2) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, c.width, c.height); } }",
  breath: "(t) => { g.fillStyle = 'rgba(255,255,255,' + (0.025 + 0.025 * Math.sin(t / 60 * Math.PI)) + ')'; g.fillRect(0, 0, c.width, c.height); }",
};

// transitions per window: a change from the last extreme of 10% of the brighter value, the darker under 0.80
// WCAG 2.x's wording (05-CARE section 2, changed 2026-10-22): a change of 10% of the maximum relative luminance (1.0),
// the darker state under 0.80. `rel` gives back the old wording (10% of the brighter value) for comparison.
export function transitions(series, { step = 0.1, dark = 0.8, abs = 0, rel = 0 } = {}) {
  const big = (a, b) => (abs ? Math.abs(a - b) >= abs : (rel ? Math.abs(a - b) >= rel * Math.max(a, b) : Math.abs(a - b) >= step) && Math.min(a, b) < dark);
  const out = []; let ext = series[0], dir = 0; // dir: +1 rising since the last transition, -1 falling, 0 none yet
  for (let t = 1; t < series.length; t++) {
    const v = series[t];
    if (dir === 0) { if (big(v, ext)) { dir = v > ext ? 1 : -1; out.push(t); ext = v; } continue; }
    if ((dir > 0 && v >= ext) || (dir < 0 && v <= ext)) { ext = v; continue; } // still going the same way
    if (big(v, ext)) { out.push(t); dir = -dir; ext = v; }
  }
  return out;
}
const mostIn = (ts, span = 60) => { let best = 0; for (let i = 0, j = 0; i < ts.length; i++) { while (ts[i] - ts[j] >= span) j++; best = Math.max(best, i - j + 1); } return best; };

export function judge(frames) {
  const errs = [], n = frames[0] ? frames[0].L.length : 0;
  const tellShake = Math.max(0, ...frames.filter((f) => f.shake.tell).map((f) => f.shake.px)) * 3;
  if (tellShake > 3 + 1e-6) errs.push(`F4: the view shook ${tellShake.toFixed(2)} px at 1080p while a tell showed (at most 3)`);
  let worst = 0, redT = 0, shareT = 0, e20 = 0;
  for (let k = 0; k < n; k++) {
    worst = Math.max(worst, mostIn(transitions(frames.map((f) => f.L[k]))));
    redT += redTransitions(frames.map((f) => f.M[k])).length; // WCAG 2.2's red rule (cine/redflash.mjs)
    e20 += transitions(frames.map((f) => f.E[k]), { abs: 20 }).length; // WCAG 2.0's (R - G - B) x 320, for the record
    shareT += transitions(frames.map((f) => f.R[k]), { abs: 0.05 }).length; // the share count it replaced (2026-10-23), for the record
  }
  if (Math.floor(worst / 2) > 3) errs.push(`F5: ${Math.floor(worst / 2)} flashes in one second in one window (at most 3)`);
  if (redT > 0) errs.push(`F5: ${redT} saturated-red transitions`);
  const out = frames.filter((f) => !f.inFrame).length; if (out) errs.push(`F6: ${out} frames with the character or the boss out of frame`);
  return { errs, tellShake: +tellShake.toFixed(2), flashesPerSecond: Math.floor(worst / 2), redTransitions: redT, redShareTransitions: shareT, redE20Transitions: e20, outOfFrame: out };
}

async function one(B, { flaw, bot, plant = null, query = "", id, shots = true, frames: most = FRAMES, plantParts = false }) {
  const [fl, mv] = flaw.split(":"), P = await B.page(1280, 720);
  await P.go(`http://127.0.0.1:${port}/engine/combat/arena/index.html?mode=inner&flaw=${fl}${mv ? `&movement=${mv}` : ""}&bot=${bot}&seed=2&capture=1${query}`);
  await P.until("!!(window.__arena && window.__arena.inner && window.__arena.W)");
  await P.eval(PAGE);
  if (plant) await P.eval(`(() => { const A = window.__arena, c = document.getElementById('c'), g = c.getContext('2d'), V = A.view, d = V.draw, f = ${PLANT[plant] || "() => {}"}; let t = 0;
    V.draw = () => { ${plant === "shake" ? "const W = A.W; if (W.fighters.some((F) => F.team !== 'lamb' && F.act && W.moves[F.act.id].tell && F.act.f >= W.moves[F.act.id].tell.at[0] && F.act.f <= W.moves[F.act.id].tell.at[1])) { V.kick = { amp: 4.8, dir: [1, 0], f: 2, len: 12 }; }" : ""} d(); f(t++); }; return true; })()`);
  const frames = [], stills = [], measured = [], tag = id || `${flaw.replace(":", "-m")}-${bot}`; let endAt = -1, lastPhase = null, tellShot = {}, handsAt = -1;
  // a control measures its stills without writing them
  const shoot = async (what) => { if (!shots && !plantParts) return; const name = `${tag}-${what}.png`; await sleep(30); if (shots) await P.shot(join(out, name)); stills.push(name); measured.push({ still: name, ...(await P.eval(STILL(plantParts ? PLANTED : null))) }); };
  for (let f = 0; f < most; f++) {
    await P.eval("window.__arena.tick(1 / 60)");
    const r = await P.eval(PROBE); frames.push(r);
    if (f === 45) await shoot(`p${r.phase ?? 0}-form-f${f}`);
    if (r.tell && !tellShot[r.phase]) { tellShot[r.phase] = true; await shoot(`p${r.phase ?? 0}-tell-f${f}`); }
    if (r.morph.length) lastPhase = { at: f, phase: r.morph[0] };
    if (lastPhase && f === lastPhase.at + 20) await shoot(`p${lastPhase.phase}-morph-f${f}`);
    if (lastPhase && f === lastPhase.at + 70) await shoot(`p${lastPhase.phase}-settled-f${f}`);
    // the hands a boss calls in (the coats, the carts): one still a second after the first comes
    if (handsAt < 0 && (await P.eval("window.__arena.W.fighters.some((F) => F.id.includes('-hand') && !F.out)"))) handsAt = f;
    if (handsAt >= 0 && f === handsAt + 60) await shoot(`p${r.phase ?? 0}-hands-f${f}`);
    if (r.result && endAt < 0) endAt = f;
    if (endAt >= 0 && f === endAt + 20) { await shoot(`end-${r.result}-f${f}`); break; }
  }
  const logs = P.logs.filter((l) => /error/i.test(l)).slice(0, 5);
  if (opt.dump) await writeFile(join(out, `${tag}-frames.json`), JSON.stringify(frames));
  await P.close();
  const pl = judgePlayer(frames), ft = judgeFeatures(measured), j = judge(frames);
  return { tag, flaw, bot, result: frames.at(-1) && frames.at(-1).result, frames: frames.length, stills, ...j, errs: [...j.errs, ...pl.errs, ...ft.errs], player: pl, parts: ft.parts, measured, logs };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("combat/tools/inner-capture.mjs")) {
  await mkdir(out, { recursive: true });
  const only = opt.only ? String(opt.only).split(",") : null, B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), rows = [], controls = [];
  try {
    for (const [flaw, bot] of CASES) { if (only && !only.includes(`${flaw}:${bot}`) && !only.includes(flaw)) continue; const r = await one(B, { flaw, bot, query: opt.query ? `&${opt.query}` : "" }); rows.push(r); console.log(`${r.tag}: ${r.result || "running"} after ${r.frames} frames; shake under tells ${r.tellShake} px; ${r.flashesPerSecond} flashes/s; red ${r.redTransitions}; out of frame ${r.outOfFrame}; player >= ${r.player.h1080Min} px at 1080 (any pose ${r.player.h1080MinAny}), outline read ${r.player.sepMin} (median ${r.player.sepMedian}); ${r.stills.length} stills${r.errs.length ? `\n  ERROR ${r.errs.join("\n  ERROR ")}` : ""}${r.logs.length ? `\n  page: ${r.logs.join(" | ")}` : ""}`); }
    if (rows.length) { const sil = judgeSilhouettes(rows.flatMap((r) => r.measured)); rows.silhouettes = sil; console.log(`silhouettes: ${sil.kinds.length} forms and looks; closest pairs ${sil.worst.map((p) => `${p.a}/${p.b} ${p.iou}`).join(", ")}${sil.errs.length ? `\n  ERROR ${sil.errs.join("\n  ERROR ")}` : ""}`); }
    if (!opt["no-controls"]) for (const C of CONTROLS) {
      const r = await one(B, { ...C, shots: false }), failed = C.expect ? r.errs.some((e) => e.startsWith(C.expect)) : !r.errs.length;
      controls.push({ id: C.id, expect: C.expect, ok: failed, errs: r.errs }); console.log(`  control ${C.id}: ${C.expect ? (failed ? "fails, as it must" : "PASSES: the check is broken") : failed ? "passes, as it must" : `FAILS: ${r.errs.join("; ")}`}`);
    }
  } finally { await B.close(); }
  await writeFile(join(out, "summary.json"), JSON.stringify({ rows, silhouettes: rows.silhouettes || null, controls }, null, 1));
  if (rows.some((r) => r.errs.length) || (rows.silhouettes && rows.silhouettes.errs.length) || controls.some((c) => !c.ok)) process.exit(1);
}
