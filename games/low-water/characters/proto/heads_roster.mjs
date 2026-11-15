// Every speaking part with a body, by portrait id (the ids the portrait index and the talk panel use).
// Shared by the portrait bake (proto/portraits.mjs), the play-size sheet (proto/heads_play.mjs) and
// the distinctness test (proto/heads_blind.mjs).
// cast "quota": The Quota's slice cast (cast/quota.mjs), kept apart from Low Water's portraits
export async function roster(cast = process.env?.PORTRAIT_CAST || "lowwater") {
  if (cast === "quota") return Object.fromEntries([...Object.entries(await import("../cast/quota.mjs")), ...Object.entries(await import("../cast/quota2.mjs"))].filter(([, m]) => m && m.build).map(([k, m]) => [k.toLowerCase(), { ...m }]));
  const solo = ["lamb", "keel", "fennick", "sabine", "wenna", "merrow", "marrow"];
  const members = Object.fromEntries(await Promise.all(solo.map(async (n) => [n, { ...(await import(`../cast/${n}.mjs`)) }])));
  const LL = await import("../cast/lamplighter.mjs"), FOLK = await import("../cast/folk.mjs");
  for (const k of ["GORM", "HOBB", "FEWELL", "STRAND", "BRIGHT", "COE"]) members[k.toLowerCase()] = { ...LL[k] };
  for (const [k, m] of Object.entries(FOLK)) members[k.toLowerCase()] = { ...m };
  return members;
}
// The principals named in the brief, first in every sheet.
export const FIRST = ["lamb", "penhallow", "wenna", "gorm", "keel", "hobb", "marrow"];
