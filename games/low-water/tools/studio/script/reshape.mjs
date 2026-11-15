// A scripted liquify pass that fixes what makes the old heads read as carved: the dome of the skull (or the
// cap on it) brought down and in, the jaw given a corner and weight on each side and the chin set lower (a
// person's jaw, not a ball's underside), the nose brought to a believable size, and the mouth given some body. Large brushes with reach, so each
// move shifts a mass, not a dent. Records only (the Studio's liquify replays them), sized from the
// reference's own landmarks; `amount` scales every move, `nose` how far the nose is brought in (0: left).
//   reshapeRecords(ref, lm, doc, { amount, nose }) -> [record]
import { IDS } from "./landmarks.mjs";

const rec = (doc, mode, radius, strength, pts) => ({ op: "liquify", mode, radius: +radius.toFixed(1), strength, reach: true, pts: pts.map(([x, y, p = 1]) => [+x.toFixed(1), +y.toFixed(1), p]), layers: doc.layers.map((l) => l.name), size: [doc.w, doc.h], author: "script" });

export function reshapeRecords(ref, lm, doc, { amount = 1, nose = 1 } = {}) {
  const head = lm.box([...IDS.skin, ...IDS.hair, ...IDS.hat, ...IDS.brow]), f = lm.face, m = lm.mouth, out = []; if (!head || !f) return out;
  const hw = head.x1 - head.x0, hh = head.y1 - head.y0, fw = f.x1 - f.x0, cx = (head.x0 + head.x1) / 2, a = amount;
  // the dome: one broad push down from above the crown, and the two upper sides in a little
  out.push(rec(doc, "push", hw * 0.55, 1, [[cx, head.y0 + hh * 0.08], [cx, head.y0 + hh * (0.08 + 0.09 * a)]]));
  for (const side of [-1, 1]) out.push(rec(doc, "push", hw * 0.3, 1, [[cx + side * hw * 0.42, head.y0 + hh * 0.3], [cx + side * hw * (0.42 - 0.05 * a), head.y0 + hh * 0.32]]));
  if (!m) return out;
  // the jaw: each corner out and down, then the chin down, so the face ends in a step and not a curve
  const jy = m.y1 + (f.y1 - m.y1) * 0.55;
  for (const side of [-1, 1]) out.push(rec(doc, "push", fw * 0.28, 1, [[m.cx + side * fw * 0.3, jy], [m.cx + side * fw * (0.3 + 0.06 * a), jy + hh * 0.03 * a]]));
  out.push(rec(doc, "push", fw * 0.3, 1, [[m.cx, f.y1 - hh * 0.04], [m.cx, f.y1 - hh * 0.04 + hh * 0.04 * a]]));
  // the nose: kept as it is shaped (Will's is broken: bent, its bridge flat) but brought down in size, pinched
  // toward its own tip twice, so it stops ruling the face
  if (lm.nose && nose) for (let k = 0; k < 2; k++) out.push(rec(doc, "pinch", lm.nose.r * 1.7, 0.7 * nose, [[lm.nose.x, lm.nose.y]]));
  // the mouth: a little fuller
  out.push(rec(doc, "bloat", (m.x1 - m.x0) * 0.5, 0.25 * a, [[m.cx, m.cy]]));
  return out;
}
