// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// render.mjs: one recipe, every medium. compute() returns the raw outputs (tests read these); write() puts them on
// disk with a manifest of SHA-256 hashes, so the same recipe and seed can be checked byte for byte.
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalise, recipeHash } from './ir.mjs';
import { simulate } from './simulate.mjs';
import { detail, grey, asData, writePNG, upsample } from './common.mjs';
import { material } from './material.mjs';
import { paint } from './paint.mjs';
import { type, textOf } from './type.mjs';
import { lines } from './lines.mjs';
import { sound, tactile } from './sound.mjs';
import { study, studyText } from './study.mjs';

export function compute(recipe, { only = null } = {}) {
  const r = normalise(recipe), t0 = Date.now(), layers = simulate(r), times = { simulate: Date.now() - t0 };
  const [W, H] = r.size, D = detail(r, W, H), out = { r, layers, times };
  const step = (k, f) => { const t = Date.now(); out[k] = f(); times[k] = Date.now() - t; };
  step('material', () => material(r, layers, D));
  step('paint', () => paint(r, layers, out.material, D));
  if (!only || only.includes('type')) step('type', () => type(r, layers, out.paint.rgb));
  if (!only || only.includes('lines')) step('lines', () => lines(r, layers));
  if (!only || only.includes('sound')) step('sound', () => sound(r, layers));
  if (!only) step('study', () => study(r, layers, out));
  out.hash = recipeHash({ ...r, intent: recipe.intent, report: recipe.report });
  return out;
}

const sha = b => createHash('sha256').update(b).digest('hex');

export function write(out, dir, { intent = '', title = '' } = {}) {
  mkdirSync(dir, { recursive: true });
  const { r } = out, [W, H] = r.size, files = {}, put = (name, bytes) => { writeFileSync(join(dir, name), bytes); files[name] = { sha256: sha(bytes), bytes: bytes.length }; };
  const png = (name, rgb, w = W, h = H) => { files[name] = { sha256: sha(writePNG(join(dir, name), rgb, w, h)) }; };
  png('paint.png', out.paint.rgb);
  png('paint-tungsten.png', upsample(out.paint.sim.A, r.sim[0], r.sim[1], W, H, 3));
  png('type.png', out.type.rgb);
  png('lines.png', out.lines.rgb); put('lines.svg', Buffer.from(out.lines.svg()));
  png('material-lit.png', out.material.preview());
  png('material-height.png', grey(out.material.height.map(asData)));
  png('material-roughness.png', grey(out.material.rough.map(asData)));
  png('material-normal.png', (() => { const N = out.material.N, o = new Float32Array(N.length); for (let i = 0; i < N.length; i++) o[i] = asData(N[i] * 0.5 + 0.5); return o; })());
  put('sound.wav', Buffer.from(out.sound.bytes()));
  put('tactile.json', Buffer.from(JSON.stringify(tactile(out.sound))));
  put('study.json', Buffer.from(JSON.stringify(out.study, null, 1)));
  put('study.md', Buffer.from(studyText(r, out.study, { intent, title, text: textOf(r), levels: out.lines.levels })));
  put('recipe.json', Buffer.from(JSON.stringify({ ...r, intent, report: out.report }, null, 1)));
  const manifest = { schema: 'superframe.artifact.manifest/1', recipe_hash: out.hash, seed: r.seed, size: r.size, times_ms: out.times, files };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
}
