// Puts the brush painter behind the one figure drawer (characters/runtime/fightdrawer.mjs calls
// globalThis.__lwPainter.paint after shading a figure), for walking, talking and fighting alike.
// The painter takes over the Oil and Ink shadow planes (it glazes them in pigment space), so the
// drawer's own RGB tint ("oil" in its look list) is turned off while it runs.
//   await installPainter({ hourOf: () => hour, base: "/characters/", anchor: "bind" })
//   ?paint=0 leaves the drawer as it was; ?paint=screen paints with screen-anchored strokes (the control);
//   ?paint=trace leaves figures unpainted but records them for the stability measure
import { makePainter, CLASS } from "./painter.mjs";
import { paletteAt } from "./palette.mjs";
import { makePaintGpu } from "./gpu.mjs";

// Region of every material (characters/rig/materials.mjs names)
const REGION = {
  face: ["skin", "cheek", "jawcool", "lip", "eye", "brow", "white", "nail", "scales"],
  detail: ["collar", "shirt", "knit", "gansey", "shawl", "strap", "case", "brass", "band", "stripe", "tin", "rope", "wood", "steel", "iron", "lens", "glass", "amber", "paper", "braid", "hair"],
  cloth: ["coat", "coatIn", "oilskin", "skirtd", "smock", "navy", "oxblood", "muni", "pea", "grey", "black", "wader", "tweed", "canvas", "apron", "surplice", "yellow", "mud"],
  broad: ["trouser", "boot", "hat"],
};
// strokes hang down drapes, go round forms (0 round, 1 down)
const FLOW = { coat: 0.75, coatIn: 0.75, oilskin: 0.75, skirtd: 0.85, smock: 0.7, apron: 0.8, surplice: 0.85, trouser: 0.8, wader: 0.7, navy: 0.7, oxblood: 0.7, muni: 0.7, pea: 0.7, hair: 0.9, rope: 0.6, wood: 0.9, steel: 0.9 };
// accents a painter puts down darker than the shading gives them at play size
const TONE = { eye: 0.55, brow: 0.65, lip: 0.85 };
const SKIN = ["skin", "cheek", "jawcool"];   // one stroke family over the face's colour zones

export function tables(MATS) {
  const classOf = new Uint8Array(256), flowOf = new Float32Array(256), groupOf = new Uint16Array(256), toneOf = new Float32Array(256).fill(1);
  for (const [name, m] of Object.entries(MATS)) {
    const id = m.id; if (id == null) continue;
    const region = Object.keys(REGION).find((r) => REGION[r].includes(name));
    classOf[id] = region ? CLASS[region] : m.emit || name === "smear" ? CLASS.none : CLASS.detail;
    flowOf[id] = FLOW[name] ?? (region === "face" ? 0.15 : 0.3);
    groupOf[id] = SKIN.includes(name) ? MATS.skin.id : id;
    if (TONE[name]) toneOf[id] = TONE[name];
  }
  return { classOf, flowOf, groupOf, toneOf };
}

export async function installPainter({ hourOf = () => 23, base = "/characters/", anchor = "bind", imageFlow = 0.4, gpu = false } = {}) {
  let MATS;
  try { ({ MATS } = await import(`${base}rig/materials.mjs`)); }
  catch (e) { console.warn(`paint: materials not loaded (${e.message}); figures stay unpainted`); return false; }
  // gpu: the membership pass on the GPU (paint/gpu.mjs); off by default: measured slower than the CPU (render/PROGRESS.md 66)
  const P = makePainter({ ...tables(MATS), imageFlow, gpu: gpu ? makePaintGpu() : null });
  globalThis.__lwFigureLook = "lift,outline";
  globalThis.__lwPainter = {
    anchor,
    painter: P,
    // info: { key, ppm, cam, plate, depth, ox, oy }
    paint(rgba, w, h, G, ss, info) {
      const palette = paletteAt(info.plate || "quay", hourOf());
      const camDist = (info.cam && info.cam.dist) || 0, haze = info.depth != null && camDist ? Math.max(0, (info.depth - camDist) * palette.hazeK) : 0;
      // the ruling lamp's direction from the figure's chest (the drawer's lamps: pos, power; its own
      // carried figure light is not a lamp in the scene)
      let light = null, bw = 0;
      if (info.lamps && info.at) for (const q of info.lamps) { if (q.kind === "carried") continue; const dx = q.pos[0] - info.at[0], dy = q.pos[1] - info.at[1] - 1, dz = q.pos[2] - info.at[2], dd = dx * dx + dy * dy + dz * dz, wgt = q.power / (dd + 1); if (wgt > bw) { bw = wgt; const l = Math.sqrt(dd) || 1; light = [dx / l, dy / l, dz / l]; } }
      if (this.anchor === "trace") return P.trace(rgba, w, h, G, ss, info);   // measure the unpainted drawer
      const dk = globalThis.__lwDreamK || 0;   // the dream look (paint/dream.mjs): looser, broader strokes, stronger broken colour
      return P.paint(rgba, w, h, G, ss, { loose: 1 + 0.9 * dk, brokenK: 1 + 2.5 * dk, key: info.key, ppm: info.ppm, yawDeg: info.cam ? info.cam.yawDeg : 26, elevDeg: info.cam ? info.cam.elevDeg : 30, palette, haze, anchor: this.anchor, ox: info.ox, oy: info.oy, light, ground: info.ground });
    },
  };
  return true;
}
