// node.test.mjs: the nameart.word superframe node, run the way the superframe's own golden test runs every node
// (alone, fed by default sources, well-typed, byte-for-byte repeatable), plus any-word and every-style cases.
// It keeps its own golden hashes here, so the superframe's golden file is never written by this agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { registry } from '../../superframe/lib/registry.mjs';
import { evaluate } from '../../superframe/lib/graph.mjs';
import { soloRecipe } from '../../superframe/lib/autofeed.mjs';
import { checkValue } from '../../superframe/lib/types.mjs';
import { STYLES } from '../superframe/nameart.mjs';

const GOLD = new URL('./golden/node.json', import.meta.url), gold = existsSync(GOLD) ? JSON.parse(readFileSync(GOLD, 'utf8')) : {}, fresh = {};
const digest = R => createHash('sha256').update(Buffer.from(R.data.buffer)).digest('hex').slice(0, 16);

test('nameart.word is registered through the drop-in hook', () => { assert.ok(registry.has('nameart.word')); });

for (const style of Object.keys(STYLES)) for (const text of ['Zain Dana Harper', 'Low Water']) {
  test(`${style}: "${text}"`, async () => {
    const r = { schema: 'superframe.recipe/1', seed: 'golden', size: [96, 54], nodes: [{ id: 'n', node: 'nameart.word', params: { text, style } }], out: { image: 'n' } };
    const a = await evaluate(r, registry), b = await evaluate(r, registry), A = a.values.get('n').raster, B = b.values.get('n').raster;
    assert.equal(checkValue('raster', A), null);
    const d = digest(A); assert.equal(d, digest(B), 'repeats byte for byte'); fresh[`${style}/${text}`] = d;
    if (gold[`${style}/${text}`] && !process.env.UPDATE_GOLDEN) assert.equal(d, gold[`${style}/${text}`], 'matches the stored golden');
  });
}
test('the node runs alone through soloRecipe like every superframe node', async () => {
  const r = soloRecipe(registry.get('nameart.word'), { size: [64, 64], seed: 'golden', media: false });
  const a = await evaluate(r, registry); assert.equal(checkValue('raster', a.values.get('n').raster), null);
});
test.after(() => { if (process.env.UPDATE_GOLDEN || Object.keys(fresh).some(k => !gold[k])) writeFileSync(GOLD, JSON.stringify({ ...gold, ...fresh }, null, 1)); });

test('nameart.textfield: registered, a well-typed field, ink only inside the word', async () => {
  assert.ok(registry.has('nameart.textfield'));
  const r = { schema: 'superframe.recipe/1', seed: 'golden', size: [320, 180], nodes: [{ id: 'f', node: 'nameart.textfield', params: { word: 'Low', pitch: 6 } }], out: { field: 'f' } };
  const F = (await evaluate(r, registry)).values.get('f').field;
  assert.equal(checkValue('field', F), null);
  let ink = 0, edge = 0; for (let i = 0; i < F.data.length; i++) { ink += F.data[i]; if ((i % 320) < 8 && F.data[i] > 0) edge++; }
  assert.ok(ink > 50, 'text cells carry ink'); assert.equal(edge, 0, 'no ink outside the word at the frame edge');
});
