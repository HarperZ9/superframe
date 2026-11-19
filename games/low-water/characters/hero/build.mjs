// Build the hero cast for the native frame:
//   node hero/build.mjs OUTDIR [ids=lamb,coe,wenna,tobin] [lods=0,1,2] [--clay]
// writes OUTDIR/<id>.lod<N>.glb and OUTDIR/<id>.char.json (skeleton in the bind pose, the walk and
// idle clips baked at 30 fps, the materials with their scanned sets and tints, the lantern light,
// and each LOD's counts). --clay also writes OUTDIR/<id>-clay.png, a bind-pose clay preview.
import { writeFileSync, mkdirSync } from "node:fs";
import { CAST } from "./cast.mjs";
import { buildFigure } from "./figure.mjs";
import { writeGlb } from "./glb.mjs";
import { skeletonJson, bakeClip, bindPose } from "./rig.mjs";
import { library } from "../anim/library.mjs";
import { CLIPS } from "../anim/library.mjs";
import { clay } from "./preview.mjs";
import { decimate } from "./decimate.mjs";
import { writePng } from "../render/io.mjs";

const args = process.argv.slice(2), flags = args.filter((a) => a.startsWith("--")), pos = args.filter((a) => !a.startsWith("--"));
const outDir = pos[0] || "out", ids = (pos[1] || "lamb,coe,wenna,tobin").split(","), lods = (pos[2] || "0,1,2").split(",").map(Number);
mkdirSync(outDir, { recursive: true });

function clips(rec, B) {
  const P = rec.P, lib = library({}, { [rec.id]: P }), v = rec.walkSpeed ?? 1.3;
  const { cycle } = lib.loco(rec.id, v, 0), frames = Math.max(16, Math.round((cycle / v) * 30));
  const raw = (f) => lib.loco(rec.id, v, (((f % frames) + frames) % frames) / frames).pose;
  // the coat's skirt panels as a baked secondary layer: they follow their thigh's swing three frames
  // late at half its angle, and sway out a little at each step
  const walk = bakeClip(P, B, (f) => { const p = raw(f), lag = raw(f - 3); for (const s of ["L", "R"]) p["skirt" + s] = { swing: 0.5 * (lag["thigh" + s]?.fwd || 0), sway: 2 + 2 * Math.abs(Math.sin((2 * Math.PI * f) / frames)) }; return p; }, frames, 30, { cycle_m: +cycle.toFixed(4), speed: v });
  const idleN = CLIPS.idle.frames, idle = bakeClip(P, B, (f) => lib.pose(rec.id, "idle", f), idleN, 30);
  // the lantern brought up before the chest (a look at something in the dark), over the idle's breathing
  const raise = bakeClip(P, B, (f) => ({ ...lib.pose(rec.id, "idle", f), clavL: { lift: 6, fwd: 10 }, armL: { fwd: 48, out: 14 }, foreL: { bend: 92 }, handL: { bend: -12 }, hangL: { swing: 0 } }), idleN, 30);
  return { walk, idle, raise };
}

// LOD budgets for the sculpted buckets (strands, eyes and the tear line are kept apart): skin is
// weighted twice its share, so the face keeps its shape longest
const BUDGET = { 0: 650000, 1: 130000, 2: 32000 }, STRAND = new Set(["hair", "brow", "lash", "eye", "tear"]), KEEP = { 0: 1, 1: 0.3, 2: 0 };
function lodBuckets(raw, lod) {
  const o = new Map(); let total = 0;
  for (const [m, K] of raw) if (!STRAND.has(m)) total += (K.idx.length / 3) * (m === "skin" ? 2 : 1);
  for (const [m, K] of raw) {
    if (STRAND.has(m)) {
      if (m === "eye") { o.set(m, K); continue; }
      const keep = m === "lash" ? (lod === 0 ? 1 : 0) : m === "tear" ? (lod < 2 ? 1 : 0) : m === "brow" ? (lod < 2 ? 1 : 0) : KEEP[lod];
      if (keep <= 0) continue;
      if (keep >= 1) { o.set(m, K); continue; }
      const idx = []; for (let t = 0; t < K.idx.length; t += 3) if (K.col[K.idx[t] * 4 + 1] < keep) idx.push(K.idx[t], K.idx[t + 1], K.idx[t + 2]);
      o.set(m, { ...K, idx }); continue;
    }
    const share = ((K.idx.length / 3) * (m === "skin" ? 2 : 1)) / total, target = Math.max(200, Math.round(BUDGET[lod] * share));
    const t0 = Date.now(), D = decimate({ ...K, jnt: [...K.jnt], wgt: [...K.wgt] }, target);
    console.log(`  lod${lod} ${m}: ${K.idx.length / 3} -> ${D.idx.length / 3} (${Date.now() - t0} ms)`);
    o.set(m, D);
  }
  return o;
}
const countOf = (b) => { let triangles = 0, vertices = 0; const perMaterial = {}; for (const [m, K] of b) { triangles += K.idx.length / 3; vertices += K.pos.length / 3; perMaterial[m] = K.idx.length / 3; } return { triangles, vertices, perMaterial }; };

for (const id of ids) {
  const rec = CAST[id]; if (!rec) throw new Error(`no hero cast record ${id}`);
  const B = bindPose(rec.P), lodStats = [];
  let light = null;
  const t00 = Date.now(), fig0 = buildFigure(rec, 0), raw = fig0.buckets.out();
  console.log(`${id} raw: ${fig0.stats.triangles} triangles in ${Date.now() - t00} ms`);
  for (const lod of lods) {
    const t0 = Date.now(), buckets = lodBuckets(raw, lod), fig = { ...fig0, stats: { strands: 0, ...countOf(buckets) } };
    const glb = writeGlb(buckets, {}, { id, lod });
    writeFileSync(`${outDir}/${id}.lod${lod}.glb`, glb);
    light = fig.lightOffset;
    lodStats.push({ lod, file: `${id}.lod${lod}.glb`, triangles: fig.stats.triangles, vertices: fig.stats.vertices, strandTriangles: [...buckets].filter(([m]) => STRAND.has(m)).reduce((a, [, K]) => a + K.idx.length / 3, 0), perMaterial: fig.stats.perMaterial, bytes: glb.length, buildMs: Date.now() - t0 });
    console.log(`${id} lod${lod}: ${fig.stats.triangles} triangles, ${fig.stats.vertices} vertices, ${(glb.length / 1e6).toFixed(1)} MB, ${Date.now() - t0} ms`);
    if (lod === 0 && flags.includes("--clay")) {
      const ms = [...buckets.values()].map((k) => ({ pos: k.pos, nrm: k.nrm, tri: k.idx }));
      const views = [{ eye: [0.5, 1.2, 4.2], at: [0, 0.95, 0], fov: 28 }, { eye: [3.4, 1.3, 2.4], at: [0, 0.95, 0], fov: 28 }, { eye: [0.3, 1.72, 0.75], at: [0, 1.66, 0], fov: 30 }];
      writePng(`${outDir}/${id}-clay.png`, { width: 700 * 3, height: 1000, data: clay(ms, views, 700, 1000) });
    }
  }
  const C = clips(rec, B);
  const doc = { format: "lw-hero-char/1", id, height_m: rec.P.h, joints: skeletonJson(rec.P, B), clips: C, materials: rec.mats,
    lights: light && rec.lantern ? [{ joint: "hangL", offset: light, col: [1, 0.62, 0.3], power: 1.6, radius: 0.012 }] : [], lods: lodStats };
  writeFileSync(`${outDir}/${id}.char.json`, JSON.stringify(doc));
}
