// SPDX-License-Identifier: FSL-1.1-MIT
// Modal bank cost in V8, the engine an AudioWorklet runs on, processed in 128-sample render quanta.
const N = Number(process.argv[2] ?? 1024), FS = 48000, S = FS * 2, Q = 128;
const a1 = new Float32Array(N), a2 = new Float32Array(N), b = new Float32Array(N).fill(1 / N);
const y1 = new Float32Array(N), y2 = new Float32Array(N), out = new Float32Array(S);
for (let k = 0; k < N; k++) {
  const f = 50 + 15 * k, r = Math.exp(-3 / FS);
  a1[k] = 2 * r * Math.cos((2 * Math.PI * f) / FS); a2[k] = r * r;
}
function quantum(start) {
  for (let n = start; n < start + Q; n++) {
    const x = n === 0 ? 1 : 0; let acc = 0;
    for (let k = 0; k < N; k++) { const y = a1[k] * y1[k] - a2[k] * y2[k] + b[k] * x; y2[k] = y1[k]; y1[k] = y; acc += y; }
    out[n] = acc;
  }
}
const t0 = performance.now();
for (let s = 0; s < S; s += Q) quantum(s);
const wall = (performance.now() - t0) / 1000;
console.log(JSON.stringify({ lang: "js-v8", modes: N, seconds_audio: 2, wall: +wall.toFixed(4), check: out[S - 1] }));
