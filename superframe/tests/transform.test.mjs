// transform.test.mjs: the language edges say only what the input holds, and the room's recipes all run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { storyBeats, voiceLine, explainCode, textToSeries, describeSound, describePicture } from '../lib/transform.mjs';
import { make } from '../lib/types.mjs';
import { make as roomMake } from '../room/serve.mjs';
import { KINDS } from '../room/recipes.mjs';

test('a sentence splits into beats without breaking words, and punctuation ends a beat', () => {
  assert.deepEqual(storyBeats('I like the sea. Do you?'), ['I like the', 'sea.', 'Do you?']);
  assert.deepEqual(storyBeats(''), ['']);
});
test('a question rises at its end and a full stop falls', () => {
  const q = voiceLine('Do you swim?').events, s = voiceLine('Do you swim.').events;
  assert.ok(q.at(-1).args.note > s.at(-1).args.note);
});
test('code is read as structure, and nothing runs it', () => {
  const t = explainCode('function add(a, b) {\n  // sum two numbers\n  return a + b;\n}\nprocess.exit(1)');
  assert.match(t, /one function: add/); assert.match(t, /sum two numbers/); assert.match(t, /gives back a result/);
});
test('words become numbers and descriptions stay literal', () => {
  assert.deepEqual(Array.from(textToSeries('a bb ccc').y), [1, 2, 3]);
  const silent = make.audio(48000, [new Float32Array(48000)]);
  assert.match(describeSound(silent), /1\.0 seconds long/);
  const R = make.raster(4, 4); for (let i = 0; i < 16; i++) R.data.set([0.9, 0.9, 0.9, 1], 4 * i);
  assert.match(describePicture(R), /^A light picture/);
});
test('every room transformation runs and returns something to keep', async () => {
  const inputs = { story: 'I like the sea.', picture: 'Hello', sound: 'I want music', 'numbers-picture': '3 1 4 1 5', 'numbers-sound': '1 2 3 5', 'code-words': 'let x = 1' };
  for (const k of KINDS) { const r = await roomMake({ kind: k, input: inputs[k], intensity: 1 }); assert.ok(r.image || r.audio || r.text, k); }
  await assert.rejects(roomMake({ kind: 'story', input: '   ' }), /nothing to transform/);
});
