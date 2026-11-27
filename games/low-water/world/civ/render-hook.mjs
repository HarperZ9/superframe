// render-hook.mjs: Integration bridge exporting Low Water Coastal Civilization state
// into both the Low Water 3D walk/renderer footprints and the /playground/ Unified Studio
// patchbay frame + palette contract (Wave 37B).
import { ERAS, clamp, q6 } from "./tide-parcels.mjs";
import { sha256Canonical } from "./settlement-sim.mjs";

const ERA_PALETTES = Object.freeze([
  { hex: ["#132a3a", "#2b5f73", "#d79e35", "#ece5d6"], oklab: [[0.26, -0.04, -0.05], [0.46, -0.06, -0.05], [0.74, 0.04, 0.13], [0.92, 0.0, 0.02]] },
  { hex: ["#1a2b34", "#48685c", "#cf8834", "#e8dfd0"], oklab: [[0.28, -0.03, -0.03], [0.49, -0.05, 0.02], [0.68, 0.07, 0.13], [0.90, 0.01, 0.02]] },
  { hex: ["#16222c", "#3a5368", "#be6e36", "#dcd7ce"], oklab: [[0.24, -0.02, -0.04], [0.43, -0.03, -0.06], [0.60, 0.09, 0.10], [0.87, 0.0, 0.01]] },
  { hex: ["#111c26", "#2c465c", "#a55638", "#c8ccd0"], oklab: [[0.21, -0.02, -0.04], [0.38, -0.03, -0.06], [0.53, 0.10, 0.07], [0.83, -0.01, -0.01]] },
  { hex: ["#0c141d", "#243b4e", "#944634", "#bcc4cc"], oklab: [[0.17, -0.02, -0.04], [0.34, -0.03, -0.06], [0.47, 0.10, 0.06], [0.80, -0.01, -0.02]] },
]);

const STRUCTURE_HEIGHT_M = Object.freeze({
  dock: 2.6,
  breakwater: 3.4,
  kiln: 6.2,
  timber_mill: 5.4,
  watchtower: 13.5,
  cistern: 3.8,
  granary: 7.0,
});

// Export deterministic world footprints, floodline contour, and /playground/ patchbay frame
export function extractSettlementRenderState(simState, { cellM = 32, originX = 0, originZ = 0 } = {}) {
  const { grid, tide, era } = simState;
  const footprints = [];
  const floodlineContour = [];

  for (let y = 0; y < grid.height; y++) {
    // Locate exact interpolated floodline x-coordinate along each coastal row
    let floodX = 0;
    for (let x = 0; x < grid.width; x++) {
      const p = grid.parcels[y * grid.width + x];
      if (p.elevation >= tide.waterLevelM) {
        if (x > 0) {
          const prev = grid.parcels[y * grid.width + (x - 1)];
          const denom = Math.max(1e-6, p.elevation - prev.elevation);
          const frac = clamp((tide.waterLevelM - prev.elevation) / denom, 0, 1);
          floodX = (x - 1 + frac) * cellM;
        } else {
          floodX = 0;
        }
        break;
      }
      floodX = (grid.width - 1) * cellM;
    }
    floodlineContour.push({
      row: y,
      wx: q6(originX + floodX),
      wz: q6(originZ + (y + 0.5) * cellM),
      waterLevelM: tide.waterLevelM,
    });
  }

  for (const p of grid.parcels) {
    if (!p.building) continue;
    const b = p.building;
    footprints.push({
      id: `${b.kind}_${p.x}_${p.y}`,
      kind: b.kind,
      gx: p.x,
      gy: p.y,
      wx: q6(originX + (p.x + 0.5) * cellM),
      wz: q6(originZ + (p.y + 0.5) * cellM),
      elevationM: p.elevation,
      heightM: STRUCTURE_HEIGHT_M[b.kind] || 4.0,
      health: b.health,
      sheltered: p.shelter > 0.25,
      flooded: p.elevation < tide.waterLevelM,
      builtEra: b.builtEra,
    });
  }

  // Build /playground/ patchbay-compatible 8x4 frame + OKLab palette
  const pw = 8, ph = 4, lumaGrid = [];
  for (let ry = 0; ry < ph; ry++) {
    const gy = Math.min(grid.height - 1, Math.floor((ry / ph) * grid.height));
    for (let rx = 0; rx < pw; rx++) {
      const gx = Math.min(grid.width - 1, Math.floor((rx / pw) * grid.width));
      const p = grid.parcels[gy * grid.width + gx];
      const base = clamp((p.elevation + 1) / 9, 0.08, 0.85);
      const lift = p.building ? 0.16 : 0;
      const floodDim = p.tidalFloodRisk * 0.25;
      lumaGrid.push(Math.round(clamp(base + lift - floodDim, 0, 1) * 255));
    }
  }
  const eraPal = ERA_PALETTES[Math.max(0, Math.min(ERA_PALETTES.length - 1, era))];
  const playgroundFrame = {
    width: pw,
    height: ph,
    lumaGrid,
    pixelsSha256: sha256Canonical({ width: pw, height: ph, lumaGrid, source: "low-water-civ", era, tick: simState.tick }),
    transfer: "srgb-u8",
    source: "low-water-civ",
    eraName: ERAS[era]?.name || "Founding Anchorage",
    waterLevelM: tide.waterLevelM,
    structureCount: footprints.length,
  };
  const playgroundPalette = {
    oklab: eraPal.oklab,
    hex: eraPal.hex,
    mix: eraPal.hex[1],
    ground: eraPal.hex[0],
  };

  return {
    era,
    eraName: ERAS[era]?.name || "Founding Anchorage",
    tick: simState.tick,
    waterLevelM: tide.waterLevelM,
    footprints,
    floodlineContour,
    playgroundFrame,
    playgroundPalette,
  };
}
