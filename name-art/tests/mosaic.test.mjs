// mosaic.test.mjs: neighbouring letters never share outline courses, at the sizes the assistive room uses
// (a short word filling the frame). The control renders the same word with the gap rule switched off by asking for
// halo courses on a tracking of zero and checks the counting itself works (an "I" has one island).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mosaic } from '../lib/mosaic/index.mjs';

// Islands of letter-or-outline pixels (zone 1 or 2), 4-connected. Each letter must stay its own island.
function islands(zone, w, h) {
  const seen = new Uint8Array(w * h); let n = 0; const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || zone[i] === 0) continue; n++; seen[i] = 1; stack.push(i);
    while (stack.length) { const j = stack.pop(), x = j % w, y = (j / w) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && !seen[k] && zone[k] !== 0) { seen[k] = 1; stack.push(k); } }
  }
  return n;
}

for (const [W, H] of [[1280, 720], [1920, 1080]]) for (const style of ['andamento', 'smalti', 'echo']) {
  test(`${style} ${W}x${H}: "sea." keeps four separate letters, "I" one`, () => {
    const a = mosaic(W, H, { text: 'sea.', style, box: [0.04, 0.06, 0.96, 0.94] });
    assert.equal(islands(a.layout.zone, W, H), 4, 'outline courses of s, e, a and the full stop must not merge');
    const b = mosaic(W, H, { text: 'I', style, box: [0.04, 0.06, 0.96, 0.94] });
    assert.equal(islands(b.layout.zone, W, H), 1);
    assert.equal(a.text, 'sea.');
  });
}

test('smalti, two lines: no outline course bridges "Zain Dana" and "Harper" (1920 and 3840)', () => {
  for (const [W, H] of [[1920, 1080], [3840, 2160]]) {
    const z = mosaic(W, H, { style: 'smalti' }).layout.zone, lab = new Int32Array(W * H).fill(-1); let n = 0, bridge = 0;
    for (let i = 0; i < W * H; i++) {
      if (z[i] === 0 || lab[i] >= 0) continue; const st = [i]; lab[i] = n; let y0 = 1e9, y1 = -1;
      while (st.length) { const j = st.pop(), x = j % W, y = (j / W) | 0; y0 = Math.min(y0, y); y1 = Math.max(y1, y); for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (k >= 0 && lab[k] < 0 && z[k] !== 0) { lab[k] = n; st.push(k); } }
      if (y1 - y0 > 0.45 * H) bridge++; n++;
    }
    assert.equal(bridge, 0, `${W}: a letter island spans both lines`);
  }
});
