// The render worker: the same score renderer the offline tools use, off the main thread. A message
// { id, opts, seed } comes back as { id, n, barSec, sr, stems: { stemId: [L, R] } } with the buffers transferred.
import { render } from "../score.mjs";
import { ALL } from "../pieces/index.mjs";
import { SR } from "../lib/dsp.mjs";

self.onmessage = (msg) => {
  const { id, opts = {}, seed = 1, only = null } = msg.data;
  try {
    const t0 = performance.now(), R = render(ALL[id], { seed, ...opts, ...(only ? { only } : {}) });
    const transfer = Object.values(R.stems).flatMap(([L, Rr]) => [L.buffer, Rr.buffer]);
    self.postMessage({ id, n: R.n, barSec: R.barSec, sr: SR, stems: R.stems, ms: performance.now() - t0 }, transfer);
  } catch (e) {
    self.postMessage({ id, error: String(e && e.stack || e) });
  }
};
