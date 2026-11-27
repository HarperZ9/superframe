// index.mjs: Public entry point for Low Water's Coastal Civilization & Settlement Layer.
export {
  ERAS, clamp, q6, detHash, computeTideState, createCoastalGrid, refreshParcelHydraulics,
} from "./tide-parcels.mjs";
export {
  RECEIPT_SCHEMA, BUILDINGS, fnv1a64Ints, sha256Canonical,
  createCoastalCivSim, replayCommands, verifyReplayReceipt,
} from "./settlement-sim.mjs";
export { extractSettlementRenderState } from "./render-hook.mjs";
