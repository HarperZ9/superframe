// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
// Clean-room Low Water engine bridge for Wave 13B:
//   1. Tree & foliage biomechanics (Vogel drag, snow/rain sag, wet-leaf white-furnace PBR)
//   2. Physical BT.2020/Draine-HG DS-08 dark-mist & Snell/Fresnel water caustic optics
//   3. NOH-3 Buckingham-Pi normalizer, Caustic sparse tick scheduler, and CODIT fault guard.

const GRAVITY = 9.80665;
const WATER_F0 = ((1.333 - 1.0) / (1.333 + 1.0)) ** 2;
const BT2020_LUMA = [0.2627, 0.6780, 0.0593];

export function bt2020Luminance(rgb) {
  return BT2020_LUMA[0] * rgb[0] + BT2020_LUMA[1] * rgb[1] + BT2020_LUMA[2] * rgb[2];
}

export function wetLeafPbr(baseRoughness, baseAlbedo, wetness, snowCover = 0, cosTheta = 0.7) {
  const w = Math.max(0, Math.min(1, wetness));
  const s = Math.max(0, Math.min(1, snowCover));
  const mu = Math.max(0, Math.min(1, cosTheta));
  const r0 = Math.max(0.04, Math.min(1, baseRoughness));
  const roughWet = r0 * (1 - 0.78 * w) + 0.08 * (0.78 * w);
  const roughness = roughWet * (1 - s) + 0.88 * s;
  const f0 = (0.04 * (1 - w) + WATER_F0 * w) * (1 - s) + 0.025 * s;
  const fresnel = f0 + (1 - f0) * ((1 - mu) ** 5);
  const darken = 1 - 0.38 * w;
  const snowRgb = [0.86, 0.89, 0.93];
  const albedo = baseAlbedo.map((c, i) => Math.max(0, Math.min(1 - fresnel, c * darken * (1 - s) + snowRgb[i] * s)));
  return { roughness, fresnel, albedo, whiteFurnaceOk: Math.max(...albedo) + fresnel <= 1 + 1e-9 };
}

export function verifyWhiteFurnace(albedo, fresnel) {
  if (!Number.isFinite(fresnel) || fresnel < 0 || fresnel > 1) return false;
  return albedo.every((c) => Number.isFinite(c) && c >= 0 && c + fresnel <= 1 + 1e-9);
}

export function stepTreeBiomechanics(state, weather, dt = 0.02) {
  const windSpeed = (weather.wind || 0) * 18.0;
  const snowKg = (weather.snow || 0) * 20.0;
  const rainMmH = (weather.rain || 0) * 25.0;
  const k = state.stiffness || 280.0;
  const mBase = state.mass || 26.0;
  const precipKg = (snowKg + 0.04 * rainMmH) * (state.area || 8.0) * 0.35;
  const mEff = mBase + precipKg;
  const zeta = state.zeta ?? 0.075;
  const c = 2 * zeta * Math.sqrt(k * mEff);

  const vRel = windSpeed - state.vel;
  const absRel = Math.abs(vRel);
  const aEff = (state.area || 8.0) * ((1 + absRel / 6.0) ** -(state.vogelGamma ?? 0.36));
  const fAero = 0.5 * 1.225 * 0.55 * aEff * absRel * vRel;
  const prestress = state.prestress ?? 45.0;
  const fPrestress = -prestress * Math.tanh(state.disp / 1.8);
  const force = -k * state.disp - c * state.vel + fAero + fPrestress;

  const vel = state.vel + (force / mEff) * dt;
  const disp = state.disp + vel * dt;
  const sagZ = (precipKg * GRAVITY) / Math.max(k, 1e-6);
  const uPrestress = prestress * 1.8 * Math.log(Math.cosh(disp / 1.8));
  const energy = 0.5 * mEff * vel * vel + 0.5 * k * disp * disp + uPrestress;
  const leaf = wetLeafPbr(0.65, [0.16, 0.31, 0.14], weather.rain || 0, weather.snow || 0, 0.72);
  return { ...state, disp, vel, sagZ, energy, omegaEff: Math.sqrt(k / mEff), leaf };
}

function draineHgPhase(cosT, gFwd = 0.78, gBack = -0.25, alpha = 1.6, mixFwd = 0.85) {
  const mu = Math.max(-1, Math.min(1, cosT));
  const dFwd = Math.max(1e-12, 1 + gFwd * gFwd - 2 * gFwd * mu);
  const norm = 1 + (alpha * (1 + 2 * gFwd * gFwd)) / 3;
  const pDraine = ((1 - gFwd * gFwd) / (4 * Math.PI * (dFwd ** 1.5))) * ((1 + alpha * mu * mu) / norm);
  const dBack = Math.max(1e-12, 1 + gBack * gBack - 2 * gBack * mu);
  const pBack = (1 - gBack * gBack) / (4 * Math.PI * (dBack ** 1.5));
  return mixFwd * pDraine + (1 - mixFwd) * pBack;
}

export function evalDarkMistAndCaustic(sceneRgb, distanceM, weather, sunRgb, cosTheta = 0.5, waterDepthM = 1.5) {
  const sigmaT = Math.max(0, (weather.fog || 0) * 0.005);
  const albedoScat = 0.85;
  const gloom = Math.max(0, Math.min(1, weather.gloom ?? 0.65));
  const tBeam = Math.exp(-sigmaT * Math.max(0, distanceM));
  const phase = draineHgPhase(cosTheta);
  const lumaScene = bt2020Luminance(sceneRgb);
  const lumaSun = bt2020Luminance(sunRgb);
  const shadowGate = (1 - gloom) + gloom * (lumaScene / (lumaScene + 0.08 + 0.25 * lumaSun));
  const gain = albedoScat * (1 - tBeam) * Math.min(1, phase * Math.PI) * shadowGate;
  const rgb = sceneRgb.map((c, i) => c * tBeam + sunRgb[i] * gain);

  // Snell + Fresnel water caustic transmission at 532 nm (n_w = 1.335)
  const cosI = Math.max(0.05, Math.min(1, Math.abs(cosTheta)));
  const eta = 1 / 1.335;
  const sin2T = eta * eta * Math.max(0, 1 - cosI * cosI);
  const cosT = Math.sqrt(Math.max(0, 1 - sin2T));
  const rs = ((cosI - 1.335 * cosT) / (cosI + 1.335 * cosT)) ** 2;
  const rp = ((cosT - 1.335 * cosI) / (cosT + 1.335 * cosI)) ** 2;
  const fresnelR = 0.5 * (rs + rp);
  const causticFlux = (1 - fresnelR) * Math.exp(-0.04 * (waterDepthM / Math.max(cosT, 0.15)));
  return { transmittance: tBeam, phase, shadowGate, rgb, lumaBt2020: bt2020Luminance(rgb), causticFlux };
}

export function createLivingWorldScheduler(actors, { surpriseThreshold = 0.025, maxPiNorm = 8.0 } = {}) {
  const state = actors.map((a, idx) => ({
    id: a.id ?? idx,
    lScale: Math.max(Math.abs(a.lScale || 1), 1e-6),
    vScale: Math.max(Math.abs(a.vScale || 1), 1e-6),
    x: a.x || 0,
    vx: a.vx || 0,
    init: false,
    quarantined: false,
  }));
  let executed = 0, held = 0, step = 0;
  const events = [];

  function tick(wind = 0, activeIds = new Set(), faults = {}, dt = 0.02) {
    step += 1;
    let execNow = 0;
    for (const a of state) {
      if (faults[a.id]) Object.assign(a, faults[a.id]);
      if (a.quarantined) continue;
      const piX = a.x / a.lScale;
      const piV = a.vx / a.vScale;
      if (!Number.isFinite(piX) || !Number.isFinite(piV) || Math.abs(piV) > maxPiNorm) {
        a.quarantined = true;
        a.vx = 0;
        events.push({ step, id: a.id, reason: !Number.isFinite(piV) ? "non_finite" : "pi_explosion" });
        continue;
      }
      const localWind = activeIds.has(a.id) ? wind : 0;
      const surprise = Math.abs(piV) + Math.abs(localWind) / a.vScale;
      if (!a.init || surprise >= surpriseThreshold) {
        a.init = true;
        executed += 1;
        execNow += 1;
        const piAcc = -2.0 * piX - 0.8 * piV + 0.15 * (localWind / a.vScale);
        const piDv = 1.5 * Math.tanh((piAcc * dt) / 1.5);
        const nextPiV = piV + piDv;
        a.vx = nextPiV * a.vScale;
        a.x += 1.5 * Math.tanh((nextPiV * dt) / 1.5) * a.lScale;
      } else {
        held += 1;
      }
    }
    const tot = executed + held;
    return { step, actorCount: state.length, executedNow: execNow, heldTickRatio: tot > 0 ? held / tot : 0, quarantined: events.length };
  }
  return { tick, actors: state, events };
}
