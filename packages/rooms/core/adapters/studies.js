// SPDX-License-Identifier: FSL-1.1-MIT
// Adapters for two benches still being written elsewhere. They read each bench's published file shape and change
// nothing in it. When the benches land as packages these become imports.
import { surf, paraxImage } from "../train.js";

const UNBUILT_GROUP = "Unbuilt: designs, not hardware";

/** vbench.presets/1: returns entries in the shape of PRESETS, labelled as unbuilt. */
export function fromVbenchPresets(file) {
  if (file.schema !== "vbench.presets/1") throw new Error(`unknown preset schema ${file.schema}`);
  const out = {};
  for (const u of file.presets) {
    if (!u.surfaces || !u.surfaces.length) throw new Error(`preset ${u.key} has no surfaces`);
    out[u.key] = {
      group: UNBUILT_GROUP,
      name: u.name,
      note: u.note,
      label: u.label,
      source: u.source,
      make() {
        const s = u.surfaces.map(surf);
        if (s[s.length - 1].ty !== 3) s.push(surf({ z: paraxImage(s), ty: 3, ap: s[0].ap }));
        return { s, fieldDeg: u.fieldDeg || 0.1, src: "star" };
      },
    };
  }
  return out;
}

/**
 * lenspipe.design/1: surfaces with r, t, material and semi. `glass(name)` returns { nd, vd } or null for an unknown
 * name, and a design that names an unknown glass is refused here instead of tracing as air.
 */
export function fromLensDesign(design, glass) {
  if (design.schema !== "lenspipe.design/1") throw new Error(`unknown design schema ${design.schema}`);
  let z = 0;
  const s = [];
  for (const q of design.surfaces) {
    const g = q.material ? glass(q.material) : { nd: 1, vd: 0 };
    if (!g) throw new Error(`design ${design.id}: unknown glass ${q.material}`);
    s.push(surf({ z, R: q.r || 0, n: g.nd, V: g.vd, ap: q.semi, ty: q.stop ? 2 : 0, name: q.material || "" }));
    z += q.t;
  }
  s.push(surf({ z, ty: 3, ap: 1e3 }));
  const pupil = design.intent ? design.intent.efl / design.intent.fno / 2 : s[0].ap;
  return { s, pupil, unitM: design.units === "mm" ? 1e-3 : 1, expect: design.intent && design.intent.efl };
}
