// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lights.mjs: every light in the three scenes as linear RGB radiance, derived from a spectrum (spd.mjs) and a material
// reflectance (lib/medium/spectral.mjs upsampling of a daylight colour). One variant switch: the street lamps are
// high-pressure sodium (the likely 1990s Seattle lamp) or a 2700 K filament (the memory). Radiance scales are
// relative and authored to keep a lamp lens a few hundred times its lit surroundings, which is the order of a real
// night street; they are not photometric values.
import { hps, planckSPD, moonSPD, lightRGB, litRGB } from './spd.mjs';
import { spectrumOf } from '../medium/spectral.mjs';

export const ADAPT = 0.3;   // the night eye adapts part of the way toward the lamp's colour (assumption)
export const STREET = { sodium: () => hps(), incandescent: () => planckSPD(2700) };
const sc = (v, k) => v.map(x => x * k);
const filt = (hex, spd, k) => sc(litRGB(spectrumOf(hex), spd, { adapt: ADAPT }), k);

export const MATERIALS = {
  cloud: '#a3a3a3', headliner: '#b9b2a4', vinyl: '#4b4846', fir: '#24402a', cedar: '#2c4a2c', maple: '#c9a43a',
  mapleUnder: '#b7b38a', asphalt: '#2b2b2b', snow: '#f2f4f6', wood: '#6b5038', siding: '#8e8f86', coat: '#3d4a5c',
  skin: '#c79a7c', fur: '#77706a', crow: '#141518', bark: '#4a3b30', moss: '#5a6b2e', fence: '#5b4a3a',
};

export function carLights(variant = 'sodium') {
  const spd = STREET[variant](), lamp = lightRGB(spd, { adapt: ADAPT }), inc = planckSPD(2800), fl = planckSPD(4000);
  return {
    variant, spd, lamp: sc(lamp, 2500), glow: lamp,
    night: [0.0014, 0.0012, 0.0011],   // the dark between clouds, warmed by the city below
    window: sc(lightRGB(inc, { adapt: ADAPT }), 30), tv: sc(lightRGB(planckSPD(9300), { adapt: ADAPT }), 22), office: sc(lightRGB(fl, { adapt: ADAPT }), 18),
    signal: [filt('#e8281e', inc, 600), filt('#f2a218', inc, 600), filt('#18c47a', inc, 600)],
    housing: [0.004, 0.004, 0.0045], nav: sc(lightRGB(planckSPD(3000), { adapt: ADAPT }), 25), towerDark: [0.006, 0.0055, 0.005],
    fir: density => sc(litRGB(spectrumOf(MATERIALS.fir), spd, { adapt: ADAPT }), 0.004 + 0.004 * density),
    headliner: E => sc(litRGB(spectrumOf(MATERIALS.headliner), spd, { adapt: ADAPT }), E),
    concrete: E => sc(litRGB(spectrumOf('#9c978d'), spd, { adapt: ADAPT }), 0.02 * E),
    vinyl: E => sc(litRGB(spectrumOf(MATERIALS.vinyl), spd, { adapt: ADAPT }), E),
  };
}

// palette inputs for the car scene: the same lights and materials, at the brightness steps the frames reach
export function carPaletteSpec(variant) {
  const spd = STREET[variant](), gains = [0.004, 0.01, 0.02, 0.04, 0.08, 0.16, 0.35, 0.7, 1.5, 4, 12];
  return {
    label: `car, ${variant}`, max: 44,
    lights: [{ spd, adapt: ADAPT, gains }],
    materials: [MATERIALS.cloud, MATERIALS.headliner, MATERIALS.vinyl, MATERIALS.fir, '#d8dde6'],
    emitters: [{ spd: planckSPD(9300), adapt: ADAPT, gains: [0.05, 0.4] }, { spd: planckSPD(4000), adapt: ADAPT, gains: [0.05, 0.3, 1.5] }, { spd: planckSPD(2800), adapt: ADAPT, gains: [0.05, 0.3, 1.5] },
      { spd: moonSPD(), adapt: ADAPT, gains: [0.002, 0.004] }],
    colors: carLights(variant).signal.map(rgb => ({ rgb, gains: [0.0004, 0.0015, 0.006, 0.03] })),
  };
}
