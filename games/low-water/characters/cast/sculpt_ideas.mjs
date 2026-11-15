// One strong idea per face for the sculpted head (cast/sculpt.mjs), laid over each person's record so the cast
// reads apart in silhouette (characters/notes/HEAD-BOUNDS.md, distinctness). Each line names the written idea
// (info.quota.idea in cast/quota.mjs and quota2.mjs) and says how the head carries it. Factors multiply the
// person's own value (mul) or replace it (set); the people's ranges stay the base.
export const IDEAS = {
  ned:        { why: "the good hat's line across a long careful face", mul: { nose: [1.12, 0.95, 1, 1], faceLen: 1.03, skull: [0.98, 1.02, 1], jaw: 0.94, mouth: 0.92 }, set: { socket: 1.6 } },
  anni_adult: { why: "Ned's long careful face, wide watchful eyes", mul: { nose: [1.1, 0.95, 1, 1], chin: 1.06, faceLen: 1.03, skull: [0.98, 1.01, 1], jaw: 0.92, eyes: 1.06 } },
  anni:       { why: "Ned's long face at fourteen, wide eyes", mul: { nose: [1.1, 0.95, 1, 1], faceLen: 1.04, jaw: 0.88, eyes: 1.08, cheekR: 0.85 } },
  will:       { why: "a flushed broken nose over a jaw like a step", mul: { jaw: 1.06, faceLen: 0.97 }, set: { jawCorners: 1.2 } },
  davey:      { why: "his father's broken nose already", mul: { nose: [0.9, 1.15, 1, 1], jaw: 1.15, faceLen: 0.95, chin: 1.1, eyes: 0.94, cheekR: 1.15 }, set: { noseBend: 0.05, jawCorners: 0.7 } },
  abel:       { why: "old, the long straight nose", mul: { faceLen: 1.04, cheekR: 0.85 }, set: { hunger: 0.6 } },
  abel_era1:  { why: "the good hat worn proud over a long straight nose", mul: { chin: 1.08, jaw: 1.05 }, set: { jawCorners: 0.9 } },
  captain:    { why: "a long clean chin", mul: { nose: [0.92, 0.9, 0.6, 1], chin: 1.12, faceLen: 1.04, mouth: 0.9 }, set: { jawCorners: 0.2 } },
  pell_adult: { why: "his grandfather's long nose, a rounder head than his father's", mul: { skull: [1.06, 0.97, 1.02], faceLen: 0.96, mouth: 1.1, cheekR: 1.12 } },
  pell:       { why: "the long nose arriving early on a narrow boy", mul: { nose: [1.2, 0.95, 1, 1], skull: [0.94, 1.03, 1], jaw: 0.88, faceLen: 1.07 } },
  mary:       { why: "high tight cheekbones over a mouth kept straight", mul: { nose: [0.95, 0.9, 0.7, 1], jaw: 0.92, faceLen: 1.02 }, set: { cheekbones: 1.1, cheekR: 0.75 } },
  lil:        { why: "her sister's cheekbones, a smile kept ready", mul: { nose: [0.85, 1.05, 0.5, 1], chin: 0.92, faceLen: 0.95, mouth: 1.12, cheekR: 1.25, jaw: 1.1, skull: [1.03, 0.99, 1] } },
  bet:        { why: "a broad strong face gone thin", mul: { jaw: 1.12, skull: [1.05, 0.97, 1], faceLen: 0.95 }, set: { hunger: 0.9, jawCorners: 0.9 } },
  edie:       { why: "a face held still: narrow, pinched", mul: { nose: [1.1, 0.85, 1.4, 1], jaw: 0.86, skull: [0.94, 1.02, 1], chin: 0.92, mouth: 0.85 } },
  gedge:      { why: "a bull's neck and a grin that comes too easily", mul: { jaw: 1.15, faceLen: 0.96, mouth: 1.15 }, set: { jawCorners: 1.1 } },
  mott:       { why: "a narrow head bent to the ledger, a thin pinched nose", mul: { nose: [0.9, 0.75, 1.6, 1], chin: 0.85, skull: [0.96, 1.03, 1.02], jaw: 0.88, faceLen: 1.03 } },
  pask:       { why: "the one soft round fed face", mul: { faceLen: 0.96 }, set: { cheekR: 1.5, jawCorners: 0, jowls: 1 } },
  tesk:       { why: "a hill face like bark", mul: { faceLen: 0.95, jaw: 1.06 }, set: { lines: 1, hunger: 0.8, cheekbones: 1.1 } },
  ilo:        { why: "his son's cheekbones grown broad and weathered", mul: { jaw: 1.04 }, set: { cheekbones: 1.2, lines: 0.8 } },
  tomas:      { why: "hollow cheeks under high cheekbones", mul: { faceLen: 1.04, jaw: 0.88, chin: 0.92 }, set: { cheekbones: 1.2, hunger: 1, cheekR: 0.8 } },
  aaron:      { why: "a town crop, the ears, more his mother's face", mul: { faceLen: 0.95, cheekR: 1.1 } },
  rose:       { why: "her mother's face, very small and very round", mul: { cheekR: 1.1 } },
};
const G = 1.6;   // each idea drawn past its written factor (the silhouettes measured too alike at one); face length and
// skull width stay near the person's own, since they move the head's proportion bounds (HEAD-BOUNDS.md section 1)
export function withIdea(o) {
  const I = IDEAS[o.id]; if (!I) return o; const q = { ...o }, g = (m) => 1 + (m - 1) * G;
  for (const [k, v] of Object.entries(I.mul || {})) { if (Array.isArray(v)) q[k] = (o[k] || [1, 1, 1]).map((x, i) => x * v[i]); else q[k] = (o[k] ?? 1) * (k === "faceLen" ? v : g(v)); }
  return { ...q, ...(I.set || {}) };
}
