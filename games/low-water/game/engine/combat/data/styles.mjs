// The five play styles (SYSTEMS-FULL 19.10) at a mid-game sheet, for measurements and captures
// (tools/kite.mjs, tools/showcase.mjs). Browser-safe: no node imports.
const base = (v) => Object.fromEntries(["grip", "ballast", "knees", "pride", "formletter", "sum", "dark", "salt", "carbon", "precedent", "undertow", "condolence", "hearsay", "smell"].map((k) => [k, v]));
const lift = (keys, v) => Object.fromEntries(keys.map((k) => [k, v]));

// The five styles (SYSTEMS-FULL 19.10) at a mid-game sheet: the style's compartments at 7 (a
// second at 5), its four voices at 7, the rest at 3; its own tool at temper 2.
export const STYLES = {
  fist: { levels: { coat: 7, nose: 5, pen: 3, hat: 3, ...base(3), ...lift(["grip", "ballast", "knees", "pride"], 7) }, tool: "w.hammer", temper: 2 },
  tongue: { levels: { coat: 5, nose: 3, pen: 3, hat: 7, ...base(3), ...lift(["condolence", "formletter", "pride", "hearsay"], 7) }, tool: "w.case", temper: 2 },
  shadow: { levels: { coat: 5, nose: 7, pen: 3, hat: 3, ...base(3), ...lift(["dark", "salt", "smell", "undertow"], 7) }, tool: "w.knife", temper: 2 },
  hands: { levels: { coat: 6, nose: 3, pen: 6, hat: 3, ...base(3), ...lift(["grip", "sum", "carbon", "salt"], 7) }, tool: "w.boathook", temper: 2 },
  eye: { levels: { coat: 4, nose: 5, pen: 7, hat: 3, ...base(3), ...lift(["carbon", "undertow", "precedent", "sum"], 7) }, tool: "w.fid", temper: 2 },
};

