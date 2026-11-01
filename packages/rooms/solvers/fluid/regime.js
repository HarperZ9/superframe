// SPDX-License-Identifier: FSL-1.1-MIT
// Regime gate: says when a run is outside what its solver can claim, from the run's own numbers. A pretty field with
// no validity label is the failure this exists to stop. Each rule comes from a failure met while building the room.
const row = (id, text) => ({ id, text });
/**
 * in: { dim, N, L, nu, dt, umax, spectrum, wall: {eta}, modelFlags: [] }. Returns { valid, outside: [...], model: [...] }.
 * `outside` lists numerics that make the numbers untrustworthy now. `model` lists physics the model leaves out for
 * this case, which stands whatever the numerics do.
 */
export function regimeGate({ dim = 2, N, L = 2 * Math.PI, nu = 0, dt, umax = 0, spectrum = null, wall = null, drive = false, model = [] }) {
  const outside = [], dx = L / N, kmax = (N / 3) * ((2 * Math.PI) / L);
  if (!Number.isFinite(umax)) outside.push(row("unstable", "The step went unstable."));
  const cfl = umax * dt * kmax;
  if (cfl > 1.7) outside.push(row("cfl", `Step too long for this speed: advective number ${cfl.toFixed(2)}, limit 1.73.`));
  if (spectrum) {
    let peak = 0, top = 0;
    const kc = Math.floor(N / 3);
    for (let k = 1; k < Math.min(spectrum.length, kc); k++) peak = Math.max(peak, spectrum[k]);
    for (let k = Math.max(1, kc - 3); k < Math.min(spectrum.length, kc); k++) top = Math.max(top, spectrum[k]);
    if (peak > 0 && top / peak > 1e-5) outside.push(row("resolution", `Under-resolved: the spectrum tail is ${(top / peak).toExponential(1)} of its peak at the cut-off. Small scales are grid, not flow.`));
  }
  if (nu === 0 && !drive && spectrum) model.push(row("inviscid", "Truncated Euler: no viscosity, so past the first small scales this is a statistical state of the truncation, not a fluid."));
  if (wall) {
    if (nu === 0) outside.push(row("inviscid-wall", "A wall with no viscosity has no boundary layer: the penalty only blocks the flow."));
    else if (Math.sqrt(nu * wall.eta) < dx) outside.push(row("wall-layer", `Soft wall thinner than a cell: sqrt(nu eta) ${Math.sqrt(nu * wall.eta).toFixed(4)} against ${dx.toFixed(4)}. It rings.`));
    const stiff = (nu * dt) / (dx * dx);
    if (stiff > 10) outside.push(row("stiff-wall", `Viscosity erases the penalty force within one step (nu dt / dx^2 = ${stiff.toFixed(0)}), so the fluid does not follow the wall. A locked study hit this: return read 1.0 because nothing moved.`));
  }
  return { valid: outside.length === 0, outside, model };
}
/** Model limits per case, shown beside the verdict because no numerical check can clear them. */
export const MODEL_LIMITS = {
  twoD: row("2d", "2D: no vortex stretching of vertical vorticity, and energy moves to large scales. A real flow at this Re may go 3D."),
  bowl: row("bowl", "Bowl: no free surface, air core, floor layer or gravity. The drain is prescribed."),
  grid3: row("grid3", "32 cubed: no inertial range, and vortex cores barely resolved."),
  wallLayer: row("layer", "Walls: a penalised flat plate on this torus misses Blasius, with a layer about half to a quarter as thick. Shear and drag at a wall are not validated."),
  dyeBlur: row("dye", "Dye here is a display transport with numerical blur. Striations thinner than its grid are not real."),
};
