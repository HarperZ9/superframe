// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// library.mjs: studies from the reference library as concept inks for bath.mjs. Node only (reads files).
// A study (an evidence unit in units.json) holds a list of concepts; each concept has a measured colour in
// concepts.jsonl. An element's weight within its study is set by `weighting`:
//   equal  every concept the study holds weighs the same
//   idf    log(N / df), N studies and df the studies holding the concept: a concept few studies share carries more
//          of what makes this study distinct, and one every study holds carries little
// Each study weighs the same by default (unitWeight 'equal'), so a study that lists many concepts does not take the
// bath; unitWeight 'concepts' weighs a study by the sum of its elements. Elements are ordered heaviest first.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// the reference library is not part of this repository; SUPERFRAME_LIBRARY points at a copy, and tests that read it skip without one
export const LIBRARY = process.env.SUPERFRAME_LIBRARY ?? new URL('../../../library/', import.meta.url);
export const hasLibrary = (dir = LIBRARY) => existsSync(dir instanceof URL ? new URL('concepts.jsonl', dir) : join(dir, 'concepts.jsonl'));

export function loadLibrary(dir = LIBRARY) {
  const at = f => (dir instanceof URL ? new URL(f, dir) : join(dir, f));
  const concepts = new Map();
  for (const line of readFileSync(at('concepts.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const c = JSON.parse(line); concepts.set(c.concept, { id: c.concept, symbol: c.symbol, sheet: c.sheet, colour: c.colour?.hex ?? null });
  }
  const units = JSON.parse(readFileSync(at('units.json'), 'utf8'));
  const df = new Map();
  for (const u of Object.values(units)) for (const c of new Set(u.concepts)) df.set(c, (df.get(c) ?? 0) + 1);
  return { concepts, units, df, n: Object.keys(units).length };
}

export function sourcesFor(lib, unitIds, { weighting = 'idf', unitWeight = 'equal' } = {}) {
  return unitIds.map(id => {
    const u = lib.units[id];
    if (!u) throw new Error(`marble library: no study "${id}" in units.json`);
    const ids = [...new Set(u.concepts)].filter(c => lib.concepts.has(c));
    if (!ids.length) throw new Error(`marble library: study "${id}" holds no concept with a record in concepts.jsonl`);
    const elements = ids.map(c => ({ id: c, symbol: lib.concepts.get(c).symbol, colour: lib.concepts.get(c).colour,
      weight: weighting === 'equal' ? 1 : Math.log(lib.n / (lib.df.get(c) ?? 1)) }));
    elements.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1));
    const total = elements.reduce((a, e) => a + e.weight, 0);
    return { id, medium: u.medium, weight: unitWeight === 'equal' ? 1 : total, elements };
  });
}
