// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// index.mjs: the design studio as one import. The material model and its four lanes live in ../../../studio/lib
// (the published studio folder); this package adds the parts ported in from older work (fonts, the eye) and a
// description a front end can build its controls from.
import { MATERIALS, byId } from '../../../studio/lib/materials.mjs';
import { CORE, SCHEMA, normalize, validate, hashMaterial } from '../../../studio/lib/schema.mjs';
import { blend } from '../../../studio/lib/blend.mjs';
import { NODES } from '../../../studio/lib/nodes.mjs';
import { renderImage, toRGBA } from '../../../studio/lib/lanes/image.mjs';
import { score, hashScore } from '../../../studio/lib/lanes/sound.mjs';
import { motion } from '../../../studio/lib/lanes/motion.mjs';
import { typeSpec } from '../../../studio/lib/lanes/type.mjs';
import { perceive } from '../../../studio/lib/recipients.mjs';
import { toTtf } from './font/ttf.mjs';
import { toVariableTtf, mintVariableFamily, INSTANCES } from './font/variable.mjs';
import { perceptualHash, features, hamming, compareDrift, identitySha256, eyeOf } from './eye.mjs';

// What a front end needs to draw the studio's controls: the materials, every core number with its range and
// unit, the lanes, and each node's ports and parameters. Plain data, safe to JSON.stringify.
export const STUDIO = Object.freeze({
  schema: SCHEMA,
  materials: MATERIALS.map(m => m.id),
  core: Object.fromEntries(Object.entries(CORE).map(([k, [min, max, unit, dflt]]) => [k, { min, max, unit, default: dflt }])),
  lanes: ['type', 'image', 'motion', 'sound'],
  nodes: NODES.map(({ id, kind, inputs, outputs, params }) => ({ id, kind, inputs, outputs, params })),
  ports: { font: ['toTtf', 'toVariableTtf', 'mintVariableFamily'], eye: ['perceptualHash', 'features', 'hamming', 'compareDrift', 'eyeOf'] },
});

export {
  MATERIALS, byId, CORE, SCHEMA, normalize, validate, hashMaterial, blend, NODES,
  renderImage, toRGBA, score, hashScore, motion, typeSpec, perceive,
  toTtf, toVariableTtf, mintVariableFamily, INSTANCES,
  perceptualHash, features, hamming, compareDrift, identitySha256, eyeOf,
};
