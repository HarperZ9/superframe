// A cast as the Studio reads it: members by lower-case id from one or more cast modules, and which person
// and era each record is (a module's ERA_IDS, e.g. "abel@e1" -> "abel_era1"; ids it does not list fall
// back to their suffix, or to the game's default era).
//   castOf(...modules) -> members   eraOf(key) personOf(key)   setDefaultEra(n)
let ERA = null, DEFAULT_ERA = 2;
export const setDefaultEra = (n) => { DEFAULT_ERA = n; };
export function castOf(...mods) {
  ERA = Object.assign({}, ...mods.map((m) => m.ERA_IDS || {}));
  return Object.fromEntries(mods.flatMap((m) => Object.entries(m)).filter(([, m]) => m && m.build).map(([k, m]) => [k.toLowerCase(), { ...m }]));
}
const eraEntry = (key) => ERA && Object.entries(ERA).find(([, v]) => v === key)?.[0];
export function eraOf(key) { const e = eraEntry(key); return e ? +e.split("@e")[1] : /_era(\d)$/.test(key) ? +key.match(/_era(\d)$/)[1] : /_adult$/.test(key) ? 3 : DEFAULT_ERA; }
export function personOf(key) { const e = eraEntry(key); return e ? e.split("@")[0] : key.replace(/_(era\d|adult)$/, ""); }
