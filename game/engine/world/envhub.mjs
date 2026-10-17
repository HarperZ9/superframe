// The environment as a real-time system reads it: one sample at Lamb's place (and position,
// where the shell supplies ground and water), with footing derived from the place and the
// weather. Combat, Tide Runs and the character pipeline read the same numbers dialogue reads.
//   G.envAt({ place, x, z, groundY })  ->
//     { tide, waterY, depth, footing, grip, light, sodium, seen, wind: { speed, dir, x, z },
//       fog, rain, temp, frost, wet }
// footing: the @place key footing (stone, mud, wood, sand, weed, shingle; default stone),
// becoming "frost" when the night's frost is 1 outdoors, "wet <footing>" in rain over 0.5 mm/h
// outdoors, and "water" when the depth at the position is over 0.05 m.
// grip: a 0..1 traction factor for movement and combat footwork, from @rules footing-<kind>
// (defaults below); content can retune any of them.
export const FOOTING_GRIP = { stone: 1, wood: 0.95, sand: 0.85, shingle: 0.8, mud: 0.6, weed: 0.45, frost: 0.35, water: 0.55 };

export function createEnvHub(G) {
  const grip = (kind) => { const k = kind.replace(/^wet /, ""), r = G.rs.rules[`footing-${k}`]; const g = r != null ? +r : FOOTING_GRIP[k] ?? 1; return kind.startsWith("wet ") ? g * 0.85 : g; };
  // footing: a tile's own surface (for combat's ground), weathered by the same rules.
  return function envAt({ place = G.state.place, x = null, z = null, groundY = null, waterY = null, footing: tile = null } = {}) {
    const T = (n) => G.env.term(n, place), p = G.book.places[place] || {}, outdoors = !(p.shelter || p.stove);
    const tide = +T("tide") || 0, depth = groundY != null && waterY != null ? Math.max(0, waterY - groundY) : 0;
    let footing = tile || p.footing || "stone";
    if (outdoors && +T("frost") >= 1) footing = "frost";
    else if (outdoors && (+T("rain") || 0) > 0.5) footing = `wet ${footing}`;
    if (depth > 0.05) footing = "water";
    const speed = +T("wind.speed") || 0, dir = +T("wind.dir") || 0, rad = (dir * Math.PI) / 180;
    return {
      tide, waterY, depth, footing, grip: grip(footing), x, z,
      light: +T("light") || 0, sodium: +T("sodium") || 0,
      // the wind blows from dir: its vector points the other way (x east, z north)
      wind: { speed, dir, x: -Math.sin(rad) * speed, z: -Math.cos(rad) * speed },
      fog: +T("fog") || 0, rain: +T("rain") || 0, temp: +T("temp") || 0, frost: +T("frost") || 0, wet: G.body.wet(),
    };
  };
}
