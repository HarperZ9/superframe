# registry

One shape for every named thing the stack uses: a colour, a material, a unit, a shape, a medium, a conversion between mediums, a law, a rhetorical device. An entry has a stable id, a reference behind it, a plain name, its families and its neighbours. Tools read entries by id, and a build fails when an id points nowhere.

This package holds the schema and the first table, `data/units.json`. The other tables listed below already exist in this repository and elsewhere. They join the registry one at a time, each through its own change.

## An entry

```json
{
  "id": "material.gold",
  "name": "Gold",
  "kind": "measured",
  "families": ["material/metal"],
  "values": {
    "n": { "value": [1.4622, 1.4653], "unit": "unit.1", "grid": "grid.vis81",
           "source": "refractiveindex.info:main/Au/Johnson", "licence": "CC0-1.0",
           "uncertainty": null, "confidence": "high" }
  },
  "links": [ { "to": "law.fresnel", "rel": "governed_by" } ],
  "neighbours": { "by": "values.n", "ids": ["material.copper", "material.silver"] }
}
```

| Field | Rule |
|---|---|
| `id` | `<table>.<slug>`, lower case, never reused, never renamed. A retired entry keeps its id and gains `"retired": "<date>"`. |
| `name` | What a person says aloud. |
| `kind` | `measured`, `defined`, `derived` or `attested`. See below. |
| `families` | At least one. A family is itself an id-like path, `material/metal`. |
| `values` | Each value carries `unit` (an id in `data/units.json`), `source`, `licence`, and `uncertainty` or `null` with the reason in `note`. |
| `links` | Typed edges to other entries. Every `to` must resolve. |
| `neighbours` | Computed from a stated value and distance, never typed by hand. |

## Four kinds of reference

- **measured**: a value read from an instrument or a published table. It has a unit, an uncertainty and a source.
- **defined**: fixed by convention, such as a unit or an exact constant.
- **derived**: computed from other entries. It names its inputs and the formula.
- **attested**: for things no instrument reads, such as a literary device or an idea. The reference is a definition, the earliest known use, and example passages. Where independent readers were asked, their agreement rate is recorded.

A proof or a physical calculation may depend on measured, defined and derived entries. It may cite an attested entry and may not compute from one.

## Six kinds of scale

Every unit states its scale, and the scale says which arithmetic is allowed on values in that unit.

| Scale | Allowed | Example |
|---|---|---|
| `linear` | Sums, differences and ratios. Multiply by `to_si` to convert. | metre, joule |
| `affine` | Sums of differences. Multiply, then add `offset`. A ratio of two readings means nothing. | degree Celsius |
| `logarithmic` | Differences, which are ratios of the quantity underneath. | stop, decibel, magnitude |
| `count` | Sums of the same named thing. Two counts of different things do not add. | photon, pixel |
| `ordinal` | Order only. No sums, differences or ratios. | Mohs hardness |
| `nominal` | Equal or different only. | a film stock name |

Ordinal and nominal follow Stevens (1946), "On the Theory of Scales of Measurement", Science 103, 677 to 680.

## Conversions are entries

A conversion between two mediums is an entry in the `conversion` table. Its reference is a grade (isomorphism, embedding or homomorphism, as in `packages/field`) and a measured loss on stated test signals.

## Checks a table must pass

1. Every id is unique and matches `<table>.<slug>`.
2. Every `unit`, `links[].to`, `grid` and `neighbours.ids[]` resolves to an entry.
3. Every entry has at least one family.
4. Every measured value has a source and a licence.
5. Any generated copy of a table equals what its generator produces from the source table.

The checker is a BuildLang program, `bld/check.bld`, and CI runs it on `data/units.json` (the units table only). Run it from the repository root with `buildc run packages/registry/bld/check.bld -- packages/registry/data/units.json`. It prints one line per check with PASS or FAIL and a count, and exits 1 on any failure.

Of the five checks above it covers check 1 (ids unique and `unit.<slug>`) and the family part of check 3 (a non-empty `family` string). It does not yet cover check 2 (the units table has no `links`, `grid` or `neighbours`, so there is nothing to resolve until a second table lands), check 4 (no measured values with sources and licences are in the table yet) or check 5 (no generated copies exist yet). It adds checks the units table needs: a name and a symbol, unique symbols, a `dim` with one integer per base, a `scale` of one of the six kinds, and the per-scale rules (linear and affine carry `to_si`, affine also `offset`; logarithmic carries `log` with `k`, `base`, `of` and `reference` and no `to_si`; count carries `of`, except the bare `unit.count`; ordinal carries `order`; nominal carries neither `to_si` nor `log`). A `to_si` may be a number or an exact expression string such as `"pi/180"`; the expression is not evaluated.

`bld/fixtures/` holds one small broken table per check and one unbroken table. `check --expect <check> <table>` succeeds only when that check is the one and only check that fails, and CI runs it on every fixture, so a checker that passes everything fails the build.

## Tables

| Table | Source today | State |
|---|---|---|
| `unit` | `data/units.json` | Written 2026-11-13 as the union of `packages/field/src/units.js`, `packages/rooms/core/units.js` and the BuildLang compiler table, then extended. 90 units over 8 bases (the 7 SI bases and the bit), each with a scale kind. The three code tables are not generated from it yet. |
| `material` | `packages/materials/data/materials.json` | 111 entries, already carrying value, unit, source, licence and confidence per field. Ids need the `material.` prefix; `law_links` point at ids that do not exist. |
| `quantity` | `packages/measured/data/codata2022.json` | 355 quantities with uncertainty. They have names and no slugs. |
| `glass`, `film`, `phosphor`, `sensor` | `packages/lenspipe`, `native/web/shaders` | Ids and sources present. |
| `shape` | `packages/rooms/core/shapes.js` | 56 shapes with numeric ids. |
| `medium`, `conversion` | `superframe/lib/types.mjs`, `superframe/lib/convert.mjs` | 14 mediums and 31 conversions with ids and no measured loss. |
| `map` | `packages/rooms/maps/registry.json` | 22 maps between domains with a failure condition each. |
| `law` | `packages/ndim/data/laws.json`, `packages/lawspace` | 354 laws by name only, and 15 with anchors. No shared ids. |
| `colour` | none | No single table. Planned from open sources with our own ids. |
| `wave`, `phenomenon`, `signal` | none | Not catalogued yet. |

Tables that live in other repositories (the site's element library, the Commons rhetoric and persuasion families, Articulate's prose patterns, Flywheel's certificate families and criteria) join by id through the same schema.
