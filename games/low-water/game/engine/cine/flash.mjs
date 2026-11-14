// The flash rule (design/sensory/05-CARE.md section 2, F5) over a film's frames, with the inner arena's own
// transition counter (combat/tools/inner-capture.mjs transitions: WCAG 2.x wording, a change of 0.1 relative
// luminance with the darker under 0.80). Windows are 1/16 of the frame, sliding by half (7 x 7).
// A red transition is WCAG 2.2's (cine/redflash.mjs: one state saturated red by R / (R + G + B) >= 0.8, and the
// states more than 0.2 apart in CIE 1976 u'v'), read on each window's mean colour (M). The house rule (05-CARE) is
// stricter than WCAG's three a second: any red transition fails. Two earlier counts stay in the result for the
// record: redShareTransitions (any 0.05 change in the share of saturated-red pixels, to 2026-10-23, which read a
// camera pan across an amber wall as 34 to 37) and redE20Transitions (WCAG 2.0's (R - G - B) x 320 change over 20).
//   windowsOf(rgba, w, h)  -> { L: [49 mean luminances], R: [49 saturated-red shares], E: [49], M: [49 mean colours] }
//   judgeFlash(frames, fps) -> { errs, flashesPerSecond, redTransitions, redShareTransitions, redE20Transitions }
import { transitions } from "../combat/tools/inner-capture.mjs";
import { redTransitions } from "./redflash.mjs";
export { windowsOf } from "./windows.mjs";

const mostIn = (ts, span) => { let best = 0; for (let i = 0, j = 0; i < ts.length; i++) { while (ts[i] - ts[j] >= span) j++; best = Math.max(best, i - j + 1); } return best; };
// frames: [{ L, R }] at fps; at most 3 flashes (6 transitions) in any second in any window, no saturated-red transition
export function judgeFlash(frames, fps = 30) {
  const errs = [], n = frames[0] ? frames[0].L.length : 0; let worst = 0, red = 0, share = 0, e20 = 0;
  for (let k = 0; k < n; k++) {
    worst = Math.max(worst, mostIn(transitions(frames.map((f) => f.L[k])), fps));
    red += frames[0].M ? redTransitions(frames.map((f) => f.M[k])).length : transitions(frames.map((f) => (f.E ? f.E[k] : f.R[k] * 320)), { abs: 20 }).length; // frames from before M: WCAG 2.0's measure
    share += transitions(frames.map((f) => f.R[k]), { abs: 0.05 }).length;
    if (frames[0].E) e20 += transitions(frames.map((f) => f.E[k]), { abs: 20 }).length;
  }
  if (Math.floor(worst / 2) > 3) errs.push(`F5: ${Math.floor(worst / 2)} flashes in one second in one window (at most 3)`);
  if (red > 0) errs.push(`F5: ${red} saturated-red transitions`);
  return { errs, flashesPerSecond: Math.floor(worst / 2), redTransitions: red, redShareTransitions: share, redE20Transitions: e20 };
}
