// tools.test.mjs: the agent surface lists every tool with a schema and answers compile and convert-path calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, callTool } from '../lib/tools.mjs';
import { techniques } from '../lib/registry.mjs';

test('every tool has a name, a description and an object schema', () => {
  for (const t of TOOLS) assert.ok(t.name.startsWith('superframe_') && t.description && t.inputSchema.type === 'object', t.name);
});
test('list covers every technique; compile reports lanes and the dual edge', async () => {
  assert.equal((await callTool('superframe_list')).length, techniques().length);
  const c = await callTool('superframe_compile', { recipe: { seed: 'a', nodes: [{ id: 'd', node: 'data.series' }, { id: 'b', node: 'brush.stroke', in: { vector: 'd' } }], out: { image: 'b' } } });
  assert.deepEqual(c.lanes.sort(), ['data', 'image']);
  assert.equal(c.dualEdge.pass, true);
  assert.deepEqual(await callTool('superframe_convert_path', { from: 'series', to: 'vector' }), ['convert.series-vector']);
});

test('no code follows a trailing // comment anywhere in the superframe (the swallowed-line bug of 2026-10-26)', async () => {
  const { swallowed } = await import('../tools/check_comment_swallow.mjs');
  assert.equal(swallowed('this.tracers = {};   // named substances this.wind = 0; this.sound = null;').length, 1, 'the real bug is caught');
  assert.equal(swallowed('// a = 29.75, held-out dE 3.7; a saturating curve').length, 0, 'prose in a whole-line comment is not');
  // the UI agent's cases (2026-10-26): the first two must flag, the last two must not
  assert.equal(swallowed('foo(); // drying: spread fades gl.uniform1f(u.uShift, shift);').length, 1);
  assert.equal(swallowed('const a = 1; // note this.x = 0;').length, 1);
  assert.equal(swallowed('const b = 2; // plain prose here').length, 0);
  // the second rule (a swallowed object entry, 2026-10-26): a comment that closes what the code left open
  assert.equal(swallowed('const bar = { a: [1, 2], line: [3, 4],   // note am: [5, 6] };').length, 1);
  assert.equal(swallowed('const f = (a, b) => g({ a,   // keep (b) prose').length, 0, 'an open bracket with prose after it is not');
  assert.equal(swallowed(String.raw`return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.trim());`).length, 0, 'an escaped slash in a regex is not a comment');
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['tools/check_comment_swallow.mjs'], { cwd: new URL('..', import.meta.url) });
});
