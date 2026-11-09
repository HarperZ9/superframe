#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// studio: the design studio from the command line. Every output is seeded: the same command writes the same bytes.
//
//   node packages/studio/bin/studio.mjs list                                   materials, lanes and nodes
//   node packages/studio/bin/studio.mjs image <material> [--seed 4] [--size 1280x800] [--out x.png]
//   node packages/studio/bin/studio.mjs font [--seed 58] [--weight 0.085] [--style Regular] [--out x.ttf]
//   node packages/studio/bin/studio.mjs variable [--seed 58] [--out x.ttf]    one variable font, weight axis
//   node packages/studio/bin/studio.mjs eye <material> [--seed 4] [--vs 5] [--size 640x400]
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mint, DEFAULTS } from '../../../typeface/forge/upstream/type-forge/forge.mjs';
import { STUDIO, byId, renderImage, toRGBA, toTtf, mintVariableFamily, eyeOf, compareDrift } from '../src/index.mjs';

const argv = process.argv.slice(2), cmd = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i > 0 ? argv[i + 1] : d; };
const num = (k, d) => { const v = Number(opt(k, d)); if (!Number.isFinite(v)) throw new Error(`--${k} must be a number`); return v; };
const size = d => { const [w, h] = String(opt('size', d)).split('x').map(Number); if (!(w >= 8 && h >= 8)) throw new Error('--size must be WxH, each at least 8'); return [w, h]; };
const sha = b => createHash('sha256').update(b).digest('hex');
const save = (bytes, out, what) => { writeFileSync(out, bytes); console.log(`${what}: ${out} (${bytes.length} bytes, sha256 ${sha(bytes)})`); };

function material(id) {
  const m = byId(id);
  if (!m) throw new Error(`unknown material "${id}"; one of: ${STUDIO.materials.join(', ')}`);
  return m;
}

// 8-bit RGBA PNG, no filters, so the file is a plain function of the pixels.
function png(rgba, w, h) {
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const td = Buffer.concat([Buffer.from(type), data]), o = Buffer.alloc(8 + data.length + 4); o.writeUInt32BE(data.length); td.copy(o, 4); o.writeUInt32BE(crc(td), 8 + data.length); return o; };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const picture = (m, seed, w, h) => toRGBA(renderImage(m, { w, h, seed, marks: false }), m);

const COMMANDS = {
  list() {
    console.log(`materials (${STUDIO.materials.length}): ${STUDIO.materials.join(', ')}`);
    console.log(`lanes: ${STUDIO.lanes.join(', ')}`);
    console.log(`nodes: ${STUDIO.nodes.map(n => n.id).join(', ')}`);
  },
  image() {
    const m = material(argv[1]), seed = num('seed', 4), [w, h] = size('1280x800');
    save(png(picture(m, seed, w, h), w, h), opt('out', `${m.id}-s${seed}.png`), `image ${m.id} seed ${seed}`);
  },
  font() {
    const seed = num('seed', 58), weight = num('weight', DEFAULTS.weight), style = opt('style', 'Regular');
    const face = mint({ ...DEFAULTS, weight }, seed);
    if (face.refused) { console.error(`refused: ${face.refusals.join('; ')}`); process.exitCode = 2; return; }
    save(toTtf(face, opt('family', 'Zain Mint'), style), opt('out', `zain-mint-${style.toLowerCase()}.ttf`), `font ${style} weight ${weight}`);
  },
  variable() {
    const r = mintVariableFamily({}, { seed: num('seed', 58), family: opt('family', 'Zain Mint') });
    for (const x of r.refusedInstances) console.log(`refused ${x.style}: ${x.refusals.join('; ')}`);
    if (r.refused) { console.error(`refused: ${r.refusals.join('; ')}`); process.exitCode = 2; return; }
    save(r.ttf, opt('out', 'zain-mint-variable.ttf'), `variable font, masters ${r.masters.map(m => m.style).join(', ')}`);
  },
  eye() {
    const m = material(argv[1]), seed = num('seed', 4), vs = num('vs', seed + 1), [w, h] = size('640x400');
    const a = picture(m, seed, w, h), b = picture(m, vs, w, h), ea = eyeOf(a, w, h), eb = eyeOf(b, w, h);
    console.log(JSON.stringify({ material: m.id, seed, phash: ea.phash, features: ea.features, vs: { seed: vs, phash: eb.phash },
      drift: compareDrift(sha(a), sha(b), ea.phash, eb.phash) }, null, 1));
  },
};

if (!COMMANDS[cmd]) {
  console.error('usage: studio list | image <material> | font | variable | eye <material>   (see the header of this file)');
  process.exitCode = 1;
} else {
  try { COMMANDS[cmd](); } catch (e) { console.error(`studio ${cmd}: ${e.message}`); process.exitCode = 1; }
}
