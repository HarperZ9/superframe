// shutter.mjs: motion blur as the time axis read by stacking. Exposure is the integral of irradiance over the open
// shutter (physics), so a frame is the mean of time slices across [t0, t0 + T]. Slices are spaced so the fastest item
// moves at most `step` px between them; the midpoint rule on a box-filtered rectangle then errs far below 1%. A flash
// is integrated over its own window with its own slices, so a strobe of 0.1% of the shutter is never stepped over.
// The control, postBlur, is the shortcut this replaces: one sharp frame smeared along the motion afterwards.
import { frame, addInto, scaleInto } from './frame.mjs';
import { sharpAt, placeAt, paintRect, imageSpeed } from './scene.mjs';

const slicesFor = (speed, span, step) => Math.max(1, Math.ceil(speed * span / step));

// Mean of the steady scene over the shutter, plus every flash window that falls inside it.
export function expose(scene, t0, T, { step = 0.1 } = {}) {
  if (T <= 0) return sharpAt(scene, t0);
  const steady = scene.items.filter(it => !it.flash);
  const vmax = Math.max(0, ...steady.map(it => imageSpeed(it, scene.cam)));
  const n = slicesFor(vmax, T, step);
  let F;
  if (steady.every(it => it.emit)) {                     // light only adds, so each slice paints straight in at 1/n
    F = frame(scene.w, scene.h, scene.ground ?? [0, 0, 0]);
    for (let s = 0; s < n; s++) for (const it of steady) paintRect(F, placeAt(it, scene.cam, t0 + (s + 0.5) * T / n), it.rgb, { k: 1 / n, emit: true, alpha: it.alpha ?? 1 });
  } else {
    F = frame(scene.w, scene.h);
    for (let s = 0; s < n; s++) addInto(F, sharpAt(scene, t0 + (s + 0.5) * T / n));
    scaleInto(F, 1 / n);
  }
  for (const it of scene.items) if (it.flash) addFlash(F, scene, it, t0, T, step);
  return F;
}

// A flash of energy E over [t, t + dur] adds E / dur of light while lit; over the shutter that averages to
// E / T times the mean coverage inside the window.
function addFlash(F, scene, it, t0, T, step) {
  const a = Math.max(t0, it.flash.t), b = Math.min(t0 + T, it.flash.t + it.flash.dur);
  if (b <= a) return;
  const n = Math.max(4, slicesFor(imageSpeed(it, scene.cam), b - a, step)), k = (it.flash.energy / it.flash.dur) * (b - a) / T / n;
  for (let s = 0; s < n; s++) paintRect(F, placeAt(it, scene.cam, a + (s + 0.5) * (b - a) / n), it.rgb, { k, emit: true });
}

// Bilinear sample of a frame at a real position, edge-clamped.
function sample(F, x, y, c) {
  const xc = Math.min(F.w - 1, Math.max(0, x - 0.5)), yc = Math.min(F.h - 1, Math.max(0, y - 0.5));
  const i = Math.floor(xc), j = Math.floor(yc), fx = xc - i, fy = yc - j, i1 = Math.min(F.w - 1, i + 1), j1 = Math.min(F.h - 1, j + 1);
  const p = (ii, jj) => F.px[3 * (jj * F.w + ii) + c];
  return (p(i, j) * (1 - fx) + p(i1, j) * fx) * (1 - fy) + (p(i, j1) * (1 - fx) + p(i1, j1) * fx) * fy;
}

// The control: smear one finished frame along (ux, uy) over length L. It cannot know which light arrived when.
export function postBlur(F, L, ux = 1, uy = 0, { step = 0.25 } = {}) {
  const n = Math.max(1, Math.ceil(L / step)), out = frame(F.w, F.h), m = Math.hypot(ux, uy) || 1;
  for (let s = 0; s < n; s++) {
    const o = (s + 0.5) / n * L - L / 2, dx = o * ux / m, dy = o * uy / m;
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) for (let c = 0; c < 3; c++) out.px[3 * (y * F.w + x) + c] += sample(F, x + 0.5 - dx, y + 0.5 - dy, c) / n;
  }
  return out;
}

// The post-blur pipeline's input: the mid-shutter sharp frame with every flash drawn lit at its own instant, at the
// exposure it would have delivered over the shutter.
export const midFrame = (scene, t0, T) => sharpAt(scene, t0 + T / 2, { flashes: true, flashScale: 1 / T });

// A horizontal intensity profile: the mean of one channel (or of all three) over rows [y0, y1).
export function rowProfile(F, y0, y1, c = null) {
  const out = new Float64Array(F.w);
  for (let y = y0; y < y1; y++) for (let x = 0; x < F.w; x++) {
    const p = 3 * (y * F.w + x); out[x] += (c === null ? (F.px[p] + F.px[p + 1] + F.px[p + 2]) / 3 : F.px[p + c]) / (y1 - y0);
  }
  return out;
}

// Second moment of a profile treated as a distribution over pixel centres.
export function moments(prof) {
  let s = 0, m = 0, v = 0;
  for (let i = 0; i < prof.length; i++) { s += prof[i]; m += prof[i] * (i + 0.5); }
  m /= s || 1;
  for (let i = 0; i < prof.length; i++) v += prof[i] * (i + 0.5 - m) ** 2;
  return { mass: s, mean: m, var: v / (s || 1) };
}

// Full width at half maximum, with linear interpolation at both crossings.
export function fwhm(prof) {
  let mx = 0, im = 0; for (let i = 0; i < prof.length; i++) if (prof[i] > mx) { mx = prof[i]; im = i; }
  const h = mx / 2; let l = im, r = im;
  while (l > 0 && prof[l - 1] >= h) l--;
  while (r < prof.length - 1 && prof[r + 1] >= h) r++;
  const xl = l > 0 ? l - 1 + (h - prof[l - 1]) / (prof[l] - prof[l - 1]) : 0;
  const xr = r < prof.length - 1 ? r + (prof[r] - h) / (prof[r] - prof[r + 1]) : prof.length - 1;
  return xr - xl;
}

// Streak length from the second moment: a box of length L convolved with the object adds L^2 / 12 to its variance.
export const streakFromMoments = (blurred, sharp) => Math.sqrt(Math.max(0, 12 * (moments(blurred).var - moments(sharp).var)));
