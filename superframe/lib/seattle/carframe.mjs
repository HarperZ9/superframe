// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// carframe.mjs: the rear side window's opening as seen from the back seat, lying down and looking up. The roof's
// headliner crosses the top of the frame, the C-pillar leans in from the left (the car moves to the right, so the
// back of the car is on the left), and the two meet in the window's rounded upper-rear corner. A black rubber seal
// runs along the glass edge.
// The shoulder belt hangs unbuckled down the pillar from its D-ring, its metal latch plate dangling near the bottom.
//   aperture(W, H) -> Uint8Array: 1 glass, 2 seal, 3 pillar vinyl, 0 headliner, 4 belt webbing, 5 latch plate
export function aperture(W, H) {
  const M = new Uint8Array(W * H), seal = Math.max(1, Math.round(W / 220));
  const roof = fx => 0.1 + 0.03 * fx, pillar = fy => 0.1 - 0.07 * fy, rc = 0.11;
  const inside = (x, y) => {
    const fx = x / W, fy = y / H, top = roof(fx) * H, left = pillar(fy) * W;
    if (y < top || x < left) return false;
    // rounded corner: a circle of radius rc*W tangent to both edges near their meeting point
    const cxp = pillar(roof(0.15)) * W + rc * W, cyp = roof(0.15) * H + rc * W;
    if (x < cxp && y < cyp) return Math.hypot(x - cxp, y - cyp) <= rc * W;
    return true;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (inside(x + 0.5, y + 0.5)) { M[i] = 1; continue; }
    let near = false;
    for (let k = 1; k <= seal && !near; k++) near = inside(x + 0.5 + k, y + 0.5) || inside(x + 0.5, y + 0.5 + k) || inside(x + 0.5 + k, y + 0.5 + k);
    M[i] = near ? 2 : (x / W < pillar(y / H) + 0.02 && y / H > roof(x / W) - 0.01 ? 3 : 0);
  }
  belt(M, W, H);
  return M;
}
function belt(M, W, H) {
  const ax = 0.055 * W, ay = 0.17 * H, bx = 0.02 * W, by = 1.02 * H, half = Math.max(1.5, W * 0.011);
  for (let y = Math.floor(ay); y < H; y++) {
    const t = (y - ay) / (by - ay), cx = ax + (bx - ax) * t + 0.012 * W * Math.sin(t * 3.1);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) if (x >= 0 && x < W && M[y * W + x] !== 1) M[y * W + x] = 4;
  }
  const lx = ax + (bx - ax) * 0.62 + 0.012 * W * Math.sin(0.62 * 3.1), ly = ay + (by - ay) * 0.62;
  for (let y = Math.floor(ly); y < ly + 0.07 * H; y++) for (let x = Math.floor(lx - half * 1.3); x <= lx + half * 1.3; x++) if (x >= 0 && x < W && y < H) M[y * W + x] = 5;
  for (let y = Math.floor(ay - 0.03 * H); y < ay + 0.02 * H; y++) for (let x = Math.floor(ax - half * 1.6); x <= ax + half * 1.6; x++) if (x >= 0 && y >= 0 && M[y * W + x] !== 1) M[y * W + x] = 3;
}
