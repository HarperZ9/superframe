// Section timers for the frame profile (tools/bench.mjs). Off unless globalThis.__lwPerf is set
// (the bench sets it to {}); then every section adds its milliseconds and a count, read and reset by
// the bench once a second. The cost when off is one property read per section.
//   const t = tick(); ...work...; tock("raster", t)
export const tick = () => (globalThis.__lwPerf ? performance.now() : 0);
export function tock(k, t0) {
  const S = globalThis.__lwPerf; if (!S) return;
  const e = S[k] || (S[k] = { ms: 0, n: 0 }); e.ms += performance.now() - t0; e.n++;
}
