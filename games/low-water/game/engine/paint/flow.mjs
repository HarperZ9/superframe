// A stroke's direction at birth: the form's direction blended with the image's flow where the stroke
// is first seen. The image flow is the edge tangent of the shaded figure's luminance (a structure
// tensor over a 5 x 5 window), carried into bind space through the local screen-to-bind Jacobian
// (finite differences of the G-buffer's bind positions). The result is fixed for the stroke's life,
// so the image steers how a stroke is laid without ever making it swim. Original code.
//   birthDir(rgba, w, h, G, ss, x, y, form, weight) -> [x, y, z] unit, in bind space
const L = (rgba, i) => 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];

export function birthDir(rgba, w, h, G, ss, x, y, form, weight = 0.4) {
  if (weight <= 0 || x < 3 || y < 3 || x >= w - 3 || y >= h - 3) return form;
  let jxx = 0, jxy = 0, jyy = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = (y + dy) * w + x + dx; if (!rgba[i * 4 + 3]) continue;
    const gx = L(rgba, i + 1) - L(rgba, i - 1), gy = L(rgba, i + w) - L(rgba, i - w);
    jxx += gx * gx; jxy += gx * gy; jyy += gy * gy;
  }
  const tr = jxx + jyy; if (tr < 4) return form;   // flat: the form alone
  const disc = Math.sqrt((jxx - jyy) * (jxx - jyy) + 4 * jxy * jxy), l1 = (tr + disc) / 2, l2 = (tr - disc) / 2, coh = (l1 - l2) / (l1 + l2 + 1e-6);
  // the gradient's direction is the eigenvector of l1; the edge runs across it
  let gx = jxy, gy = l1 - jxx; if (Math.abs(gx) + Math.abs(gy) < 1e-6) { gx = 1; gy = 0; }
  const gl = Math.hypot(gx, gy), tx = -gy / gl, ty = gx / gl;
  // screen to bind: d(loc)/dx and d(loc)/dy from neighbours on the same surface
  const gi = (X, Y) => (Y * ss) * G.w + X * ss, c = gi(x, y), id = G.id[c];
  const nb = (X, Y) => { const k = gi(X, Y); return G.id[k] === id ? k : -1; };
  const xa = nb(x + 1, y), xb = nb(x - 1, y), ya = nb(x, y + 1), yb = nb(x, y - 1);
  if ((xa < 0 && xb < 0) || (ya < 0 && yb < 0)) return form;
  const dl = (a, b, sp) => [0, 1, 2].map((k) => ((a >= 0 ? G.loc[a * 3 + k] : G.loc[c * 3 + k]) - (b >= 0 ? G.loc[b * 3 + k] : G.loc[c * 3 + k])) / sp);
  const Jx = dl(xa, xb, xa >= 0 && xb >= 0 ? 2 : 1), Jy = dl(ya, yb, ya >= 0 && yb >= 0 ? 2 : 1);
  let ix = Jx[0] * tx + Jy[0] * ty, iy = Jx[1] * tx + Jy[1] * ty, iz = Jx[2] * tx + Jy[2] * ty;
  const il = Math.hypot(ix, iy, iz); if (il < 1e-9) return form;
  ix /= il; iy /= il; iz /= il;
  const sgn = ix * form[0] + iy * form[1] + iz * form[2] < 0 ? -1 : 1, k = weight * coh;
  const ox = form[0] * (1 - k) + sgn * ix * k, oy = form[1] * (1 - k) + sgn * iy * k, oz = form[2] * (1 - k) + sgn * iz * k, ol = Math.hypot(ox, oy, oz) || 1;
  return [ox / ol, oy / ol, oz / ol];
}
