// The code-generated head against the authored head, same figure pipeline, same light, same cameras.
//   node proto/head_compare.mjs <out.png> <who> <path/to/who.rna>
// Row 1: generated. Row 2: authored. Columns: front, three-quarter, profile (850 px a metre, the portrait),
// then the play-size crop (283 px a metre) enlarged 3 times with no smoothing.
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";
import { SCULPT } from "../cast/sculpt.mjs";
import { loadAuthored } from "../forge/authored_node.mjs";

const [out, who, rna] = process.argv.slice(2), asset = loadAuthored(rna);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8")), members = await roster("quota");
const facings = [0, -40, -90], cw = 300, ch = 340, pw = 100, ph = 113, up = 3, W = cw * facings.length + pw * up, H = ch * 2, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.47, 0.44, 0.41, 1], i * 4);
const rig = { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } };
const enlarge = (im, f) => { const w = im.w * f, h = im.h * f, o = new Float32Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (Math.floor(y / f) * im.w + Math.floor(x / f)) * 4; o.set(im.rgba.subarray(s, s + 4), (y * w + x) * 4); } return { rgba: o, w, h }; };
[false, true].forEach((authored, r) => {
  SCULPT.authored = authored ? { [members[who].id || who]: asset, [who]: asset } : null;
  const shot = (facing, cwid, chei, height) => {
    const a = createCast({ timing, members: { [who]: { ...members[who] } } }).actor(who, { facing }); a.play("idle", { force: true, fade: 1 }); for (let i = 0; i < 14; i++) a.update(1 / 60);
    const hw0 = a.toWorld(a.skeleton()[INDEX.head].p), hw = [hw0[0] + Math.sin(facing * Math.PI / 180) * 0.05, hw0[1], hw0[2] + Math.cos(facing * Math.PI / 180) * 0.05];
    return a.render({ yawDeg: 0, elevDeg: 4, height, centre: [hw[0], hw[1] + 0.13, hw[2]] }, cwid, chei, rig, { ss: 2, bands: 4, shadows: false });
  };
  facings.forEach((f, k) => { const im = shot(f, cw, ch, 0.4); paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch); });
  const big = enlarge(shot(-25, pw, ph, 0.4), up); paste(img, W, H, big.rgba, big.w, big.h, cw * facings.length, r * ch);
});
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) }); console.log("wrote", out);
