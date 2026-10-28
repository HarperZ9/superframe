// index.mjs: the era quantizer's one entry. quantize(img, id) runs a preset; measure(src, out, ppd) reports how
// far the result sits from its source through the eye model; metamerDistance finds the nearest viewing distance
// (lowest ppd on a ladder) at which the mean CIEDE2000 falls under a threshold.
import { toLinear } from './ciede.mjs';
import { deStats } from './eye.mjs';
import { preset, PRESETS } from './presets.mjs';

export { PRESETS };
export * as codebook from './codebook.mjs';
export * as dither from './dither.mjs';
export * as print from './print.mjs';
export { twoInk, separation } from './twoink.mjs';
export { dE00, dE76, toLinear } from './ciede.mjs';
export { eyeLab, deStats, bandingRatio, ppdFrom } from './eye.mjs';

export const quantize = (img, id) => preset(id).run(img);

const linOf = img => img.lin ?? toLinear(img);
export const measure = (src, out, ppd) => deStats(toLinear(src), linOf(out), src.w, src.h, ppd);

export const PPD_LADDER = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360];
export function metamerDistance(src, out, { threshold = 3, ladder = PPD_LADDER } = {}) {
  const s = toLinear(src), o = linOf(out);
  for (const ppd of ladder) if (deStats(s, o, src.w, src.h, ppd).mean < threshold) return ppd;
  return null;
}
