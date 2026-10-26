// registry.test.mjs: the adapter loader fails loudly. A drop-in adapter that does not import must stop the load with
// its path and error (a control that can fail: the broken fixture has to fail the run, and the good one has to pass).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadAdapters, techniques } from '../lib/registry.mjs';

const DIR = fileURLToPath(new URL('./fixtures/adapters-broken/', import.meta.url));

test('a broken adapter fails the load, naming its path and its error', async () => {
  await assert.rejects(loadAdapters(DIR), e => /broken\.mjs/.test(e.message) && /SyntaxError/.test(e.message));
});

test('the same folder without the broken file loads', async () => {
  const out = await loadAdapters(DIR, new Set(['broken.mjs']));
  assert.deepEqual(Object.keys(out), ['good']);
});

test('the real adapters folder loads with every technique', () => {
  assert.ok(techniques().length > 150);
});
