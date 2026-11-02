// SPDX-License-Identifier: FSL-1.1-MIT
// A property as a physical object in calculation space. A property has a state space with a shape, operations on it, the
// physical elements that perform them, the instrument assembled from them and a fabrication route with its limits.
// The shape renders a real mathematical object in coordinates someone chose, and the record says so.
export const POTENTIAL = "potential";
export const MEASURED = "measured";

const need = (o, k, what) => {
  if (o[k] === undefined || o[k] === null || o[k] === "") throw new Error(`${what}: missing ${k}`);
};
export function propertyObject(p) {
  for (const k of ["id", "name", "stateSpace", "operations", "fabrication"]) need(p, k, "property");
  for (const k of ["name", "shape", "coordinates"]) need(p.stateSpace, k, `state space of ${p.id}`);
  if (p.stateSpace.coordinates.chosen !== true) throw new Error(`${p.id}: coordinates must be marked as chosen`);
  for (const op of p.operations) for (const k of ["id", "name", "element"]) need(op, k, `operation of ${p.id}`);
  need(p.fabrication, "route", `fabrication of ${p.id}`);
  if (!Array.isArray(p.fabrication.limits) || !p.fabrication.limits.length)
    throw new Error(`${p.id}: a fabrication route must state its limits`);
  return Object.freeze(p);
}
/**
 * An instrument starts potential and carries the bench's verdict. Only a measurement of a physical part changes the state.
 * A passing verdict says the model accepts the design and leaves the state alone.
 */
export function instrument({ property, elements, path, verdict, limits = [], unmodelled = [] }) {
  need(verdict, "check", "verdict");
  if (typeof verdict.pass !== "boolean") throw new Error("verdict: pass must be true or false");
  return { property, elements, path, verdict, limits, unmodelled, state: POTENTIAL, measurement: null };
}
export function recordMeasurement(ins, m) {
  for (const k of ["part", "instrument", "reading", "by", "date"]) need(m, k, "measurement");
  return { ...ins, state: MEASURED, measurement: m };
}
/** The plain label, kept apart from anything drawn. */
export const plainLabel = (ins) =>
  `${ins.state}. Bench verdict: ${ins.verdict.pass ? "pass" : "fail"} on ${ins.verdict.check}.`;
