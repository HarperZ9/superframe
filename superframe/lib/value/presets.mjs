// presets.mjs: the shading presets. Each returns a scene for trace.render and the ceiling its tone curve uses.
//   whiteOnWhite: white glossy, white satin and clear glass spheres on white paper under one soft key in a light
//                 studio surround (the STUDY-MAP check scene).
//   darkField:    the same objects on grey stone, one small near source (a lantern) in a near-black surround, so the
//                 inverse-square falloff does the drawing.
//   flatControl:  the dark-field objects with no key, in a uniform surround giving the open ground the mean
//                 irradiance the key gave it (the control that must not read as a dark field).
import { diffuseCeiling, keyIrradiance } from './scene.mjs';
import { causticMap } from './caustic.mjs';

const OBJECTS = () => [
  { c: [-1.25, 0.62, -0.1], r: 0.62, mat: 'white', rho: 0.86, alpha: 0.06, ior: 1.5 },
  { c: [0.2, 0.6, 0.35], r: 0.6, mat: 'glass', ior: 1.5 },
  { c: [1.45, 0.46, -0.35], r: 0.46, mat: 'white', rho: 0.86, alpha: 0.3, ior: 1.5 },
  { c: [0.95, 0.24, 1.25], r: 0.24, mat: 'white', rho: 0.86, alpha: 0.12, ior: 1.5 },
];
const CAMERA = { eye: [0, 2.3, 6.6], at: [0.05, 0.42, 0], fov: 38 };

function finish(scene, { caustics = true, photons = 200000 } = {}) {
  scene.caustic = caustics ? causticMap(scene, { n: photons }) : null;
  scene.C = diffuseCeiling(scene);
  return scene;
}

export function whiteOnWhite(o = {}) {
  const r = o.lightR ?? 0.6, elev = (o.elev ?? 52) * Math.PI / 180, az = (o.az ?? -38) * Math.PI / 180, dist = 12;
  const scene = {
    name: 'white on white', ground: { rho: o.groundRho ?? 0.85 }, env: o.env ?? 0.22, shadowSamples: o.shadowSamples ?? 8,
    light: { p: [dist * Math.cos(elev) * Math.sin(az), dist * Math.sin(elev), dist * Math.cos(elev) * Math.cos(az)], r, Le: o.Le ?? 3 / (Math.PI * (r / dist) ** 2) },
    spheres: OBJECTS().map(s => (s.mat === 'white' && o.alpha !== undefined ? { ...s, alpha: o.alpha } : s)), camera: CAMERA,
  };
  return finish(scene, o);
}

export function darkField(o = {}) {
  const r = o.lightR ?? 0.07;
  const scene = {
    name: 'dark field', ground: { rho: o.groundRho ?? 0.3 }, env: o.env ?? 0.0015, shadowSamples: o.shadowSamples ?? 8, tint: o.tint ?? [1, 0.78, 0.52],
    light: { p: o.lightP ?? [-0.35, 1.75, 1.05], r, Le: o.Le ?? 1.1 / (Math.PI * r * r) },
    spheres: OBJECTS().map(s => ({ ...s, rho: s.rho ? 0.6 : undefined })), camera: CAMERA,
  };
  return finish(scene, o);
}

// equal mean irradiance: the uniform surround gives open ground the mean irradiance the key gave the ground within
// 3 units of the origin (a 61 x 61 grid, unshadowed)
export function flatControl(o = {}) {
  const dark = darkField({ ...o, caustics: false }); let E = 0;
  for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) E += keyIrradiance(dark, [-3 + i / 10, 0, -3 + j / 10], [0, 1, 0]) / 3721;
  const scene = { ...dark, name: 'flat control', light: { ...dark.light, Le: 0 }, env: E / Math.PI + dark.env };
  return finish(scene, { ...o, caustics: false });
}
