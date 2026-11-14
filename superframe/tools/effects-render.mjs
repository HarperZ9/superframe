// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// tools/effects-render.mjs: render one wordmark direction's hero still for the effects pass (2026-10-28).
//   node tools/effects-render.mjs <id> <out.png> [--look corrected|bold] [--ss N] [--w 3840 --h 2160]
// The PNG goes through the name-art encoder (the wordmark export path), so before and after share one writer.
import { savePNG } from '../../name-art/lib/img.mjs';
import { renderDirection, SEED } from '../lib/wordmark/index.mjs';
const [id, out] = process.argv.slice(2), arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const W = +(arg('--w') ?? 3840), H = +(arg('--h') ?? 2160), look = arg('--look') ?? 'corrected', ss = arg('--ss'), t0 = Date.now();
const r = await renderDirection(id, W, H, { mode: 'still', seed: SEED, look, ss: ss ? +ss : null });
savePNG(r.image, out, `${SEED}/${id}/still`);
console.log(`${id} ${look} ${W}x${H} ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
