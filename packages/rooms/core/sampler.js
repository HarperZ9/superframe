// SPDX-License-Identifier: FSL-1.1-MIT
// The shaders' random number: st=st*747796405u+2891336453u; w=((st>>((st>>28u)+4u))^st)*277803737u;
// float((w>>22u)^w)/2^32. This is the same integer maths on the CPU, so a CPU reference can share a stream.
export function pcgStep(state) {
  const st = (Math.imul(state, 747796405) + 2891336453) >>> 0;
  const w = Math.imul(((st >>> ((st >>> 28) + 4)) ^ st) >>> 0, 277803737) >>> 0;
  return { state: st, value: (((w >>> 22) ^ w) >>> 0) / 4294967296 };
}
export class Pcg {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }
  next() {
    const r = pcgStep(this.state);
    this.state = r.state;
    return r.value;
  }
}
