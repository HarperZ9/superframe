// The Lamplighters (design/CAST-SHEETS.md): one Municipal costume (long dark coat, cap with a brass
// badge, a brass pole longer than the wearer, a notebook in the breast pocket), and for each named one
// a silhouette and a carried thing that read at quay distance:
//   gorm    sergeant; short and square, a short cape with pale braid, a pale band round the cap, the
//           open book held up at the chest, the pole planted upright like a staff, the head tilted
//           (she speaks only in questions)
//   hobb    eighteen; tall, thin, a coat too big at the shoulder, bare-headed, two lit lanterns held
//           out from the body, the pole slung on his back
//   fewell  broad; the pole carried on the shoulder, a pale bandage on the left hand, a moustache
//   strand  a long pale scarf hanging to the waist (his value split from Fewell in the pole pair),
//           a slouch; counts under his breath
//   bright  the teacher; tall and upright, a tall cap, spectacles, a pale slate under the left arm,
//           the pole slung on his back
//   coe     unnamed variants: thickset, a muffler (also the default "lamplighter")
// In a fight every one of them takes the pole in hand; the carried pole and props step aside.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf, shaft } from "./tools.mjs";
import { lantern } from "./lamb.mjs";

const V = {
  gorm: { P: { h: 1.66, leg: 0.47, head: 0.27, neck: 0.1, shoulder: 0.21, hip: 0.15, arm: 0.76, stoop: 0 }, face: { nose: [0.045, 0.026, 0.2, 0], jaw: 1.35, lids: 0.15, browW: 1.25, mouth: 0.75 }, hem: 0.5, carry: "staff" },
  hobb: { P: { h: 1.94, leg: 0.56, head: 0.24, neck: 0.18, shoulder: 0.14, hip: 0.1, arm: 0.86, stoop: 8 }, face: { nose: [0.07, 0.02, 0.4, 0.2], jaw: 0.8, chin: 1.3, lids: 0.05, mouth: 0.7 }, hem: 0.18, carry: "back", wide: 1.3, bare: true },
  fewell: { P: { h: 1.82, leg: 0.5, head: 0.26, neck: 0.11, shoulder: 0.24, hip: 0.14, arm: 0.8, stoop: 4 }, face: { nose: [0.06, 0.03, 0.3, 0], jaw: 1.2, lids: 0.5, stubble: true }, hem: 0.22, carry: "shoulder" },
  strand: { P: { h: 1.74, leg: 0.48, head: 0.27, neck: 0.1, shoulder: 0.19, hip: 0.14, arm: 0.78, stoop: 14 }, face: { nose: [0.05, 0.022, 0.3, 0.3], jaw: 0.95, lids: 0.6 }, hem: 0.2, carry: "hand" },
  bright: { P: { h: 1.88, leg: 0.52, head: 0.24, neck: 0.14, shoulder: 0.17, hip: 0.12, arm: 0.8, stoop: 0 }, face: { nose: [0.065, 0.02, 0.2, 0.5], jaw: 0.9, lids: 0.3 }, hem: 0.2, carry: "back" },
  coe: { P: { h: 1.68, leg: 0.47, head: 0.26, neck: 0.11, shoulder: 0.22, hip: 0.16, arm: 0.75, stoop: 5 }, face: { nose: [0.04, 0.03, 0.3, 0], jaw: 1.3, lids: 0.6, jowls: 0.8 }, hem: 0.22, carry: "hand" },
};

function make(name) {
  const v = V[name], P = v.P, R = 0.135 * (P.head / 0.26), hobb = name === "hobb";
  const member = {
    P, palette: {}, info: { coat: { kg: 3.5, stiff: 0.25 }, name, tool: "pole", bladeR: 0.04, radius: 0.3 },
    build({ lod = "far", tool = "pole" } = {}) {
      const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P), ch = J(B, "chest"), nk = J(B, "neck");
      torso(M, B, P, { w: P.shoulder + 0.02, waist: P.shoulder - 0.01, d: 0.14 + (P.shoulder - 0.19) * 0.6, mat: "muni" });
      skirt(M, B, P, { hem: v.hem, flare: 0.38, mat: "muni", gap: 0.03, wide: v.wide || 1 });
      legs(M, B, P, { r: 0.07, mat: "trouser", boot: "boot", bootTop: 0.35 });
      arms(M, B, P, { r: hobb ? 0.074 : 0.062, mat: "muni", cuff: name === "gorm" ? "braid" : "muni", handR: 0.052 });
      for (let k = 0; k < 4; k++) propBlob(M, B, "chest", [0.03, 0.1 - k * 0.1, 0.14], [0.011, 0.011, 0.008], "brass", { rings: 4, seg: 8 });
      propBlob(M, B, "chest", [-0.1, 0.05, 0.14], [0.04, 0.05, 0.012], "paper", { rings: 4, seg: 8 });   // the notebook
      head(M, B, P, { cell, r: R, neck: 0.055, hair: v.bare ? "crop" : "none", ...v.face });
      if (!v.bare) {
        const tall = name === "bright" ? 1.7 : 1;
        propBlob(M, B, "head", [0, R * (1.6 + 0.35 * (tall - 1)), -0.01], [R * 1.04, R * 0.42 * tall, R * 1.06], "muni", { rings: 6, seg: 16 });   // the cap
        propBlob(M, B, "head", [0, R * 1.32, R * 0.85], [R * 0.85, 0.012, R * 0.45], "boot", { rings: 4, seg: 12 });
        propBlob(M, B, "head", [0, R * 1.68, R * 1.05], [0.02, 0.018, 0.008], "brass", { rings: 4, seg: 8 });
        if (name === "gorm") tube(M, [{ c: add(J(B, "head"), [0, R * 1.36, -0.01]), rx: R * 1.06, rz: R * 1.08, w: { head: 1 } }, { c: add(J(B, "head"), [0, R * 1.5, -0.01]), rx: R * 1.06, rz: R * 1.08, w: { head: 1 } }], { mat: mid("braid"), seg: 18 });
      }
      if (name === "gorm") {   // the short sergeant's cape, braided at the hem
        const rings = []; for (let i = 0; i <= 4; i++) { const t = i / 4; rings.push({ c: [0, nk[1] - 0.02 - t * 0.3, -0.02], rx: 0.16 + 0.17 * t, rz: 0.14 + 0.12 * t, w: { chest: 0.7, clavL: 0.15, clavR: 0.15 }, mat: t > 0.85 ? mid("braid") : undefined }); }
        tube(M, rings, { arc: [-Math.PI * 0.55, Math.PI * 1.55], seg: 20, mat: mid("muni") });
        M.begin("book"); prop(M, B, "handL", [[0, -0.02, -0.02, 0.012, 0.15], [0, -0.06, 0.2, 0.012, 0.15]], "paper", { square: 6, seg: 8 }); M.end();
      }
      if (name === "strand" || name === "coe") propBlob(M, B, "neck", [0, 0, 0], [0.09, 0.06, 0.09], name === "strand" ? "paper" : "gansey", { rings: 6, seg: 14 });
      if (name === "strand") for (const x of [-0.06, 0.05]) prop(M, B, "chest", [[x, 0.22, 0.12, 0.035, 0.012], [x * 1.2, 0.0, 0.16, 0.04, 0.012], [x * 1.4, -0.3, 0.17, 0.045, 0.012]], "paper", { seg: 6 });   // the scarf's tails
      if (name === "fewell") { propBlob(M, B, "head", [0, R * 0.4, R * 0.92], [R * 0.45, R * 0.09, R * 0.14], "hair", { rings: 4, seg: 10 }); propBlob(M, B, "handL", [0, -0.06, 0.0], [0.05, 0.045, 0.055], "paper", { rings: 5, seg: 10 }); }
      if (name === "bright") { for (const x of [-1, 1]) propBlob(M, B, "head", [x * R * 0.33, R * 1.03, R * 0.93], [R * 0.17, R * 0.14, 0.006], "glass", { rings: 4, seg: 10 }); M.begin("slate"); prop(M, B, "chest", [[0.24, -0.15, -0.14, 0.012, 0.16], [0.24, -0.15, 0.14, 0.012, 0.16]], "paper", { square: 6, seg: 8 }); M.end(); }
      if (hobb) { M.begin("lanterns"); lantern(M, B, "hangL"); lantern(M, B, "hangR"); M.end(); }
      // the carried pole, outside a fight
      M.begin("carry");
      if (v.carry === "back") prop(M, B, "chest", [[0.22, 0.55, -0.18, 0.016], [-0.26, -0.95, -0.2, 0.016]], "brass", { seg: 8 });
      if (v.carry === "shoulder") prop(M, B, "chest", [[-0.22, 0.24, -0.9, 0.016], [-0.2, 0.3, 0.0, 0.016], [-0.18, 0.34, 0.8, 0.016]], "brass", { seg: 8 });
      M.end();
      M.begin("tool"); T.build(M, B); M.end();
      return { M, B, tool: T, grips: { L: name === "gorm" || hobb || !!T.twoHand, R: true }, hands: { L: name === "gorm" || hobb ? "fist" : "open", R: "fist" } };
    },
    style(p, clip) {
      const calm = !clip.tags?.includes("combat"), add = (j, k, d) => { p[j] = { ...(p[j] || {}), [k]: (p[j]?.[k] || 0) + d }; }, set = (j, k, d) => { p[j] = { ...(p[j] || {}), [k]: d }; };
      if (!calm) { p.hide = [...(p.hide || []), "carry", "book", "slate", "lanterns"]; return p; }
      if (v.carry !== "hand" && v.carry !== "staff") p.hide = [...(p.hide || []), "tool"];
      if (name === "gorm") { set("armL", "fwd", 52); set("armL", "out", 10); set("foreL", "bend", 104); set("armR", "fwd", 30); set("armR", "out", 12); set("foreR", "bend", 60); set("handR", "bend", 60); add("head", "side", 10); }
      if (hobb) for (const s of ["L", "R"]) { set("arm" + s, "fwd", Math.max(p["arm" + s]?.fwd || 0, 36)); add("arm" + s, "out", 10); set("fore" + s, "bend", Math.max(p["fore" + s]?.bend || 0, 42)); }
      if (name === "fewell") { set("armR", "fwd", 40); set("armR", "out", 30); set("foreR", "bend", 120); }
      if (name === "bright") { set("armL", "fwd", 4); set("armL", "out", 22); set("foreL", "bend", 70); add("head", "bend", -6); }
      if (name === "strand") add("head", "bend", 8);
      return p;
    },
  };
  return member;
}
export const GORM = make("gorm"), HOBB = make("hobb"), FEWELL = make("fewell"), STRAND = make("strand"), BRIGHT = make("bright"), COE = make("coe");
