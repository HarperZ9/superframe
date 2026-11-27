// SPDX-License-Identifier: MIT
// properties.mjs: the property registry of the field. Each property is a capability any element can carry at a
// weight, and each is the core of a package that already exists, used as it stands: nothing here re-derives what the
// package computes. The record of each property is a propertyObject (rooms/properties/model.js): its state space,
// its operations, the physical elements that perform them and a fabrication route with its limits. `core` names
// the package, the file and the exports the property runs on, so tests/parity.test.mjs can hold every one in place.
import { propertyObject, instrument, plainLabel } from "../rooms/properties/model.js";
import { rk4 } from "../rooms/core/trace.js";
import { MATERIAL_RECORDS } from "../rooms/core/constants.js";
import { FIELDS } from "../rooms/core/fields.js";
import { advect, diffuse, project, confine } from "../../superframe/lib/medium/grid.mjs";
import { WaveField } from "../rooms/solvers/sound/fdtd.js";
import { hammerstad } from "../rooms/solvers/pcb/formulas.js";
import { STACKS } from "../rooms/solvers/pcb/constants.js";
import { statusFrom } from "../rooms/maps/map.js";
import { luneburgN2 } from "./field.mjs";

// The cores, gathered so scene.mjs reaches every package through this one door.
export const CORES = Object.freeze({ rk4, advect, diffuse, project, confine, WaveField, hammerstad, statusFrom, instrument, plainLabel });

const rec = (p) => Object.freeze({ ...propertyObject(p.record), core: Object.freeze(p.core), reads: p.reads, gives: p.gives, limits: Object.freeze(p.limits) });
const nd = (material) => MATERIAL_RECORDS[material]?.nd?.value;

// Dye in water raises its index the way dissolved sugar does; 0.2 of n^2 at full dye is about n 1.40 over water's
// 1.333. The figure is chosen to make the moving dye visible, not read from a measured solution.
export const DYE_N2 = 0.2;
// A pressure wave changes density and so the index (the acousto-optic effect). The coupling is exaggerated many
// times over real water so the ripples bend light visibly; the form, a change in n^2 in proportion to pressure, holds.
export const SOUND_N2 = 0.35;
// The board the circuit property lays: the two-layer stack of the PCB core, its trace drawn at w/h = 1.9.
export const BOARD = Object.freeze({ h: STACKS[2].diel[0], w: 1.9 * STACKS[2].diel[0], er: STACKS[2].er, mat: STACKS[2].mat });

// n^2 an element would give at a point if it carried the lens fully: its own profile in its own frame.
export function lensProfile(el, px, py, dye = 0) {
  const r = Math.hypot(px - el.x, py - el.y), R = el.radius, kind = el.traits.profile || "material";
  if (kind === "luneburg") return luneburgN2(r, R);
  if (kind === "eaton") return r < R ? Math.min(6, Math.max((2 * R) / Math.max(r, 0.02 * R) - 1, 0.01)) : 1;
  const n = nd(el.traits.material || "water");
  if (!Number.isFinite(n)) throw new Error(`lens: ${el.id} names the material "${el.traits.material}", which the constants table lacks`);
  return n * n + DYE_N2 * dye;
}
// Microstrip impedance on a substrate whose permittivity is the field's n^2 there, plus the board where the circuit
// property lays one: er = n^2 + s * (er_board - 1). Hammerstad's formula, from the PCB core.
export const traceZ0 = (n2, s) => hammerstad(BOARD.w, BOARD.h, n2 + s * (BOARD.er - 1)).z;

export const PROPERTIES = Object.freeze({
  lens: rec({
    record: { id: "lens", name: "Refraction", stateSpace: { name: "Index of refraction squared over the plane", shape: "scalar field n^2(x, y)", coordinates: { chosen: true, name: "scene x, y", note: "Rays follow x'' = grad(n^2) / 2, with |x'| = n." } },
      operations: [{ id: "bend", name: "Bend a ray by the index gradient", element: "a graded-index medium (Luneburg, Eaton) or a uniform glass or water" }],
      fabrication: { route: "Graded-index glass by ion exchange, or stepped shells of uniform glasses (findings F210)", limits: ["A real Luneburg lens is built in steps; the field draws the smooth profile", "Dispersion is not modelled: one wavelength", "No reflection at the rim; the rim is a gradient"] } },
    core: { package: "rooms", file: "packages/rooms/core/trace.js", exports: ["rk4"], also: [["packages/rooms/core/fields.js", "FIELDS"], ["packages/rooms/core/constants.js", "MATERIAL_RECORDS"]] },
    reads: ["dye", "pressure"], gives: ["n2", "rays"],
    limits: [`Luneburg n^2 = 2 - r^2/R^2 (${FIELDS.luneburg.name}); Eaton as in ${FIELDS.eaton.name}`, `water n ${nd("water")} and glass n ${nd("glass")} from the constants table`],
  }),
  flow: rec({
    record: { id: "flow", name: "Flow", stateSpace: { name: "Incompressible velocity and a carried dye", shape: "vector field u(x, y) and scalar dye q(x, y)", coordinates: { chosen: true, name: "grid cells" } },
      operations: [{ id: "carry", name: "Carry dye along the flow, spread it, keep the flow divergence-free", element: "a stirred liquid" }],
      fabrication: { route: "A stirred tank of water with dye", limits: ["Stam's stable fluids on a coarse grid: diffusive at small scales", "Semi-Lagrangian advection does not conserve dye; the total is renormalised", "Two dimensions"] } },
    core: { package: "superframe medium", file: "superframe/lib/medium/grid.mjs", exports: ["advect", "diffuse", "project", "confine"], also: [["creation/lib/gen/advect.mjs", "advect"]] },
    reads: [], gives: ["velocity", "dye"],
    limits: ["Outside what carries flow the water is held still; across the rim it slows smoothly"],
  }),
  measure: rec({
    record: { id: "measure", name: "Measurement", stateSpace: { name: "Readings over what carries the property", shape: "weighted means with spread", coordinates: { chosen: true, name: "the units of each reading" } },
      operations: [{ id: "read", name: "Read the field where the property is carried, weighted by its strength", element: "a probe, or anything given the property" }],
      fabrication: { route: "The instrument pipeline in packages/instruments: principle, twin, front end, calibration", limits: ["Every reading here is simulated: its state stays potential until a physical part is measured", "Spread is over the region, not a calibrated uncertainty"] } },
    core: { package: "rooms properties, instruments", file: "packages/rooms/properties/model.js", exports: ["instrument", "plainLabel"], also: [["packages/instruments/schemas/receipt.schema.json", "receipt"]] },
    reads: ["n2", "velocity", "dye", "pressure", "z0"], gives: ["numbers"],
    limits: ["A weight of 0 everywhere means nothing is read, and the readout says so"],
  }),
  shape: rec({
    record: { id: "shape", name: "Shape", stateSpace: { name: "Dimensions of what carries the property", shape: "centroid, two diameters, an angle, an area", coordinates: { chosen: true, name: "scene units, one unit read as 100 mm" } },
      operations: [{ id: "dimension", name: "Dimension a region by its second moments", element: "a drawing with a toleranced dimension" }],
      fabrication: { route: "The CAD model in packages/diagram/cad: parts, drawing, tolerances, exports", limits: ["Diameters are of the equivalent ellipse (exact for a uniform ellipse)", "A dimension without a tolerance is refused, as the CAD core refuses one"] } },
    core: { package: "diagram cad", file: "packages/diagram/cad/src/param.js", exports: ["hasTol"], also: [["packages/diagram/cad/src/blueprint.js", "dims"]] },
    reads: ["presence", "dye"], gives: ["dims"],
    limits: ["Tolerance is half a grid cell plus the spread a rim adds"],
  }),
  sound: rec({
    record: { id: "sound", name: "Voice", stateSpace: { name: "Acoustic pressure", shape: "scalar wave field p(x, y, t)", coordinates: { chosen: true, name: "grid cells and steps" } },
      operations: [{ id: "sound", name: "Drive a wave and let it travel", element: "a speaker in a medium" }],
      fabrication: { route: "The wave step of the sound core (rooms/solvers/sound)", limits: ["Second-order finite differences, CFL 0.5", "Sound speed is one value everywhere", "The light coupling is exaggerated"] } },
    core: { package: "rooms sound", file: "packages/rooms/solvers/sound/fdtd.js", exports: ["WaveField"] },
    reads: [], gives: ["pressure"],
    limits: ["The pressure bends light where the lens is carried and where it is not alike: sound changes the medium itself"],
  }),
  map: rec({
    record: { id: "map", name: "Territory", stateSpace: { name: "Where a point is against where it is seen", shape: "a displacement field", coordinates: { chosen: true, name: "a graticule laid on the scene", note: "The grid is a lens for reading positions; the field's structure is continuous under it." } },
      operations: [{ id: "graticule", name: "Draw the scene's coordinates as the light carries them", element: "a reference grid seen through the medium" }],
      fabrication: { route: "A printed grid behind a tank, photographed", limits: ["Thin-sheet displacement: the bend a ray takes crossing the scene, not a full trace per point"] } },
    core: { package: "rooms maps", file: "packages/rooms/maps/map.js", exports: ["statusFrom", "WORDS"] },
    reads: ["n2"], gives: ["displacement"],
    limits: [`The map from object to image here has no held-out test yet, so its status is ${statusFrom({ held_out_pass: null })}`],
  }),
  circuit: rec({
    record: { id: "circuit", name: "Circuitry", stateSpace: { name: "A trace's characteristic impedance", shape: "Z0 at the probe", coordinates: { chosen: true, name: "ohms" } },
      operations: [{ id: "trace", name: "Lay a microstrip on the medium", element: "a copper trace over a dielectric" }],
      fabrication: { route: `The PCB core's two-layer stack: ${BOARD.mat}, er ${BOARD.er}, ${BOARD.h} mm dielectric`, limits: ["At optical frequencies a medium's permittivity is n^2; a board works at radio frequencies, where the same material differs. The reading shows a trace on a medium whose permittivity equals the field's n^2", "Hammerstad's quasi-static formula"] } },
    core: { package: "rooms pcb", file: "packages/rooms/solvers/pcb/formulas.js", exports: ["hammerstad"], also: [["packages/rooms/solvers/pcb/constants.js", "STACKS"]] },
    reads: ["n2"], gives: ["z0"],
    limits: ["Read at the probe; the copper is drawn under it"],
  }),
});
