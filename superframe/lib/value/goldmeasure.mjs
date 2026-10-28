// goldmeasure.mjs: the gold measures. The palette is lib/study/palette.mjs, unedited, run on the sphere's pixels only
// (alpha 255 on the sphere, 0 elsewhere, so the histogram skips the background).
//   yellowShare: area share of swatches whose HSV hue is 35 to 70 degrees with CIE C*ab at least 20.
//   meanHue: the hue angle of the mean CIELAB (a, b) over the sphere, in degrees.
//   hueFollow: abs(object hue change) / abs(environment hue change) between two environments, where the
//              environment's hue is that of the mean (a, b) of the colours its mirror rays see.
import { palette } from '../study/palette.mjs';
import { rgb8ToLab } from '../study/cmath.mjs';

export const YELLOW_BAND = { hsvMin: 35, hsvMax: 70, minChroma: 20 };

export function sphereSubject(disp, mask) {
  const rgba = Uint8ClampedArray.from(disp.rgba);
  for (let i = 0; i < mask.length; i++) rgba[4 * i + 3] = mask[i] ? 255 : 0;
  return { w: disp.w, h: disp.h, rgba };
}
export const isYellow = s => s.hsv_hue !== null && s.hsv_hue >= YELLOW_BAND.hsvMin && s.hsv_hue <= YELLOW_BAND.hsvMax && s.C >= YELLOW_BAND.minChroma;

export function yellowShare(disp, mask, { k = 10, seed = 'value/gold' } = {}) {
  const P = palette(sphereSubject(disp, mask), { k, seed });
  const share = P.swatches.filter(isYellow).reduce((a, s) => a + s.share, 0);
  return { share, count: P.swatches.filter(isYellow).length, swatches: P.swatches };
}

export function meanAB(disp, mask) {
  let a = 0, b = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { const p = 4 * i, L = rgb8ToLab(disp.rgba[p], disp.rgba[p + 1], disp.rgba[p + 2]); a += L[1]; b += L[2]; n++; }
  return [a / n, b / n];
}
export const hueOf = ([a, b]) => { const h = Math.atan2(b, a) * 180 / Math.PI; return h < 0 ? h + 360 : h; };
export const hueDiff = (h1, h2) => { const d = Math.abs(h1 - h2) % 360; return d > 180 ? 360 - d : d; };

export function hueFollow(objA, objB, envA, envB) {
  const dObj = hueDiff(hueOf(objA), hueOf(objB)), dEnv = hueDiff(hueOf(envA), hueOf(envB));
  return { coefficient: dEnv > 0 ? dObj / dEnv : null, dObj, dEnv };
}
