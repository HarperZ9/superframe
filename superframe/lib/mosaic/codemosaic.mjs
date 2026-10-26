// lib/mosaic/codemosaic.mjs: the code mosaic (CORE.md, "Marks"). The tiles are real lines from our own public
// repositories (data/code-lines.json, made by tools/code-corpus.mjs at each repository's origin/main), chosen by ink
// coverage so the text carries the tone: readable up close, an image from a distance. Close and far are two readouts
// of one element.
//   codeMosaic(ink, W, H, { cw, ch, weights: [300, 500, 800], corpus, reuse })
//   -> { cols, rows, cw, ch, lines: [text], weightOf (per cell index into weights), coverage (raster),
//        provenance: [{ repo, sha, path, line, row, at }] }
// Per row, left to right, the line whose characters' coverages best fit the next cells is set (each line used once
// unless reuse), then each character takes the weight whose coverage is nearest its cell's tone. Spaces stay spaces.
import { atlas, rampOf, drawField, MONO } from './glyphs.mjs';
const NODE = typeof process !== 'undefined' && !!process.versions?.node;
const fs = NODE ? await import('node:fs') : null;

let CORPUS = null;
export async function loadCorpus() {
  if (CORPUS) return CORPUS;
  const u = new URL('./data/code-lines.json', import.meta.url);
  CORPUS = fs ? JSON.parse(fs.readFileSync(u, 'utf8')) : await (await fetch(u)).json();
  return CORPUS;
}

export function codeMosaic(ink, W, H, { cw = 10, ch = 16, weights = [300, 500, 800], corpus, reuse = false, gap = 1, am = 1 } = {}) {
  if (!corpus?.lines?.length) throw new Error('codeMosaic: needs the corpus (await loadCorpus())');
  const chars = new Set(' '); for (const l of corpus.lines) for (const c of l.t) chars.add(c);
  const A = weights.map(w => atlas([...chars], cw, ch, { face: { ...MONO, weight: w } }));
  const cov = A.map(a => new Map(rampOf(a).map(r => [r.ch, r.coverage])));
  const top = Math.max(...cov.at(-1).values()), cols = Math.floor(W / cw), rows = Math.floor(H / ch);
  // the cells' tones, rescaled to what the heaviest weight can reach
  const T = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { let s = 0; for (let y = r * ch; y < (r + 1) * ch; y++) for (let x = c * cw; x < (c + 1) * cw; x++) s += ink[y * W + x]; T[r * cols + c] = (s / (cw * ch)) * top; }
  // each line's per-character coverage in every weight, once
  const LC = corpus.lines.map(l => { const Q = cov.length, C = new Float32Array(l.t.length * Q); for (let k = 0; k < l.t.length; k++) for (let q = 0; q < Q; q++) C[k * Q + q] = cov[q].get(l.t[k]) ?? 0; return C; });
  const best = (c, t) => { let k = 0, e = Infinity; for (let q = 0; q < cov.length; q++) { const d = Math.abs((cov[q].get(c) ?? 0) - t); if (d < e) { e = d; k = q; } } return [k, e]; };
  const used = new Set(), text = [], weightOf = new Uint8Array(cols * rows), provenance = [];
  for (let r = 0; r < rows; r++) {
    const row = new Array(cols).fill(' ');
    let p = 0;
    while (p < cols) {
      let bi = -1, be = Infinity;
      for (let li = 0; li < corpus.lines.length; li++) {
        if (!reuse && used.has(li)) continue;
        const t = corpus.lines[li].t, n = Math.min(t.length, cols - p); if (n < Math.min(12, cols - p)) continue;
        const C = LC[li], Q = cov.length; let e = 0;
        for (let k = 0; k < n; k++) { const tg = T[r * cols + p + k]; let d = Infinity; for (let q = 0; q < Q; q++) { const v = Math.abs(C[k * Q + q] - tg); if (v < d) d = v; } e += d * d; if (e > be * n) break; }
        e /= n; if (e < be) { be = e; bi = li; }
      }
      if (bi < 0) break;
      used.add(bi); const L = corpus.lines[bi], n = Math.min(L.t.length, cols - p), S = corpus.sources[L.s];
      for (let k = 0; k < n; k++) row[p + k] = L.t[k];
      provenance.push({ repo: S.repo, sha: S.sha, path: S.path, line: L.n, row: r, at: p, chars: n });
      p += n + gap;
    }
    for (let c = 0; c < cols; c++) weightOf[r * cols + c] = row[c] === ' ' ? 0 : best(row[c], T[r * cols + c])[0];
    text.push(row.join(''));
  }
  const field = { cols, rows, cw, ch, chars: text.join('').split('') };
  const coverage = drawField(field, W, H, A[0], { atlases: A, weightOf, am });   // am: see glyphs.mjs drawField
  return { cols, rows, cw, ch, lines: text, weights, weightOf, coverage, provenance, scale: top };
}
