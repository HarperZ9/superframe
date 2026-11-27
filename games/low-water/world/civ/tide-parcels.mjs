// tide-parcels.mjs: Deterministic 5-era coastal parcel grid and tide/weather coupling
// for Low Water's Coastal Civilization & Settlement Simulation Layer (Wave 37B).
// Pure zero-dependency ESM coupled directly with games/low-water/world/weather.mjs.
import { moon, regionState } from "../weather.mjs";

export const ERAS = Object.freeze([
  { id: 0, name: "Founding Anchorage", tideOffsetM: 0.0, surgeScale: 1.0, timberRegrowth: 0.012, civicPressure: 0.02 },
  { id: 1, name: "Timber and Kiln Boom", tideOffsetM: 0.35, surgeScale: 1.15, timberRegrowth: 0.010, civicPressure: 0.04 },
  { id: 2, name: "Storm-Coast Consolidation", tideOffsetM: 0.85, surgeScale: 1.40, timberRegrowth: 0.008, civicPressure: 0.06 },
  { id: 3, name: "Drowned Quarter Surge", tideOffsetM: 1.55, surgeScale: 1.75, timberRegrowth: 0.006, civicPressure: 0.09 },
  { id: 4, name: "High-Water Reckoning", tideOffsetM: 2.30, surgeScale: 2.10, timberRegrowth: 0.004, civicPressure: 0.12 },
]);

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const q6 = (x) => Math.round(x * 1e6) / 1e6;

// Deterministic hash in [0, 1) matching weather.mjs bit-mixing
export function detHash(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// Compute physical tide height (metres), storm surge, rain, and wind from weather.mjs + era
export function computeTideState(seed, eraIndex, day, clockHours, regionId = 4) {
  const era = ERAS[Math.max(0, Math.min(ERAS.length - 1, eraIndex | 0))];
  const wx = regionState(seed, regionId, day, clockHours);
  const mn = moon(day, clockHours);
  // Semidiurnal tidal oscillation (12.42 h period) amplified at spring tides (new/full moon)
  const springFactor = 0.72 + 0.56 * Math.abs(mn.lit * 2 - 1);
  const astroTideM = 1.15 * springFactor * Math.sin(((day * 24 + clockHours) / 12.42) * Math.PI * 2);
  const stormSurgeM = (0.35 + wx.wind * 1.1 + wx.storm * 0.85 + wx.rain * 0.35) * era.surgeScale;
  const tideLevelM = q6(era.tideOffsetM + astroTideM);
  const waterLevelM = q6(tideLevelM + stormSurgeM);
  return {
    era: era.id,
    eraName: era.name,
    day,
    clockHours,
    regionId,
    moonLit: q6(mn.lit),
    tideLevelM,
    stormSurgeM: q6(stormSurgeM),
    waterLevelM,
    wind: q6(wx.wind),
    rain: q6(wx.rain),
    storm: q6(wx.storm),
    fog: q6(wx.fog),
  };
}

// Build deterministic coastal parcel grid (x=0 is seaward shore, x=width-1 is inland bluff)
export function createCoastalGrid(seed, width = 8, height = 6, regionId = 4) {
  if (!(width >= 4 && height >= 4 && width <= 64 && height <= 64)) {
    throw new RangeError("coastal-grid: width and height must be in [4, 64]");
  }
  const parcels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const coastFrac = x / Math.max(1, width - 1);
      const jitter = (detHash(seed, x * 31 + 7, y * 17 + 13) - 0.5) * 0.9;
      // Shore parcels sit near low-water tidal datum (-0.4..1.4m); inland rises smoothly to ~7.5m
      const elevation = q6(-0.35 + coastFrac * coastFrac * 6.8 + coastFrac * 1.4 + jitter);
      const porosity = q6(clamp(0.22 + (1 - coastFrac) * 0.48 + detHash(seed, x + 97, y + 53) * 0.24));
      const salinity = q6(clamp((1 - coastFrac) * 0.82 + (elevation < 1.2 ? 0.14 : 0)));
      const forestCover = q6(elevation > 1.0 ? clamp(0.32 + coastFrac * 0.55 + detHash(seed, x + 211, y + 37) * 0.18) : 0);
      const windExposure = q6(clamp(0.88 - coastFrac * 0.34 + (elevation > 4.5 ? 0.18 : 0)));
      parcels.push({
        x, y, idx: y * width + x,
        elevation,
        salinity,
        porosity,
        forestCover,
        tidalFloodRisk: 0,
        windExposure,
        erosion: 0,
        shelter: 0,
        building: null,
      });
    }
  }
  const grid = { seed, width, height, regionId, parcels };
  refreshParcelHydraulics(grid, computeTideState(seed, 0, 0, 6, regionId));
  return grid;
}

// Compute breakwater shelter field, flood risk, and salinity/erosion pressure across all parcels
export function refreshParcelHydraulics(grid, tideState) {
  const { width, height, parcels } = grid;
  const shelter = new Float64Array(parcels.length);

  // Breakwaters protect leeward inland parcels (same or greater x within 2 cells, |dy| <= 1)
  for (const p of parcels) {
    if (p.building?.kind !== "breakwater" || p.building.health <= 0.15) continue;
    const eff = clamp(p.building.health, 0.2, 1.0);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const distDecay = dx === 0 && dy === 0 ? 0.55 : dx <= 1 ? 0.55 - Math.abs(dy) * 0.12 : 0.32 - Math.abs(dy) * 0.08;
        const k = ny * width + nx;
        shelter[k] = clamp(shelter[k] + distDecay * eff, 0, 0.78);
      }
    }
  }

  let totalRunoff = 0;
  for (const p of parcels) {
    p.shelter = q6(shelter[p.idx]);
    const effSurge = tideState.stormSurgeM * (1 - p.shelter);
    const localWater = tideState.tideLevelM + effSurge;
    const freeboard = p.elevation - localWater;
    p.tidalFloodRisk = q6(clamp((1.4 - freeboard) / 2.6, 0, 1));

    // Deforested low-porosity inland slopes shed silt-laden runoff during rain
    const bareSlope = clamp(1 - p.forestCover, 0, 1) * clamp(1 - p.porosity * 0.65, 0.2, 1);
    const runoff = tideState.rain * bareSlope * (p.elevation > 0.6 ? 0.035 : 0.01);
    totalRunoff += runoff;

    // Salinity rises under tidal overtopping and flushes gently with rain & porosity
    const overtop = freeboard < 0 ? clamp(-freeboard * 0.12, 0, 0.25) : 0;
    const flush = tideState.rain * p.porosity * 0.05;
    p.salinity = q6(clamp(p.salinity + overtop * (1 - p.shelter) - flush, 0, 1));

    // Cumulative coastal erosion rises under unshielded surge + bare-ground runoff
    const surgeWear = p.tidalFloodRisk * (0.018 + tideState.wind * 0.014) * (1 - p.shelter);
    p.erosion = q6(clamp(p.erosion + surgeWear + runoff * 0.6, 0, 1));
  }
  return { totalRunoff: q6(totalRunoff) };
}
