// settlement-sim.mjs: Deterministic Coastal Civilization, Settlement, Resource Conservation,
// and Fail-Closed Replay Verification Engine for Low Water (Wave 37B).
// Pure zero-dependency ESM; matches coastal_kernel.bld FNV-1a 64-bit state hash bit-for-bit.
import { createHash } from "node:crypto";
import { ERAS, clamp, computeTideState, createCoastalGrid, q6, refreshParcelHydraulics } from "./tide-parcels.mjs";

export const RECEIPT_SCHEMA = "low-water.coastal-civ-replay/1";

export const BUILDINGS = Object.freeze({
  dock: { kind: "dock", timber: 22, stone: 8, allowsWetPiling: true, foodProd: 9, timberProd: 0, stoneProd: 0, waterCap: 0, foodCap: 0, cohesion: 0.015 },
  breakwater: { kind: "breakwater", timber: 8, stone: 30, allowsWetPiling: true, foodProd: 0, timberProd: 0, stoneProd: 0, waterCap: 0, foodCap: 0, cohesion: 0.01 },
  kiln: { kind: "kiln", timber: 16, stone: 18, allowsWetPiling: false, foodProd: 0, timberProd: -3, stoneProd: 7, waterCap: 0, foodCap: 0, cohesion: 0.01 },
  timber_mill: { kind: "timber_mill", timber: 14, stone: 6, allowsWetPiling: false, foodProd: 0, timberProd: 10, stoneProd: 0, waterCap: 0, foodCap: 0, cohesion: 0.005 },
  watchtower: { kind: "watchtower", timber: 15, stone: 20, allowsWetPiling: false, foodProd: 0, timberProd: 0, stoneProd: 0, waterCap: 0, foodCap: 0, cohesion: 0.04 },
  cistern: { kind: "cistern", timber: 10, stone: 18, allowsWetPiling: false, foodProd: 0, timberProd: 0, stoneProd: 0, waterCap: 24, foodCap: 0, cohesion: 0.015 },
  granary: { kind: "granary", timber: 18, stone: 12, allowsWetPiling: false, foodProd: 0, timberProd: 0, stoneProd: 0, waterCap: 0, foodCap: 80, cohesion: 0.02 },
});

const INITIAL_STOCKS = Object.freeze({ timber: 120, stone: 110, food: 90, freshwater: 70 });

// Canonical 64-bit FNV-1a over quantized integers (matches coastal_kernel.bld)
export function fnv1a64Ints(values) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < values.length; i++) {
    let v = BigInt.asUintN(64, BigInt(Math.round(values[i])));
    for (let b = 0; b < 8; b++) {
      h ^= (v >> BigInt(b * 8)) & 0xffn;
      h = (h * prime) & mask;
    }
  }
  return h.toString(16).padStart(16, "0");
}

function canonicalJson(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",") + "}";
}

export const sha256Canonical = (obj) => "sha256:" + createHash("sha256").update(canonicalJson(obj)).digest("hex");

export function createCoastalCivSim({ seed = 20261118, width = 8, height = 6, regionId = 4, initialStocks = {} } = {}) {
  const grid = createCoastalGrid(seed, width, height, regionId);
  const stocks = {
    timber: q6(initialStocks.timber ?? INITIAL_STOCKS.timber),
    stone: q6(initialStocks.stone ?? INITIAL_STOCKS.stone),
    food: q6(initialStocks.food ?? INITIAL_STOCKS.food),
    freshwater: q6(initialStocks.freshwater ?? INITIAL_STOCKS.freshwater),
  };
  const ledger = {
    timber: { initial: stocks.timber, produced: 0, spent: 0, spoiled: 0 },
    stone: { initial: stocks.stone, produced: 0, spent: 0, spoiled: 0 },
    food: { initial: stocks.food, produced: 0, spent: 0, spoiled: 0 },
    freshwater: { initial: stocks.freshwater, produced: 0, spent: 0, spoiled: 0 },
  };
  const state = {
    seed,
    tick: 0,
    era: 0,
    day: 0,
    clockHours: 6,
    population: 28,
    cohesion: 0.72,
    siltation: 0,
    stocks,
    ledger,
    tide: computeTideState(seed, 0, 0, 6, regionId),
    grid,
    commandLog: [],
    rejectedLog: [],
  };

  function parcelAt(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null;
    return grid.parcels[y * grid.width + x];
  }

  function applyCommand(cmd) {
    if (!cmd || typeof cmd !== "object") return { ok: false, error: "ERR_INVALID_COMMAND" };
    const reject = (error) => { state.rejectedLog.push({ tick: state.tick, cmd, error }); return { ok: false, error }; };
    if (cmd.type === "advance_era") {
      const next = Number(cmd.era);
      if (!Number.isInteger(next) || next < state.era || next >= ERAS.length) return reject("ERR_INVALID_ERA");
      state.era = next;
      state.tide = computeTideState(seed, state.era, state.day, state.clockHours, regionId);
      refreshParcelHydraulics(grid, state.tide);
      state.commandLog.push({ tick: state.tick, type: "advance_era", era: next });
      return { ok: true, era: next };
    }
    if (cmd.type === "build") {
      const spec = BUILDINGS[cmd.kind];
      if (!spec) return reject("ERR_UNKNOWN_BUILDING");
      const p = parcelAt(cmd.x, cmd.y);
      if (!p) return reject("ERR_OUT_OF_BOUNDS");
      if (p.building) return reject("ERR_PARCEL_OCCUPIED");
      if (p.elevation < state.tide.tideLevelM && !spec.allowsWetPiling) return reject("ERR_FLOODED_NO_PILING");
      if (stocks.timber < spec.timber || stocks.stone < spec.stone) return reject("ERR_INSUFFICIENT_RESOURCES");
      stocks.timber = q6(stocks.timber - spec.timber);
      stocks.stone = q6(stocks.stone - spec.stone);
      ledger.timber.spent = q6(ledger.timber.spent + spec.timber);
      ledger.stone.spent = q6(ledger.stone.spent + spec.stone);
      p.building = { kind: spec.kind, builtTick: state.tick, builtEra: state.era, health: 1.0 };
      refreshParcelHydraulics(grid, state.tide);
      state.commandLog.push({ tick: state.tick, type: "build", kind: spec.kind, x: cmd.x, y: cmd.y });
      return { ok: true, parcel: { x: p.x, y: p.y, kind: spec.kind } };
    }
    return reject("ERR_UNKNOWN_COMMAND");
  }

  function stepTick(hoursPerTick = 6) {
    state.tick += 1;
    const totalHours = state.day * 24 + state.clockHours + hoursPerTick;
    state.day = Math.floor(totalHours / 24);
    state.clockHours = q6(totalHours - state.day * 24);
    const eraObj = ERAS[state.era];
    state.tide = computeTideState(seed, state.era, state.day, state.clockHours, regionId);
    const { totalRunoff } = refreshParcelHydraulics(grid, state.tide);
    state.siltation = q6(clamp(state.siltation + totalRunoff * 0.35 - 0.004, 0, 1));

    let prodTimber = 0, prodStone = 0, prodFood = 0, prodWater = 0;
    let watchtowers = 0, granaryCap = 0, cisternCap = 0, cohesionBoost = 0;

    for (const p of grid.parcels) {
      if (p.elevation > 1.0 && p.building?.kind !== "timber_mill") {
        p.forestCover = q6(clamp(p.forestCover + eraObj.timberRegrowth * (1 - p.salinity * 0.5), 0, 1));
      }
      if (!p.building) continue;
      const b = p.building, spec = BUILDINGS[b.kind];
      // Storm and tidal damage reduced by breakwater shelter and watchtower warning
      const floodHit = p.tidalFloodRisk > 0.65 ? (p.tidalFloodRisk - 0.65) * 0.09 * (1 - p.shelter) : 0;
      b.health = q6(clamp(b.health - floodHit, 0.1, 1.0));
      const eff = b.health * (1 - state.siltation * 0.15);

      if (b.kind === "dock") prodFood += spec.foodProd * eff * (1 - p.tidalFloodRisk * 0.35);
      if (b.kind === "kiln" && stocks.timber + prodTimber >= 3) {
        const fuel = 3;
        stocks.timber = q6(stocks.timber - fuel);
        ledger.timber.spent = q6(ledger.timber.spent + fuel);
        prodStone += spec.stoneProd * eff;
      }
      if (b.kind === "timber_mill") {
        const harvest = Math.min(p.forestCover, 0.18);
        p.forestCover = q6(clamp(p.forestCover - harvest, 0, 1));
        prodTimber += (2.5 + harvest * 45) * eff;
      }
      if (b.kind === "watchtower") watchtowers += 1;
      if (b.kind === "cistern") {
        cisternCap += spec.waterCap;
        prodWater += (1.2 + state.tide.rain * 14.0) * eff;
      }
      if (b.kind === "granary") granaryCap += spec.foodCap;
      cohesionBoost += spec.cohesion * eff;
    }

    // Natural baseline foraging + spring water so an early anchorage can survive
    prodFood = q6(prodFood + 3.2);
    prodWater = q6(prodWater + 2.8 + state.tide.rain * 4.0);
    prodTimber = q6(prodTimber);
    prodStone = q6(prodStone);

    const applyDelta = (key, prod, demand, spoilRate, cap) => {
      const produced = q6(prod);
      let avail = q6(stocks[key] + produced);
      const consumed = q6(Math.min(avail, demand));
      avail = q6(avail - consumed);
      const excess = cap > 0 ? Math.max(0, avail - cap) : avail;
      const spoiled = q6(excess * spoilRate);
      stocks[key] = q6(Math.max(0, avail - spoiled));
      ledger[key].produced = q6(ledger[key].produced + produced);
      ledger[key].spent = q6(ledger[key].spent + consumed);
      ledger[key].spoiled = q6(ledger[key].spoiled + spoiled);
      return { consumed, unmet: q6(Math.max(0, demand - consumed)) };
    };

    const foodDemand = q6(state.population * 0.16);
    const waterDemand = q6(state.population * 0.14);
    applyDelta("timber", prodTimber, 0, 0, 0);
    applyDelta("stone", prodStone, 0, 0, 0);
    const fRes = applyDelta("food", prodFood, foodDemand, granaryCap > 0 ? 0.01 : 0.08, granaryCap);
    const wRes = applyDelta("freshwater", prodWater, waterDemand, cisternCap > 0 ? 0.01 : 0.06, cisternCap);

    const warnBonus = Math.min(0.06, watchtowers * 0.025);
    const deficit = fRes.unmet > 0 || wRes.unmet > 0;
    state.cohesion = q6(clamp(state.cohesion + cohesionBoost + warnBonus - eraObj.civicPressure * 0.25 - (deficit ? 0.04 : 0), 0.1, 1));
    if (!deficit && stocks.food > 35 && state.cohesion > 0.65 && state.tick % 4 === 0) state.population += 1;
    else if (deficit && state.population > 6) state.population -= 1;

    return state.tick;
  }

  function kernelDigestInts() {
    const ints = [
      state.seed, state.tick, state.era, state.population,
      Math.round(state.stocks.timber * 1000), Math.round(state.stocks.stone * 1000),
      Math.round(state.stocks.food * 1000), Math.round(state.stocks.freshwater * 1000),
      Math.round(state.siltation * 10000), Math.round(state.cohesion * 10000),
    ];
    for (const p of grid.parcels) {
      ints.push(Math.round(p.tidalFloodRisk * 10000), Math.round(p.erosion * 10000), Math.round(p.shelter * 10000));
    }
    return ints;
  }

  function verifyConservation() {
    const errors = [];
    for (const key of ["timber", "stone", "food", "freshwater"]) {
      const v = stocks[key], L = ledger[key];
      if (!Number.isFinite(v) || v < 0) errors.push(`NEGATIVE_OR_NAN:${key}`);
      const expected = q6(L.initial + L.produced - L.spent - L.spoiled);
      if (Math.abs(v - expected) > 1e-3) errors.push(`CONSERVATION_DRIFT:${key}:${v}:${expected}`);
    }
    return { ok: errors.length === 0, errors };
  }

  function exportWorldStateReceipt() {
    const summary = {
      schema: RECEIPT_SCHEMA,
      seed: state.seed,
      tick: state.tick,
      era: state.era,
      population: state.population,
      cohesion: state.cohesion,
      siltation: state.siltation,
      stocks: { ...stocks },
      buildings: grid.parcels.filter((p) => p.building).map((p) => ({ x: p.x, y: p.y, ...p.building })),
      commandCount: state.commandLog.length,
    };
    return Object.freeze({
      ...summary,
      fnv1a64: fnv1a64Ints(kernelDigestInts()),
      commandLogSha256: sha256Canonical(state.commandLog),
      stateSha256: sha256Canonical(summary),
    });
  }

  return { state, applyCommand, stepTick, verifyConservation, exportWorldStateReceipt };
}

export function replayCommands(seed, commands, opts = {}) {
  const sim = createCoastalCivSim({ seed, ...opts });
  const results = [];
  for (const step of commands) {
    if (step.type === "tick") {
      const n = Math.max(1, step.count | 0);
      for (let i = 0; i < n; i++) sim.stepTick(step.hoursPerTick ?? 6);
      results.push({ ok: true, tick: sim.state.tick });
    } else {
      results.push(sim.applyCommand(step));
    }
  }
  return { sim, results, receipt: sim.exportWorldStateReceipt(), conservation: sim.verifyConservation() };
}

export function verifyReplayReceipt(receipt, seed, commands, opts = {}) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA) return { ok: false, errors: ["INVALID_SCHEMA"] };
  const fresh = replayCommands(seed, commands, opts);
  if (!fresh.conservation.ok) errors.push(...fresh.conservation.errors);
  if (receipt.commandLogSha256 !== fresh.receipt.commandLogSha256) errors.push("COMMAND_LOG_HASH_MISMATCH");
  if (receipt.stateSha256 !== fresh.receipt.stateSha256) errors.push("TAMPERED_REPLAY_RECEIPT");
  if (receipt.fnv1a64 !== fresh.receipt.fnv1a64) errors.push("FNV1A_MISMATCH");
  return { ok: errors.length === 0, errors: [...new Set(errors)].sort(), freshReceipt: fresh.receipt };
}
