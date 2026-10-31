// SPDX-License-Identifier: FSL-1.1-MIT
// Every physical constant is a frozen record: value, unit, source, and how it was checked. A record with no
// check names carries the flag. "verified" means a comparison that someone ran and wrote down, never a citation.
import { unit } from "./units.js";

export const FROM_MEMORY = "from memory, unverified";

export function constant(value, unitName, { source, verified = false, note } = {}) {
  if (!source) throw new Error(`constant ${value} has no source`);
  if (verified && !(verified.against && verified.result))
    throw new Error(`constant ${value}: a check must name what it ran against and its result`);
  unit(unitName);
  return Object.freeze({
    value,
    unit: unitName,
    source,
    verified: verified ? Object.freeze(verified) : false,
    flag: verified ? null : FROM_MEMORY,
    ...(note ? { note } : {}),
  });
}

export function auditConstants(table) {
  const rows = Object.entries(table);
  const unverified = rows.filter(([, q]) => q.flag).map(([k]) => k);
  return {
    total: rows.length,
    verified: rows.length - unverified.length,
    unverified: unverified.length,
    unverifiedNames: unverified,
  };
}
