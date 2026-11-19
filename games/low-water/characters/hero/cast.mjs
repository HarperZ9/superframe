// Hero cast records: Lamb (the cast record cast/lamb.mjs, grown to natural proportions: the long
// coat, wide hat, pale collar, lantern low in the left hand, the Kit case on its strap, the brass-shod
// rod) and three Hoarstead townspeople varied from the same generator. Faces are invented from
// proportion rules; none is drawn from a real person.
//   P: rig/skeleton.mjs proportions; face: hero/head.mjs; coat: hero/garments.mjs; mats: tints a material
const wool = (c) => ({ set: "Fabric031", kind: "cloth", tint: c, tile: 0.3, sheen: 0.55 });
const cloth = (c, tile = 0.25) => ({ set: "Fabric030", kind: "cloth", tint: c, tile, sheen: 0.4 });
const linen = (c) => ({ set: "Fabric036", kind: "cloth", tint: c, tile: 0.12, sheen: 0.25 });
const felt = (c) => ({ set: "Fabric034", kind: "cloth", tint: c, tile: 0.18, sheen: 0.5 });
const leather = (c, set = "Leather037") => ({ set, kind: "cloth", tint: c, tile: 0.3, sheen: 0, roughBias: -0.12 });
const common = (o) => ({
  skin: { kind: "skin", tint: o.skin }, eye: { kind: "eye", tint: o.iris }, tear: { kind: "eye", tint: [1, 1, 1] },
  hair: { kind: "hair", tint: o.hair }, brow: { kind: "hair", tint: o.hair.map((v) => v * 0.8) }, lash: { kind: "hair", tint: o.hair.map((v) => v * 0.5) },
  brass: { kind: "cloth", tint: [0.78, 0.56, 0.26], metal: 1, rough: 0.3 }, wood: { set: "medieval_wood", kind: "cloth", tint: [0.62, 0.5, 0.38], tile: 0.5, sheen: 0 },
  glass: { kind: "glass" }, flame: { kind: "lamp" }, sole: leather([0.25, 0.22, 0.2]), leather: leather([0.62, 0.5, 0.42]), glove: leather([0.7, 0.58, 0.48], "Leather014"),
  band: linen([0.08, 0.07, 0.07]), linen: linen([0.86, 0.83, 0.76]),
});

export const CAST = {
  lamb: { id: "lamb", P: { h: 1.86, leg: 0.5, head: 0.235, neck: 0.14, shoulder: 0.2, hip: 0.12, arm: 0.79, stoop: 6 },
    face: { gaunt: 0.65, jaw: 1.0, chin: 1.05, nose: { len: 1.12, w: 0.95, hook: 0.5, tip: 0.95 }, brow: 1.05, lip: 0.85, age: 0.6, neck: 0.95, stubble: 0.55 },
    coat: { hem: 0.38, flare: 0.55, ease: 0.02 }, bootTop: 0.36, hat: { kind: "brim", brim: 0.082, crown: 0.1, tilt: 5, curl: 0.022 },
    hair: { count: 5200, len: 0.032, line: -0.03, w: 0.0008 }, satchel: true, lantern: true, rod: true,
    mats: { ...common({ skin: [0.62, 0.45, 0.37], iris: [0.3, 0.38, 0.42], hair: [0.13, 0.1, 0.08] }), wool: wool([0.36, 0.37, 0.41]), lining: linen([0.42, 0.13, 0.1]), felt: felt([0.2, 0.19, 0.18]), cloth: cloth([0.22, 0.21, 0.2]) } },
  coe: { id: "coe", P: { h: 1.74, leg: 0.48, head: 0.232, neck: 0.1, shoulder: 0.22, hip: 0.14, arm: 0.75, stoop: 4, build: 1.12 },
    face: { s: 1.02, gaunt: 0.1, jaw: 1.12, chin: 0.95, cheek: 1.15, nose: { len: 0.95, w: 1.2, hook: 0, tip: 1.2 }, brow: 1.1, lip: 1.05, age: 0.75, stubble: 0.3 },
    coat: { hem: 0.62, flare: 0.35, ease: 0.025, slit: true }, bootTop: 0.3, hat: { kind: "cap", rx: 0.084, rz: 0.104 },
    hair: { count: 3500, len: 0.03, line: -0.035 }, beard: { count: 4200, len: 0.03 },
    mats: { ...common({ skin: [0.58, 0.4, 0.31], iris: [0.25, 0.18, 0.1], hair: [0.32, 0.3, 0.28] }), wool: wool([0.33, 0.26, 0.2]), lining: linen([0.3, 0.28, 0.24]), felt: cloth([0.18, 0.18, 0.2], 0.15), cloth: cloth([0.15, 0.15, 0.17]) } },
  wenna: { id: "wenna", P: { h: 1.6, leg: 0.47, head: 0.222, neck: 0.1, shoulder: 0.17, hip: 0.145, arm: 0.68, stoop: 16, build: 1.0 },
    face: { s: 0.94, gaunt: 0.5, jaw: 0.88, chin: 0.95, cheek: 1.05, nose: { len: 1.0, w: 0.9, hook: 0.3, tip: 0.9 }, brow: 0.9, lip: 0.8, age: 1, ear: 1.05, adam: 0.2 },
    coat: { hem: 0.06, flare: 0.75, ease: 0.025, slit: false, vent: false, buttons: true }, bootTop: 0.2, hat: { kind: "brim", brim: 0.045, crown: 0.085, rx: 0.079, rz: 0.1, tilt: 2, curl: 0.03 },
    hair: { count: 4000, len: 0.045, line: -0.04, lift: 0.004 },
    mats: { ...common({ skin: [0.7, 0.55, 0.47], iris: [0.35, 0.36, 0.3], hair: [0.62, 0.6, 0.58] }), wool: wool([0.2, 0.22, 0.26]), lining: linen([0.5, 0.48, 0.42]), felt: felt([0.12, 0.11, 0.12]), cloth: cloth([0.2, 0.2, 0.2]) } },
  tobin: { id: "tobin", P: { h: 1.79, leg: 0.5, head: 0.228, neck: 0.12, shoulder: 0.2, hip: 0.125, arm: 0.77, stoop: 2 },
    face: { s: 0.98, gaunt: 0.3, jaw: 1.05, chin: 1.1, nose: { len: 1.0, w: 1.0, hook: 0.1, tip: 1.0 }, brow: 1.0, lip: 1.0, age: 0.3, stubble: 0.8 },
    coat: { hem: 0.5, flare: 0.45, ease: 0.02 }, bootTop: 0.34, hat: { kind: "cap", rx: 0.08, rz: 0.1 },
    hair: { count: 4500, len: 0.04, line: -0.03 },
    mats: { ...common({ skin: [0.45, 0.31, 0.23], iris: [0.15, 0.1, 0.06], hair: [0.06, 0.05, 0.045] }), wool: wool([0.25, 0.3, 0.27]), lining: linen([0.55, 0.45, 0.3]), felt: cloth([0.3, 0.27, 0.22], 0.15), cloth: cloth([0.28, 0.25, 0.2]) } },
};
