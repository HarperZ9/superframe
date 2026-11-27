// coastal-civ.test.mjs: Unit, physics, conservation, multi-era deterministic replay,
// planted-failure, render-hook, and BuildLang parity tests for Wave 37B Low Water civ layer.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ERAS, BUILDINGS, fnv1a64Ints, createCoastalCivSim, replayCommands,
  verifyReplayReceipt, extractSettlementRenderState,
} from "../civ/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CIV_DIR = path.resolve(HERE, "../civ");
const CIV_FILES = [
  "tide-parcels.mjs",
  "settlement-sim.mjs",
  "render-hook.mjs",
  "index.mjs",
  "coastal_kernel.bld",
];

function findBuildc() {
  const envBin = process.env.BUILDC;
  if (envBin) return envBin;
  const candidates = ["buildc", "buildc.exe"];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "pipe" });
      return bin;
    } catch {}
  }
  return null;
}

test("hygiene: all Wave 37B coastal-civ files stay <= 280 LOC, 0 em/en dashes, 0 forbidden names", () => {
  const forbidden = ["iso", "morph"].join("");
  for (const name of CIV_FILES) {
    const src = fs.readFileSync(path.join(CIV_DIR, name), "utf8");
    const lines = src.split(/\r?\n/).length;
    assert.ok(lines <= 280, `${name} has ${lines} lines (> 280)`);
    assert.equal(src.includes("\u2014"), false, `em dash in ${name}`);
    assert.equal(src.includes("\u2013"), false, `en dash in ${name}`);
    assert.equal(src.toLowerCase().includes(forbidden), false, `forbidden name in ${name}`);
  }
});

test("determinism: multi-era replay across all 5 eras is bit-identical by seed + command log", () => {
  const commands = [
    { type: "build", kind: "breakwater", x: 1, y: 2 },
    { type: "build", kind: "dock", x: 1, y: 3 },
    { type: "build", kind: "timber_mill", x: 5, y: 2 },
    { type: "build", kind: "cistern", x: 4, y: 3 },
    { type: "build", kind: "granary", x: 5, y: 3 },
    { type: "tick", count: 16 },
    { type: "advance_era", era: 1 },
    { type: "build", kind: "kiln", x: 4, y: 2 },
    { type: "build", kind: "watchtower", x: 6, y: 2 },
    { type: "tick", count: 16 },
    { type: "advance_era", era: 2 },
    { type: "tick", count: 16 },
    { type: "advance_era", era: 3 },
    { type: "tick", count: 16 },
    { type: "advance_era", era: 4 },
    { type: "tick", count: 16 },
  ];
  const a = replayCommands(20261118, commands, { regionId: 4 });
  const b = replayCommands(20261118, commands, { regionId: 4 });
  const c = replayCommands(20261119, commands, { regionId: 4 });

  assert.equal(a.conservation.ok, true, `conservation failed: ${a.conservation.errors.join(",")}`);
  assert.equal(a.receipt.era, ERAS.length - 1);
  assert.equal(a.receipt.tick, 80);
  assert.equal(a.receipt.stateSha256, b.receipt.stateSha256);
  assert.equal(a.receipt.fnv1a64, b.receipt.fnv1a64);
  assert.equal(a.receipt.commandLogSha256, b.receipt.commandLogSha256);
  assert.notEqual(a.receipt.stateSha256, c.receipt.stateSha256);
  assert.equal(verifyReplayReceipt(a.receipt, 20261118, commands, { regionId: 4 }).ok, true);
});

test("physics: breakwater reduces leeward flood risk and erosion vs unshielded shore", () => {
  const exposed = createCoastalCivSim({ seed: 7701, regionId: 4 });
  const shielded = createCoastalCivSim({ seed: 7701, regionId: 4 });
  assert.equal(shielded.applyCommand({ type: "build", kind: "breakwater", x: 2, y: 2 }).ok, true);

  for (let i = 0; i < 20; i++) {
    exposed.stepTick(6);
    shielded.stepTick(6);
  }
  const pExp = exposed.state.grid.parcels[2 * 8 + 3];
  const pShl = shielded.state.grid.parcels[2 * 8 + 3];
  assert.ok(pShl.shelter > 0.4, `expected leeward shelter > 0.4, got ${pShl.shelter}`);
  assert.ok(pShl.tidalFloodRisk < pExp.tidalFloodRisk, `breakwater must reduce leeward flood risk (${pShl.tidalFloodRisk} vs ${pExp.tidalFloodRisk})`);
  assert.ok(pShl.erosion < pExp.erosion, `breakwater must reduce leeward erosion (${pShl.erosion} vs ${pExp.erosion})`);
});

test("physics: timber_mill deforestation raises runoff/siltation, cistern harvests rain, granary cuts spoilage", () => {
  // 1. Deforestation -> higher siltation
  const intact = createCoastalCivSim({ seed: 8802, regionId: 4 });
  const logged = createCoastalCivSim({ seed: 8802, regionId: 4 });
  assert.equal(logged.applyCommand({ type: "build", kind: "timber_mill", x: 4, y: 2 }).ok, true);
  assert.equal(logged.applyCommand({ type: "build", kind: "timber_mill", x: 5, y: 2 }).ok, true);
  assert.equal(logged.applyCommand({ type: "build", kind: "timber_mill", x: 6, y: 2 }).ok, true);
  for (let i = 0; i < 16; i++) { intact.stepTick(6); logged.stepTick(6); }
  assert.ok(logged.state.siltation > intact.state.siltation, "heavy logging must increase coastal runoff siltation");
  assert.ok(logged.state.stocks.timber > intact.state.stocks.timber, "timber mills produce timber");

  // 2. Rainy storm coast (region 4) cistern harvests more freshwater than dry canyon (region 5)
  const wet = createCoastalCivSim({ seed: 8803, regionId: 4 });
  const dry = createCoastalCivSim({ seed: 8803, regionId: 5 });
  assert.equal(wet.applyCommand({ type: "build", kind: "cistern", x: 5, y: 2 }).ok, true);
  assert.equal(dry.applyCommand({ type: "build", kind: "cistern", x: 5, y: 2 }).ok, true);
  for (let i = 0; i < 16; i++) { wet.stepTick(6); dry.stepTick(6); }
  assert.ok(wet.state.ledger.freshwater.produced > dry.state.ledger.freshwater.produced, "cistern harvests more water in rainy region 4 than dry region 5");

  // 3. Granary reduces food spoilage
  const noGranary = createCoastalCivSim({ seed: 8804, regionId: 4, initialStocks: { food: 180 } });
  const withGranary = createCoastalCivSim({ seed: 8804, regionId: 4, initialStocks: { food: 180 } });
  assert.equal(withGranary.applyCommand({ type: "build", kind: "granary", x: 5, y: 2 }).ok, true);
  for (let i = 0; i < 12; i++) { noGranary.stepTick(6); withGranary.stepTick(6); }
  assert.ok(withGranary.state.ledger.food.spoiled < noGranary.state.ledger.food.spoiled, "granary must cut food spoilage");
});

test("planted-failure controls: out-of-bounds, insufficient stocks, flooded-without-piling, double-build, and tampered replay", () => {
  const sim = createCoastalCivSim({ seed: 9901, regionId: 4, initialStocks: { timber: 30, stone: 30 } });

  // 1. Out-of-bounds parcel
  const oob = sim.applyCommand({ type: "build", kind: "kiln", x: 99, y: 0 });
  assert.equal(oob.ok, false);
  assert.equal(oob.error, "ERR_OUT_OF_BOUNDS");

  // 2. Flooded below tide without piling (force era 4 high water and pick lowest x=0 parcel)
  sim.applyCommand({ type: "advance_era", era: 4 });
  const wetParcel = sim.state.grid.parcels.find((p) => p.elevation < sim.state.tide.tideLevelM);
  assert.ok(wetParcel, "expected at least one parcel below era-4 tide");
  const noPile = sim.applyCommand({ type: "build", kind: "granary", x: wetParcel.x, y: wetParcel.y });
  assert.equal(noPile.ok, false);
  assert.equal(noPile.error, "ERR_FLOODED_NO_PILING");

  // Wet piling dock IS allowed on the exact same tidal parcel
  const piledDock = sim.applyCommand({ type: "build", kind: "dock", x: wetParcel.x, y: wetParcel.y });
  assert.equal(piledDock.ok, true);

  // 3. Occupied parcel double-build rejected
  const dup = sim.applyCommand({ type: "build", kind: "breakwater", x: wetParcel.x, y: wetParcel.y });
  assert.equal(dup.ok, false);
  assert.equal(dup.error, "ERR_PARCEL_OCCUPIED");

  // 4. Insufficient timber/stone rejected (dock spent 22 timber, leaving 8 < kiln 16)
  const dryParcel = sim.state.grid.parcels.find((p) => p.elevation > 4.0 && !p.building);
  const broke = sim.applyCommand({ type: "build", kind: "kiln", x: dryParcel.x, y: dryParcel.y });
  assert.equal(broke.ok, false);
  assert.equal(broke.error, "ERR_INSUFFICIENT_RESOURCES");
  assert.equal(sim.verifyConservation().ok, true);

  // 5. Tampered command log / mutated receipt rejected fail-closed
  const log = [{ type: "build", kind: "watchtower", x: 6, y: 2 }, { type: "tick", count: 8 }];
  const good = replayCommands(9902, log);
  const tamperedLog = [{ type: "build", kind: "granary", x: 6, y: 2 }, { type: "tick", count: 8 }];
  const chkLog = verifyReplayReceipt(good.receipt, 9902, tamperedLog);
  assert.equal(chkLog.ok, false);
  assert.ok(chkLog.errors.includes("COMMAND_LOG_HASH_MISMATCH"));
  assert.ok(chkLog.errors.includes("TAMPERED_REPLAY_RECEIPT"));

  const mutatedReceipt = { ...good.receipt, stateSha256: "sha256:00000000tampered" };
  const chkMut = verifyReplayReceipt(mutatedReceipt, 9902, log);
  assert.equal(chkMut.ok, false);
  assert.ok(chkMut.errors.includes("TAMPERED_REPLAY_RECEIPT"));
});

test("render-hook: exports 3D world footprints, continuous floodline contour, and /playground/ patchbay frame", () => {
  const { sim } = replayCommands(20261118, [
    { type: "build", kind: "breakwater", x: 1, y: 2 },
    { type: "build", kind: "watchtower", x: 6, y: 2 },
    { type: "advance_era", era: 2 },
    { type: "tick", count: 10 },
  ]);
  const r = extractSettlementRenderState(sim.state, { cellM: 32 });
  assert.equal(r.era, 2);
  assert.equal(r.footprints.length, 2);
  assert.equal(r.floodlineContour.length, sim.state.grid.height);
  assert.equal(r.playgroundFrame.width, 8);
  assert.equal(r.playgroundFrame.height, 4);
  assert.equal(r.playgroundFrame.lumaGrid.length, 32);
  assert.ok(r.playgroundFrame.pixelsSha256.startsWith("sha256:"));
  assert.equal(r.playgroundPalette.oklab.length, 4);
  assert.equal(Object.keys(BUILDINGS).length, 7);
});

test("BuildLang coastal_kernel.bld checks, runs, and matches JS FNV-1a 64-bit digest bit-for-bit", () => {
  const buildc = findBuildc();
  if (!buildc) {
    assert.ok(fs.existsSync(path.join(CIV_DIR, "coastal_kernel.bld")));
    return;
  }
  const kernelPath = path.join(CIV_DIR, "coastal_kernel.bld");
  execFileSync(buildc, ["check", kernelPath], { stdio: "pipe" });
  const out = execFileSync(buildc, ["run", kernelPath], { encoding: "utf8" });
  const m = out.match(/COASTAL_KERNEL_OK exposed=(\d+) sheltered=(\d+) fnv1a64=(\d+)/);
  assert.ok(m, `unexpected coastal_kernel.bld output: ${out}`);
  assert.ok(Number(m[2]) < Number(m[1]), "BuildLang kernel must show breakwater reduces flood exposure");

  // Compute exact same integer sequence in JS and assert 64-bit FNV-1a bit-equality
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ints = [];
  for (let i = 0; i < 8; i++) {
    const elev = -0.2 + i * 0.65;
    const forest = clamp01(0.15 + i * 0.11);
    const porosity = clamp01(0.65 - i * 0.05);
    const rExp = clamp01((1.4 - (elev - (0.85 + 1.65))) / 2.6);
    const rShl = clamp01((1.4 - (elev - (0.85 + 1.65 * 0.45))) / 2.6);
    const imp = Math.max(0.2, clamp01(1 - porosity * 0.65));
    const ro = 0.55 * clamp01(1 - forest) * imp * (elev > 0.6 ? 0.035 : 0.01);
    ints.push(Math.round(rExp * 10000), Math.round(rShl * 10000), Math.round(ro * 100000));
  }
  const jsHex = fnv1a64Ints(ints);
  const bldHex = BigInt(m[3]).toString(16).padStart(16, "0");
  assert.equal(bldHex, jsHex, `BuildLang FNV-1a (${bldHex}) != JS FNV-1a (${jsHex})`);
});
