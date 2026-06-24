/**
 * render-sound/index.mjs — acoustic renderer organ.
 *
 * Converts a polytope structure descriptor into a frequency-magnitude buffer
 * (Uint8Array[256]) compatible with Web Audio AnalyserNode.getByteFrequencyData().
 * Pure: no DOM, no Web Audio API, no external dependencies.
 *
 * MAPPING SPEC (deterministic, proven injective in experiment E4):
 *
 *   Input structure: { kind, n } where
 *     kind ∈ { "cube", "simplex", "orthoplex" }
 *     n    = dimension (integer ≥ 3)
 *
 *   Topological invariants derived from combinatorial formulas:
 *     V  = vertex count  (see polytopeCounts)
 *     E  = edge count
 *     r  = E / V        (edge-to-vertex ratio — unique per topology)
 *     D  = n            (dimension = number of spectral partials)
 *
 *   Spectral placement:
 *     fundamentalBin   = floor((V / V_MAX) * 200) + 10
 *       → Maps V linearly to bins 10..210; different vertex counts → different pitch.
 *     harmonicSpacing  = floor(r * 8) + 2
 *       → E/V is topology-distinct; gives spacing 2..~50 bins.
 *     numPartials      = D
 *       → One partial per dimension; partial p at: fundamentalBin + p * harmonicSpacing.
 *     amplitude of partial p: round(255 * exp(-p * 0.35))  (decaying harmonics)
 *     Gaussian smear ±3 bins (σ²=1) around each partial avoids single-bin spikes and
 *     lets spectrumBands() integrate smoothly.
 *
 *   INJECTIVITY: Two distinct (kind, n) pairs produce the same spectrum iff their
 *   (V, r, D) triples coincide. Within {cube, simplex, orthoplex} × n ∈ [3..8] all
 *   triples are distinct (verified by E4 experiment, zero cross-class collisions).
 *
 * Exports:
 *   sonify(structure, opts?)     → Uint8Array[256]
 *   sonifyPolytope({ kind, n })  → Uint8Array[256]
 *   polytopeCounts({ kind, n })  → { V, E, r, D, fundamentalBin, harmonicSpacing, numPartials }
 *   sonifyPartials({ partials })  → Uint8Array[256]  (generic path)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const FFT_SIZE = 256;

// Safe ceiling well above any structure in the test corpus.
// cube(8) has V=256; using 512 keeps all structures in the lower half of the
// bin range and gives room for future extension without breaking existing spectra.
const V_MAX = 512;

// ── Combinatorial polytope formulas ──────────────────────────────────────────
// All formulas are closed-form; no dependency on render-nd required.
//
//   cube(n):      V = 2^n,          E = n * 2^(n-1)
//   simplex(n):   V = n+1,          E = n*(n+1)/2
//   orthoplex(n): V = 2n,           E = 2n*(n-1)/2  = n*(n-1)  [cross-polytope]

function polytopeCounts({ kind, n }) {
  let V, E;
  switch (kind) {
    case "cube": {
      V = Math.pow(2, n);
      E = n * Math.pow(2, n - 1);
      break;
    }
    case "simplex": {
      V = n + 1;
      E = (n * (n + 1)) / 2;
      break;
    }
    case "orthoplex": {
      V = 2 * n;
      E = n * (n - 1);       // = 2 * C(n,2) * 2 / 2 = 2n(n-1)/2 * 2 — wait:
      // orthoplex (cross-polytope) in n dims: V=2n, each vertex connects to 2(n-1) others,
      // total degree = 2n * 2(n-1); E = n * 2(n-1) = 2n(n-1). Correct.
      E = 2 * n * (n - 1);
      break;
    }
    default:
      throw new Error(`render-sound: unknown kind "${kind}". Expected "cube", "simplex", or "orthoplex".`);
  }

  const r = E / V;
  const D = n;
  const fundamentalBin  = Math.floor((V / V_MAX) * 200) + 10;
  const harmonicSpacing = Math.floor(r * 8) + 2;
  const numPartials     = D;

  return { V, E, r, D, fundamentalBin, harmonicSpacing, numPartials };
}

// ── Core spectrum builder from partials list ──────────────────────────────────
// partials: Array of { bin: int, amp: int 0..255 }
// Returns Uint8Array[256].

function buildSpectrum(partials) {
  const freq = new Uint8Array(FFT_SIZE);

  for (const { bin, amp } of partials) {
    if (amp <= 0) continue;
    // Gaussian smear ±3 bins, σ²=1
    for (let delta = -3; delta <= 3; delta++) {
      const b = bin + delta;
      if (b < 0 || b >= FFT_SIZE) continue;
      const weight = Math.exp(-(delta * delta) / 2);
      const val = Math.round(amp * weight);
      // Keep peak (write-if-greater prevents summing artifacts at overlapping partials)
      if (val > freq[b]) freq[b] = val;
    }
  }

  return freq;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * sonifyPolytope({ kind, n }) → Uint8Array[256]
 *
 * The E4 mapping: derives topological invariants from combinatorial formulas,
 * places D harmonically-spaced partials with exponential amplitude decay.
 */
export function sonifyPolytope({ kind, n }) {
  const { fundamentalBin, harmonicSpacing, numPartials } = polytopeCounts({ kind, n });

  const partials = [];
  for (let p = 0; p < numPartials; p++) {
    const bin = fundamentalBin + p * harmonicSpacing;
    const amp = Math.round(255 * Math.exp(-p * 0.35));
    partials.push({ bin, amp });
  }

  return buildSpectrum(partials);
}

/**
 * sonifyPartials({ partials }) → Uint8Array[256]
 *
 * Generic path: accepts an explicit list of { bin, amp } descriptors.
 * Bins must be integers 0..255; amp must be integers 0..255.
 */
export function sonifyPartials({ partials }) {
  if (!Array.isArray(partials)) {
    throw new TypeError("render-sound: sonifyPartials requires { partials: [{bin, amp}, ...] }");
  }
  return buildSpectrum(partials);
}

/**
 * sonify(structure, opts?) → Uint8Array[256]
 *
 * Unified entry point. Dispatches on structure shape:
 *   { kind, n }          → sonifyPolytope (the E4 mapping)
 *   { partials }         → sonifyPartials (generic)
 *
 * opts is reserved for future use (e.g. { vMax, decayRate }) and currently ignored.
 */
export function sonify(structure, _opts) {
  if (!structure || typeof structure !== "object") {
    throw new TypeError("render-sound: sonify requires a structure object");
  }
  if ("partials" in structure) return sonifyPartials(structure);
  if ("kind" in structure && "n" in structure) return sonifyPolytope(structure);
  throw new TypeError(
    'render-sound: structure must have { kind, n } for a polytope or { partials } for generic input'
  );
}

// Re-export internals for tests / analysis
export { polytopeCounts };
