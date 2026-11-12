// I/O for character renders: PNG through the engine's own encoder (raw-native tools/shaders/png.mjs),
// read from the Low Water worktree. Override the engine root with RN_ROOT.
import { pathToFileURL } from "node:url";
export const RN_ROOT = process.env.RN_ROOT || "C:/dev/worktrees/raw-native-lowwater";
import os from "node:os";
try { os.setPriority(0, os.constants.priority.PRIORITY_LOW); } catch (e) { console.error("could not set Idle priority:", e.message); }
export const rn = (rel) => pathToFileURL(`${RN_ROOT}/${rel}`).href;
const PNG = await import(rn("tools/shaders/png.mjs"));
export const { writePng, readPng } = PNG;
export { toRgba8, down, paste } from "./image.mjs";
