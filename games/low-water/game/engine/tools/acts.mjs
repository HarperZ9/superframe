// The acts a story has, found on disk, so the tools carry to a story of any length:
// content/actN/actN.lwd for N = 1, 2, ... in order, and each act's area wiring, wiring/actN-areas.lwd.
//   actFiles(contentDir) -> ["act1/act1.lwd", ...]        wiringOf("act2/act2.lwd") -> "wiring/act2-areas.lwd"
import { readdirSync, existsSync } from "node:fs";
export function actFiles(contentDir) {
  const root = contentDir.replace(/[\/]?$/, "/");
  return readdirSync(root).map((d) => /^act(\d+)$/.exec(d)).filter((m) => m && existsSync(`${root}${m[0]}/${m[0]}.lwd`)).sort((a, b) => a[1] - b[1]).map((m) => `${m[0]}/${m[0]}.lwd`);
}
export const wiringOf = (act) => `wiring/${act.split("/")[0]}-areas.lwd`;
