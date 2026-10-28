// adapters/bio.mjs: biological laws measured from open datasets, as nodes. Each node names the dataset and the measure
// file its law comes from, and has a parameter that turns the law off (random placement), so the law is visible.
//   bio.nuclei   nuclei packed by the hard-core law measured from BBBC038 (CC0) masks; the tissue as Voronoi cells
//   bio.vessels  a vessel tree grown by the branching laws measured from ARCADE (CC0) coronary angiograms
//   bio.bacteria rods and cocci shaped by the width-length law measured from DeepBacs (CC BY 4.0) masks
// Browser-safe: no node:fs.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { place, cells, PHI_TISSUE, TISSUE } from '../lib/bio/nuclei.mjs';
import { grow, ARCADE } from '../lib/bio/vessels.mjs';
import { place as placeCells, outline, SPECIES, SOURCE as BACT } from '../lib/bio/bacteria.mjs';

export const NODES = [
  defineNode({
    id: 'bio.nuclei', title: 'Nuclei by the measured packing law', lane: 'matter', domains: ['cell biology', 'geometry', 'histology'], source: `lib/bio/nuclei.mjs place, cells; law from ${TISSUE.source}`,
    doc: `Nuclei placed by random sequential addition with a hard core, phi / sqrt(density). phi ${PHI_TISSUE} reproduces the tissue median Clark-Evans R ${TISSUE.clarkR} (random placement: ${TISSUE.poissonR}); unfitted, it also lands the Voronoi side-count spread near tissue (1.33 against 1.28; random 1.62). phi 0 is random placement. Outputs the nuclei, the cells as a raster (membrane lines dark, nuclei stained) and the distance to the nearest nucleus.`,
    inputs: {}, outputs: { particles: 'particles', raster: 'raster', field: 'field' },
    params: {
      count: { type: 'int', min: 4, max: 2000, default: 70, unit: 'nuclei' },
      phi: { type: 'number', min: 0, max: 0.9, default: PHI_TISSUE, unit: 'hard core, share of mean spacing' },
      radius: { type: 'number', min: 0.05, max: 0.5, default: TISSUE.radius, unit: 'nucleus radius, share of mean spacing (measured median)' },
      stain: { type: 'color', default: '#3b2a6e' }, cytoplasm: { type: 'color', default: '#e7c3cf' }, membrane: { type: 'color', default: '#8a4f6a' },
    },
    cost: p => 0.004 * p.count * 256 * 256 / 1000,
    render: ({ params, w, h, rng }) => {
      const p = place({ w, h, n: params.count, phi: params.phi, rng }), n = p.x.length, sp = 1 / Math.sqrt(n / (w * h)), r = params.radius * sp;
      const { id, dist } = cells(p.x, p.y, w, h), R = make.raster(w, h), F = make.field(w, h);
      const [S, C, M] = [params.stain, params.cytoplasm, params.membrane].map(px.hexLin);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = y * w + x, edge = (x + 1 < w && id[k + 1] !== id[k]) || (y + 1 < h && id[k + w] !== id[k]);
        const c = dist[k] < r ? S : edge ? M : C;
        R.data[4 * k] = c[0]; R.data[4 * k + 1] = c[1]; R.data[4 * k + 2] = c[2]; R.data[4 * k + 3] = 1;
        F.data[k] = Math.min(1, dist[k] / sp);
      }
      return { particles: make.particles(w, h, p.x, p.y, { size: new Float32Array(n).fill(r) }), raster: R, field: F };
    },
  }),
  defineNode({
    id: 'bio.vessels', title: 'Vessels by the measured branching laws', lane: 'vector', domains: ['physiology', 'fluids', 'geometry'], source: `lib/bio/vessels.mjs grow; laws from ${ARCADE.source}`,
    doc: `Each segment splits in two. The children's diameters obey d0^x = d1^x + d2^x with x ${ARCADE.exponent} (measured; Murray's cube law, x 3, is the control and overshoots the measured child size, 0.88 against 0.71 of the parent), their asymmetry and the angle between them are sampled from the measured spread (angle median ${ARCADE.angle[1]} degrees), and the thinner child turns further, by Murray's split. Segments run about ${ARCADE.lengthOverD} diameters. Outputs the tree as tapered paths and painted.`,
    inputs: {}, outputs: { vector: 'vector', raster: 'raster' },
    params: {
      depth: { type: 'int', min: 1, max: 12, default: 8, unit: 'generations' },
      exponent: { type: 'number', min: 1, max: 4, default: ARCADE.exponent, unit: 'branching exponent x (3 is Murray)' },
      bend: { type: 'number', min: 0, max: 0.6, default: 0.12, unit: 'radians of wander per step' },
      ink: { type: 'color', default: '#5a1620' }, ground: { type: 'color', default: '#efe6da' },
    },
    cost: p => 2 * Math.pow(2, Math.min(p.depth, 12)) / 64,
    render: ({ params, w, h, rng }) => {
      const g = grow({ w, h, rng, depth: params.depth, exponent: params.exponent, bend: params.bend, minD: 0.5 });
      const paths = g.segs.map(s => ({ pts: s.pts, widths: s.pts.map((_, i) => s.d * (1 - 0.12 * i / (s.pts.length - 1))), stroke: params.ink }));
      const V = make.vector(w, h, paths);
      return { vector: V, raster: px.paintVector(V, { ground: params.ground, ink: params.ink }) };
    },
  }),
  defineNode({
    id: 'bio.bacteria', title: 'Bacteria by the measured shape law', lane: 'vector', domains: ['microbiology', 'geometry'], source: `lib/bio/bacteria.mjs place, outline; law from ${BACT}`,
    doc: 'Cells as stadiums, length and width sampled from the measured spread per species. The law: rods lengthen at a near-constant width (slope of log width on log length 0.038 for E. coli, 0.018 for B. subtilis; 0.62 for S. aureus cocci through the same measurement). law isotropic is the control: cells as scaled copies of one shape (slope 1). Placed without overlap.',
    inputs: {}, outputs: { vector: 'vector', raster: 'raster' },
    params: {
      species: { type: 'enum', options: Object.keys(SPECIES), default: 'e-coli' },
      law: { type: 'enum', options: ['measured', 'isotropic'], default: 'measured' },
      count: { type: 'int', min: 1, max: 4000, default: 140, unit: 'cells (fewer if the frame fills)' },
      scale: { type: 'number', min: 0.05, max: 4, default: 0.5, unit: 'frame px per dataset px' },
      align: { type: 'number', min: 0, max: 1, default: 0.4, unit: 'share of cells following the local flow' },
      ink: { type: 'color', default: '#2f5d50' }, ground: { type: 'color', default: '#e9ece4' },
    },
    cost: p => 0.02 * p.count * p.count / 100,
    render: ({ params, w, h, rng }) => {
      const cells = placeCells({ w, h, species: params.species, count: params.count, law: params.law, scale: params.scale, align: params.align, rng });
      const V = make.vector(w, h, cells.map(c => ({ pts: outline(c), closed: true, fill: params.ink })));
      return { vector: V, raster: px.paintVector(V, { ground: params.ground, ink: params.ink }) };
    },
  }),
];
