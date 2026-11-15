// Render the score's pieces to WAV for listening, with a measurement report per piece.
//   node tools/audio-render.mjs [ids ...] [--out ../capture/audio-2026-10-21] [--seed 1] [--stems]
// For each piece: <id>.wav (the listening mix: the piece's own script through the runtime mixer, normalised
// to its target LUFS, limited to -1 dBTP), and <id>.json (loudness, true peak, clipped samples, the loop
// seam, render time). --stems also writes every stem, unnormalised, for checking a layer on its own.
// Run under the machine lock: node ../../tools/gpu-lock.mjs run --lock heavy-cpu "audio render" -- node tools/audio-render.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../audio/score.mjs";
import { mixdown, normalise, wav16, report, limit } from "../audio/master.mjs";
import { seam, clipped } from "../audio/lib/analysis.mjs";
import { sealRender } from "../audio/receipt.mjs";
import { ALL as PIECES } from "../audio/pieces/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = opt("--out", join(here, "..", "..", "capture", "audio-2026-10-21")), seed = +opt("--seed", 1);
const ids = [];
for (let i = 0; i < args.length; i++) { if (args[i] === "--out" || args[i] === "--seed") i++; else if (!args[i].startsWith("--")) ids.push(args[i]); }
mkdirSync(out, { recursive: true });

// the loop seam is measured on the plain sum of the base stems (every layer up, no automation)
function loopSeam(piece, R) {
  const L = new Float32Array(R.n), Rr = new Float32Array(R.n);
  for (const [id, [a, b]] of Object.entries(R.stems)) if (!id.includes("@")) for (let i = 0; i < R.n; i++) { L[i] += a[i]; Rr[i] += b[i]; }
  return seam([L, Rr]);
}

function one(piece, name, opts, script, passes) {
  const t0 = Date.now(), R = render(piece, { seed, ...opts }), tRender = Date.now() - t0;
  const { pair } = mixdown(piece, R, script, passes);
  const pre = clipped(pair);
  const norm = piece.target == null ? (limit(pair, Math.pow(10, -1.3 / 20)), { gainDb: 0 }) : normalise(pair, piece.target);
  const rep = { id: name, title: piece.title, seconds: +(pair[0].length / 44100).toFixed(1), renderMs: tRender, totalMs: Date.now() - t0,
    ...report(pair), clippedAfter: clipped(pair), clippedBeforeNormalise: pre, normaliseDb: +norm.gainDb.toFixed(2),
    seam: piece.loop ? loopSeam(piece, R) : null, stems: R.ids, gameGainDb: piece.game ?? 0, seed, opts };
  const sealed = sealRender({ id: name, title: piece.title, pair, seed, target: piece.target, game: piece.game ?? 0 });
  rep.superstack = { integrated_lufs: sealed.lufs, receipt_errors: sealed.errors, music_check: sealed.receipt.outputs.superstack_music_check, receipt_sha256: sealed.receipt.receipt_sha256 };
  writeFileSync(join(out, `${name}.wav`), sealed.wav);
  writeFileSync(join(out, `${name}.receipt.json`), JSON.stringify(sealed.receipt, null, 2));
  writeFileSync(join(out, `${name}.json`), JSON.stringify(rep, null, 2));
  if (args.includes("--stems")) for (const [sid, p] of Object.entries(R.stems)) writeFileSync(join(out, `${name}.stem.${sid.replace("@", "-")}.wav`), wav16(p, seed));
  const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
  console.log(`${name}: ${rep.seconds}s  I ${f(rep.integrated)} LUFS (superstack ${f(sealed.lufs)}, receipt ${sealed.errors.length ? "ERRORS " + sealed.errors : "ok"})  S-max ${f(rep.shortMax)}  TP ${f(rep.truePeak)} dBTP  clipped ${rep.clippedAfter}` +
    (rep.seam ? `  seam jump x${rep.seam.jumpRatio.toFixed(2)} level ${rep.seam.levelDb.toFixed(2)} dB` : "") + `  (${(rep.totalMs / 1000).toFixed(1)} s)`);
}

for (const id of ids.length ? ids : Object.keys(PIECES)) {
  const [base, alt] = id.split(":"), piece = PIECES[base];
  if (!piece) { console.error(`no piece ${id}`); process.exitCode = 1; continue; }
  const L = piece.listen || {};
  if (!alt) one(piece, base, {}, L.script || [], L.passes || 1);
  for (const [name, a] of Object.entries(piece.alts || {})) if (!alt || alt === name) one(piece, name, a.opts || {}, a.script || L.script || [], a.passes || L.passes || 1);
}
