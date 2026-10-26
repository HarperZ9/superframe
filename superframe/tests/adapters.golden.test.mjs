// adapters.golden.test.mjs: every technique node runs alone (fed by default sources), returns well-typed values on
// every port, repeats byte for byte, and matches its stored golden hash. A changed hash means the node's output
// changed: look at the picture (node tools/sweep.mjs), then refresh with
//   UPDATE_GOLDEN=1 node --test tests/adapters.golden.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { registry, techniques } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { soloRecipe } from '../lib/autofeed.mjs';
import { checkValue } from '../lib/types.mjs';

const GOLD = new URL('./golden/nodes.json', import.meta.url), update = process.env.UPDATE_GOLDEN === '1';
const gold = existsSync(GOLD) ? JSON.parse(readFileSync(GOLD, 'utf8')) : {}, fresh = {};
const digest = v => {
  const hsh = createHash('sha256');
  const walk = x => { if (ArrayBuffer.isView(x)) hsh.update(Buffer.from(x.buffer, x.byteOffset, x.byteLength)); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') for (const k of Object.keys(x).sort()) { hsh.update(k); walk(x[k]); } else hsh.update(String(x)); };
  walk(v); return hsh.digest('hex').slice(0, 16);
};
// analog.scan and analog.recording read files named by a path parameter; they are covered by export.test.mjs
const runnable = techniques().filter(n => !Object.values(n.params).some(p => p.type === 'string' && !p.options?.length && !p.default));

for (const def of runnable) {
  test(def.id, async () => {
    const r = soloRecipe(def, { size: [64, 64], seed: 'golden', media: false });
    const a = await evaluate(r, registry), b = await evaluate(r, registry);
    const node = a.values.get('n'), again = b.values.get('n');
    for (const [port, type] of Object.entries(def.outputs)) assert.equal(checkValue(type, node[port]), null, port);
    const pick = v => Object.fromEntries(Object.keys(def.outputs).map(p => [p, v[p]]));
    const d = digest(pick(node));
    assert.equal(d, digest(pick(again)), 'repeats byte for byte');
    fresh[def.id] = d;
    if (!update && gold[def.id]) assert.equal(d, gold[def.id], 'matches the stored golden');
  });
}
test.after(() => { if (update || Object.keys(fresh).some(k => !gold[k])) writeFileSync(GOLD, JSON.stringify({ ...gold, ...(update ? fresh : Object.fromEntries(Object.entries(fresh).filter(([k]) => !gold[k]))) }, null, 1)); });
