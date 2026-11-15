// The eight portrait moods for chosen sitters, through the same mapping the portrait painter uses for
// the old head (game/engine/paint/portrait/moods.mjs on feat/paint: MOODS and exprFor's old-head branch,
// copied here until it lands on dev), the portrait camera and the paraffin light.
//   node proto/mood_sheet.mjs <out.png> who,who   (PORTRAIT_CAST=quota for The Quota's cast)
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { down, paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { setExpression, EXPRESSIONS } from "../cast/parts.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";
import { PORTRAIT_RIG } from "./portrait_light.mjs";
import { portraitCue } from "../../game/engine/dialogue/direction.mjs";

const MOODS = { neutral: {}, warm: { emo: "warm", int: 3 }, anxious: { emo: "anxious", int: 3 }, angry: { emo: "angry", int: 3 }, grieving: { emo: "grieving", int: 3 }, afraid: { emo: "afraid", int: 3 }, contempt: { emo: "contempt", int: 3 }, lying: { emo: "warm", int: 1, lie: true } };
const OPEN = -0.2;
const exprOld = (dir) => { const q = portraitCue(dir, {}), base = { ...(EXPRESSIONS[q.preset] || {}) };
  return { ...base, browY: (base.browY || 0) + q.brow * 0.09, browIn: (base.browIn || 0) + q.browInner * 0.07, lidsAdd: (base.lidsAdd || 0) + q.lids * 0.6 + OPEN, mouthW: (base.mouthW || 1) * (1 + 0.12 * q.corners), corners: q.corners, ...lie(dir) }; };
// a lie: the smile is held at the warm cue's corners and the eyes don't join in (the head's X.held)
const lie = (dir) => dir.lie ? { corners: portraitCue({ ...dir, int: 3, lie: false }, {}).corners * 0.8, held: true } : {};

const [out, list] = process.argv.slice(2), members = await roster(), who = list.split(","), names = Object.keys(MOODS);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const w = 256, h = 320, W = w * names.length, H = h * who.length, img = new Float32Array(W * H * 4).fill(1), rig = PORTRAIT_RIG.paraffin.rig;
who.forEach((id, r) => names.forEach((mood, c) => {
  setExpression(exprOld(MOODS[mood]));
  const C = { ...members[id] }, a = createCast({ timing, members: { [id]: C } }).actor(id, { facing: 2 });
  a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1];
  const { G } = gbuffer([{ C, pose, facing: 2 }], { yawDeg: 34, elevDeg: 6, height: 0.55, centre: [0, hy + 0.06, 0] }, w * 2, h * 2, 2, rig);
  const F = paintFigure(G, C.palette || {}, { rig, seed: 5 }), im = down(down(relight(G, F, rig, C.palette || {}, null), G.w, G.h, 2).rgba, w * 2, h * 2, 2);
  for (let i = 0; i < w * h; i++) { const al = im.rgba[i * 4 + 3]; for (let k = 0; k < 3; k++) im.rgba[i * 4 + k] = im.rgba[i * 4 + k] * al + [0.23, 0.15, 0.1][k] * (1 - al); im.rgba[i * 4 + 3] = 1; }
  paste(img, W, H, im.rgba, w, h, c * w, r * h); setExpression(null);
  console.log("mood", id, mood);
}));
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) });
