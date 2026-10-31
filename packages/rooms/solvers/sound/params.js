// SPDX-License-Identifier: FSL-1.1-MIT
import { CONSTANTS } from "../../core/constants.js";
/** Grid size, cell size in metres, speed of sound, Courant number, and the time step they imply. */
export const N = 512,
  DX = 0.01,
  C0 = CONSTANTS.airSoundSpeed.value,
  CFL = 0.5,
  DT = (DX * CFL) / C0;
