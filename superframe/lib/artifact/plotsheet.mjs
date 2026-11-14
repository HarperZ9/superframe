// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plotsheet.mjs: the engine's door to Plot Sheet (packages/plot-sheet). Plot Sheet itself is BuildLang; this file
// only turns the engine's 'vector' shape into the plot input text, finds or builds the program, and runs it. It holds
// no geometry, ordering or file format of its own, so it goes away unchanged when the make command moves to BuildLang.
//
// The specification is plot input statements without paths (packages/plot-sheet/bld/input.bld lists them), from a
// named sheet below or from a file. Line artifacts carry two kinds of stroke, contours and hatching; with two or more
// pens the contours go to pen 1 and the hatching to pen 2, the caller-assigned mapping Plot Sheet takes as given.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PENS = 'pen 0.3 #15130f 60 - contour\npen 0.5 #8a4b2a 60 - hatch';
export const SHEETS = {
  a4: `paper 297 210\nmargin 12\n${PENS}`,
  a3: `paper 420 297\nmargin 15\n${PENS}`,
  letter: `paper 279.4 215.9\nmargin 12\n${PENS}`,
};

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exe = join(root, 'packages/plot-sheet/bld/target/release', process.platform === 'win32' ? 'main.exe' : 'main');

// The program: PLOT_SHEET_BIN, or the release build in the package, built on first use with BUILDC (default buildc).
export function plotSheetProgram({ build = true } = {}) {
  if (process.env.PLOT_SHEET_BIN) return process.env.PLOT_SHEET_BIN;
  if (existsSync(exe)) return exe;
  if (!build) return null;
  const r = spawnSync(process.env.BUILDC ?? 'buildc', ['build', '--release', join(root, 'packages/plot-sheet/bld')], { encoding: 'utf8' });
  if (r.error || r.status !== 0 || !existsSync(exe)) throw new Error(`plot sheet: could not build packages/plot-sheet/bld with buildc (${r.error?.message ?? (r.stderr || r.stdout || '').trim().slice(-300)}). Install BuildLang, or set PLOT_SHEET_BIN.`);
  return exe;
}

// The plot input text for a vector V = { w, h, paths: [{ pts, closed, pen?, hatch?, stroke? }] } and a specification.
// A path's pen, counted from one, is its own `pen` when it has one; otherwise hatching goes to pen 2 and the rest to pen 1.
// fit: 'frame' scales the vector's whole frame onto the printable area; 'ink' scales the bounding box of the paths.
export function plotInput(V, spec, { title = '', seed = '', fit = 'frame' } = {}) {
  const body = SHEETS[spec] ?? spec, pens = (body.match(/^pen /gm) ?? []).length, f = v => +v.toFixed(3);
  const one = t => String(t).replace(/\s+/g, ' ').trim();
  const head = ['plotsheet 1', title && `title ${one(title)}`, seed && `seed ${one(seed)}`, fit === 'frame' && `source ${V.w} ${V.h}`, body].filter(Boolean);
  const rows = V.paths.filter(p => p.pts.length > 1).map(p => `${p.closed ? 'loop' : 'path'} ${Math.min(pens, p.pen ?? (p.hatch ? 2 : 1))} ${/^#[0-9a-f]{6}$/i.test(p.stroke ?? '') ? p.stroke : '#000000'} 0 ${p.pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' ')}`);
  return head.concat(rows).join('\n') + '\n';
}

// Writes plot.plot (the input), plot.svg, plot.hpgl, plot.gcode and plot.json into dir; opts.name renames them. Returns { files, summary, stats }.
export function plotSheet(V, spec, dir, opts = {}) {
  const name = opts.name ?? 'plot', input = join(dir, `${name}.plot`), base = join(dir, name);
  writeFileSync(input, plotInput(V, !SHEETS[spec] && existsSync(spec) ? readFileSync(spec, 'utf8') : spec, opts));
  const r = spawnSync(plotSheetProgram(), [input, base, '--verify'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`plot sheet failed: ${r.error?.message ?? (r.stdout + r.stderr).trim()}`);
  const files = ['plot', 'svg', 'hpgl', 'gcode', 'json'].map(e => `${name}.${e}`);
  return { files, summary: r.stdout.split(/\r?\n/)[0], stats: JSON.parse(readFileSync(`${base}.json`, 'utf8')) };
}
