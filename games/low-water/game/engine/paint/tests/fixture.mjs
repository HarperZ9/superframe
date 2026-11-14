// A synthetic figure for the painter's tests and bench: a capsule body (coat), a sphere head (skin)
// rendered orthographically into a G-buffer and a shaded RGBA image, at any pose angle (yaw).
//   figure({ w, h, ppm, yaw, dx }) -> { rgba, G, w, h }
export const IDS = { coat: 1, skin: 4, hat: 6 };
export function figure({ w = 120, h = 260, ppm = 87, yaw = 0, dx = 0 } = {}) {
  const n = w * h, G = { w, h, id: new Uint8Array(n), loc: new Float32Array(n * 3), N: new Float32Array(n * 3), wp: new Float32Array(n * 3) }, rgba = new Uint8ClampedArray(n * 4);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = (x + 0.5 - w / 2) / ppm - dx, Y = (h - y - 0.5) / ppm, i = y * w + x;
    let id = 0, nx = 0, ny = 0, nz = 0, px = 0, pz = 0;
    const head = Math.hypot(X, Y - 1.62);
    if (head < 0.13) { id = IDS.skin; pz = Math.sqrt(0.13 * 0.13 - head * head); px = X; nx = X / 0.13; ny = (Y - 1.62) / 0.13; nz = pz / 0.13; }
    else if (Y > 0.05 && Y < 1.45 && Math.abs(X) < 0.26) { id = Y > 1.3 ? IDS.hat : IDS.coat; pz = Math.sqrt(0.26 * 0.26 - X * X); px = X; nx = X / 0.26; nz = pz / 0.26; }
    if (!id) continue;
    G.id[i] = id;
    // the view point (px, Y, pz) in world; bind = rotate back by yaw
    const bx = c * px + s * pz, bz = -s * px + c * pz;
    G.loc[i * 3] = bx; G.loc[i * 3 + 1] = Y; G.loc[i * 3 + 2] = bz;
    G.N[i * 3] = nx; G.N[i * 3 + 1] = ny; G.N[i * 3 + 2] = nz;
    const l = Math.max(0.05, 0.5 + 0.5 * (nx * -0.5 + ny * 0.5 + nz * 0.7)), base = id === IDS.skin ? [200, 150, 120] : [70, 60, 66];
    for (let k = 0; k < 3; k++) rgba[i * 4 + k] = base[k] * l; rgba[i * 4 + 3] = 255;
  }
  return { rgba, G, w, h };
}
