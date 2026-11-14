// A scripted form override, part one: the face's planes painted onto a form layer the way a portrait
// painter blocks a head (forehead, brow shelf, eye sockets, the front of the cheek and its side plane past
// the cheekbone, the muzzle, the jaw's side and underside, the nose's bridge, side and base). Each plane
// knows whether it is broad (painted with big strokes) or a small turn (nose, sockets), the way its strokes
// run, and whether its edge is a true break (the brow shelf, the side of the nose). planelight.mjs paints
// the light from them. Records only: the Studio's own brushes lay them.
//   planeGeometry(ref, lm, doc) -> g    planeAt(x, y, g) -> plane    formStrokes(ref, lm, g) -> [record]
import { IDS } from "./landmarks.mjs";
import { rec } from "./face.mjs";
import { planeNormal, sitterFacing } from "../core/form.mjs";

// which way "toward the near side" is in yaw: the sign whose plane best matches the sculpt's own normals
// on the broad, near cheek (the side of the face away from where the nose points on screen)
function nearSign(ref, lm, facing) {
  const { G } = ref, f = lm.face, nearLeft = lm.nose.x > (f.x0 + f.x1) / 2, skin = new Set(IDS.skin), m = [0, 0, 0];
  for (let y = lm.nose.y - 10; y < lm.nose.y + 10; y++) for (let x = nearLeft ? f.x0 : (f.x0 + f.x1) / 2 | 0; x < (nearLeft ? (f.x0 + f.x1) / 2 : f.x1); x++) { const i = y * G.w + x; if (skin.has(G.id[i])) for (let k = 0; k < 3; k++) m[k] += G.N[i * 3 + k]; }
  const dot = (s) => { const n = planeNormal({ yaw: 60 * s }, facing); return n[0] * m[0] + n[1] * m[1] + n[2] * m[2]; };
  return { s: dot(1) >= dot(-1) ? 1 : -1, nearLeft };
}
export function planeGeometry(ref, lm, doc) {
  const f = lm.face; if (!f || !lm.nose || !lm.eyes.length) return null;
  const facing = sitterFacing(doc.meta), { s, nearLeft } = nearSign(ref, lm, facing), ey = lm.eyes.reduce((a, e) => a + e.cy, 0) / lm.eyes.length, my = lm.mouthLine?.y ?? lm.mouth?.cy ?? ey + 60;
  return { ey, my, U: my - ey, fy1: f.y1, nx: lm.nose.x, edge: nearLeft ? f.x0 : f.x1, nose: lm.nose, s, facing, face: f, w: lm.w };
}
// a plane: its name, its direction (yaw toward the near side, pitch up), broad or small, how its strokes run
const PL = (name, yaw, pitch, big, dir, hard = false) => ({ name, yaw, pitch, big, dir, hard });
export function planeAt(x, y, g) {
  const { ey, U, my, fy1, nx, edge, nose, s } = g, t = (x - nx) / (edge - nx), dn = Math.hypot(x - nose.x, y - nose.y) / nose.r;
  const P = (p) => ({ ...p, yaw: p.yaw * s });
  // the nose, measured in its own size: toward the near side past a quarter of its radius is its side plane
  const tn = ((x - nx) * Math.sign(edge - nx)) / nose.r;
  if (dn < 1) return P(y > nose.y + nose.r * 0.5 && dn < 0.8 ? PL("nose base", 0, -55, false, [1, 0]) : tn > 0.2 ? PL("nose side", 55, 0, false, [0.2, 1], true) : PL("nose bridge", 0, 15, false, [0.15, 1]));
  if (y > fy1 - U * 0.22) return P(PL("under the jaw", 10, -70, true, [1, -0.2]));
  const side = t > 0.62, corner = t > 0.42;
  if (y < ey - U * 0.55) return P(side ? PL("temple", 70, 10, true, [0.3, 1]) : PL("forehead", 0, 12, true, [1, 0.05]));
  if (y < ey - U * 0.18) return P(side ? PL("brow, side", 60, 28, false, [1, 0.3], true) : PL("brow shelf", 0, 38, false, [1, 0], true));
  if (y < ey + U * 0.28) return P(side ? PL("socket, side", 65, -8, false, [0.4, 1]) : PL("socket", 0, -22, false, [1, 0.1]));
  if (y < my + U * 0.2) return P(side ? PL("cheek, side", 78, -5, true, [0.2, 1]) : corner ? PL("cheekbone's turn", 40, 0, true, [0.5, 1]) : PL("cheek front", 8, 0, true, [0.6, 1]));
  return P(side ? PL("jaw, side", 72, -30, true, [0.7, 1]) : PL("chin", 0, -25, true, [1, 0.2]));
}
// the planes onto the form layer, cell by cell (every face pixel gets one)
export function formStrokes(ref, lm, g) {
  const f = g.face, skin = lm.mask([...IDS.skin, ...IDS.lip]), step = Math.max(5, Math.round(lm.w / 110)), out = [];
  for (let y = f.y0; y <= f.y1; y += step) for (let x = f.x0; x <= f.x1; x += step) {
    if (!skin[y * lm.w + x]) continue; const p = planeAt(x, y, g);
    out.push(rec(ref, "form", { tool: "brush", colour: [0.5, 0.5, 1], plane: { yaw: p.yaw, pitch: p.pitch }, size: step * 0.9, flow: 1, bristles: 12, spread: 2.5, depletion: 0, pickup: 0, impasto: 0 }, [[x - step * 0.6, y, 1], [x + step * 0.6, y, 1]], 12000 + out.length));
  }
  return out;
}
