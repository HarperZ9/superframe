// ======================================================================= Patterns
// Turing: Gray-Scott reaction diffusion, grown here on a 256 grid and read as a texture (Pearson 1993 parameters for labyrinth spots).
let turingT = null;
function turing() {
  if (turingT) return turingT;
  const N = 256;
  let u = new Float32Array(N * N).fill(1),
    v = new Float32Array(N * N);
  let s = 12345;
  const rn = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 60; i++) {
    const cx = (rn() * N) | 0,
      cy = (rn() * N) | 0;
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++) {
        const o = ((cy + y + N) % N) * N + ((cx + x + N) % N);
        u[o] = 0.5;
        v[o] = 0.25;
      }
  }
  const F = 0.037,
    K = 0.06,
    Du = 0.16,
    Dv = 0.08;
  let a = new Float32Array(N * N),
    b = new Float32Array(N * N);
  for (let t = 0; t < 2600; t++) {
    for (let y = 0; y < N; y++) {
      const ym = ((y + N - 1) % N) * N,
        yp = ((y + 1) % N) * N,
        y0 = y * N;
      for (let x = 0; x < N; x++) {
        const xm = (x + N - 1) % N,
          xp = (x + 1) % N,
          o = y0 + x,
          U0 = u[o],
          V0 = v[o],
          lu = u[y0 + xm] + u[y0 + xp] + u[ym + x] + u[yp + x] - 4 * U0,
          lv = v[y0 + xm] + v[y0 + xp] + v[ym + x] + v[yp + x] - 4 * V0,
          r = U0 * V0 * V0;
        a[o] = U0 + Du * lu - r + F * (1 - U0);
        b[o] = V0 + Dv * lv + r - (F + K) * V0;
      }
    }
    [u, a] = [a, u];
    [v, b] = [b, v];
  }
  const d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const q = Math.min(255, v[i] * 700);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = q;
    d[i * 4 + 3] = 255;
  }
  gl.activeTexture(gl.TEXTURE3);
  turingT = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, turingT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.activeTexture(gl.TEXTURE0);
  return turingT;
}
