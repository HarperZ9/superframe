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

## Conversions are entries

A conversion between two mediums is an entry in the `conversion` table. Its reference is a grade (isomorphism, embedding or homomorphism, as in `packages/field`) and a measured loss on stated test signals.

## Checks a table must pass

1. Every id is unique and matches `<table>.<slug>`.
2. Every `unit`, `links[].to`, `grid` and `neighbours.ids[]` resolves to an entry.
3. Every entry has at least one family.
4. Every measured value has a source and a licence.
5. Any generated copy of a table equals what its generator produces from the source table.

The checker is a BuildLang program and is the next change. Until it lands, this package is data and specification only, and nothing here has been checked by a program.

## Tables

| Table | Source today | State |
|---|---|---|
| `unit` | `data/units.json` | Written 2026-11-13 as the union of `packages/field/src/units.js`, `packages/rooms/core/units.js` and the BuildLang compiler table. 41 units over 8 bases (the 7 SI bases and the bit). The three code tables are not generated from it yet. |
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
