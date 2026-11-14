// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// looks.mjs: how each wordmark direction is finished, in two looks (effects pass, 2026-10-28).
//   corrected  the direction as designed, on the corrected core: film grain at a level the eye and the R4 measure can
//              see (2.4 to 3.2 codes at the peak, against 1.2 to 1.6 before, which measured 0.4 and drowned under the
//              dither), the hue-preserving shoulder, and AgX for the one scene-lit piece (apertures).
//   bold       the same piece pushed toward the energy of the author's saved references: the word fills the frame
//              (references leave 20 to 35% negative space; the directions left 66 to 75%), chroma lifted to the
//              references' 16 to 27 C*, light pushed into real highlights, heavier grain. Each direction's own bold
//              moves live in its render (look === 'bold'); this file holds the shared finish.
import { grain, down } from '../../../name-art/lib/img.mjs';
import { agx } from '../look/tone.mjs';
import { chroma } from '../look/colour.mjs';

export const BOLD_BOX = [0.025, 0.1, 0.975, 0.9];
export const boxFor = (look, box) => (look === 'bold' ? BOLD_BOX : box);

// grain: SD in codes at the peak; tone: 'display' or 'agx' (with exposure and punch); lift: final OKLab chroma scale.
export const FINISH = {
  // smalti stays at 1x: its tiler lays a different pattern at 2x (tile size and seeds follow the pixel grid), so a
  // supersampled frame would not be the same mosaic
  smalti: { corrected: { grain: 2.6 }, bold: { grain: 3.6, lift: 1.25 } },
  apertures: { corrected: { grain: 2.4, tone: 'agx', exposure: 0.5, punch: 1.35, ss: 2 }, bold: { grain: 3.4, tone: 'agx', exposure: 1.3, punch: 1.4, ss: 2 } },
  strata: { corrected: { grain: 2.8, ss: 2 }, bold: { grain: 3.8, lift: 2.4, ss: 2 } },
  intaglio: { corrected: { grain: 3.0 }, bold: { grain: 4.0 } },
  marbling: { corrected: { grain: 2.6 }, bold: { grain: 3.4, lift: 1.5 } },
  stencil: { corrected: { grain: 3.2 }, bold: { grain: 0 } },
};

// Finish a raw render: downsample a supersampled frame, lift, tone (scene pieces only), grain last.
export function finish(id, look, I, W, seed, ss = 1) {
  const F = FINISH[id]?.[look] ?? FINISH[id]?.corrected ?? { grain: 2.6 };
  let O = ss > 1 ? down(I, ss) : I;
  if (F.lift) chroma(O, F.lift);
  if (F.tone === 'agx') { agx(O.px, { exposure: F.exposure ?? 0, punch: F.punch ?? 1 }); O.toned = true; }
  if (F.grain > 0) O = grain(O, { amount: F.grain, seed: `${seed}/${id}/grain/${look}`, radius: Math.max(1, W / 1600) });
  return O;
}
export const ssFor = (id, look) => FINISH[id]?.[look]?.ss ?? 1;
