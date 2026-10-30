# Data-source bindings (spec 0.8.0)

**Status:** new in `0.8.0` (spec `0.8.0`).
**Subpath:** `@texuli/spec/source` (`src/source.ts`)
**Schema:** `$defs.sourceBinding`, `sourceQuery`, `sourceFilter`,
`sourceSort`, `sourceName` and `sourceFieldName` in
`schemas/blueprint.schema.json`; the catalog's component `sourceable` list
in `schemas/catalog.schema.json`
**Tests:** `tests/source.test.ts`, the `source-tickets` golden and the
`source-*` invalid fixtures (validated against `fixtures/sources.json`)
**Decisions:** ADR-012 and ADR-015 in `docs/DECISIONS.md`

Generated views read the host's data through sources the host registers
(`@texuli/core/data-source`). A blueprint names a source and sends a closed
query; agents never name URLs or ship code, and Texuli never builds a URL,
SQL or code from a query.

```json
"rows": {
  "$source": "tickets",
  "query": {
    "fields": ["title", "status", "points"],
    "filter": {
      "type": "group",
      "op": "and",
      "children": [
        { "type": "condition", "field": "status", "operator": "in", "value": ["open", "doing"] },
        { "type": "condition", "field": "points", "operator": "between", "value": [1, 13] }
      ]
    },
    "sort": [{ "field": "points", "direction": "desc" }],
    "pageSize": 25
  },
  "map": { "column": "status" }
}
```

## The shape

| Member | What it holds | Limits |
| --- | --- | --- |
| `$source` | A source name the host registered: lowercase words joined by `.`, `_` or `-` (`SPEC_SOURCE_PATTERNS.sourceName`) | 64 characters; never a URL |
| `query.fields` | The fields to return (the key always comes back) | 1 to 32 declared field names |
| `query.filter` | The `@texuli/data` grid filter model: `{ type: "group", op: "and" \| "or", children }` and `{ type: "condition", field, operator, value }`; operators `SPEC_SOURCE_FILTER_OPERATORS` (the grid's `FILTER_OPERATORS`) | 6 levels, 64 nodes; `in` takes 1 to 100 values, `between` exactly 2; text values at most 500 characters |
| `query.sort` | `{ field, direction: "asc" \| "desc" }` | 1 to 4 keys, each field once |
| `query.search` | Free text, passed to the host's adapter as data | 200 characters |
| `query.pageSize` | Rows per page | 1 to 500, and at most the source's `maxPageSize` |
| `map` | Item field → source field, for props whose items name fields differently (a board card's `column` from a ticket's `status`) | 16 entries; keys are item fields of the prop |

ADR-015 describes the filter as "the condition AST over `field` operands".
The filter is that tree written in the grid filter model's vocabulary: the
same `and` and `or` groups over conditions on named fields, with the grid's
operators, so a query's filter is the data the grid and the filter builder
already store, and hosts can run it with `@texuli/data`'s grid engine.

## The checks

`checkSourceBinding(binding, { sources, itemFields })` runs the closed shape
first (so `@texuli/catalog` can run it without the schema document), then
the meaning against the host's descriptors:

- a registered source (`unknown-source` otherwise) that can list rows;
- declared fields in `fields`, `filter`, `sort` and `map`;
- operators the field allows (its `filter` list), and values of its type:
  text, an option of an `enum`, a finite number, a date (`YYYY-MM-DD`, an
  ISO 8601 date-time with a zone, or epoch milliseconds) or a boolean;
  `null` fits any field; `isEmpty` and `isNotEmpty` take no value;
- sortable fields (`sort: true`), `search` only on sources that declare the
  `search` operation, and a page size within `maxPageSize`;
- `map` keys among the prop's item fields (`itemFields`).

Every other problem is `source`. The filter's size is measured without
recursion before anything recurses into it, so a filter nested 100,000
levels deep is refused in linear time. **Without `sources` a binding is
refused** (`source`): the spec fails closed.

`validateBlueprint` runs these checks for a whole prop listed in the
component's `sourceable` (`SpecDocuments.sources` gives the descriptors) after
the schema check of `$defs.sourceBinding`; a binding on any other prop,
nested inside a prop value, or mixed with `$state` is `source`.
`SpecSourceDescriptor` is structurally `SourceDescriptor` from
`@texuli/core/data-source`, so `registry.describe()` can be passed as is;
`fixtures/sources.json` is the fixture host the goldens and invalid fixtures
are validated against. `isSourceBinding`, `isSpecSourceDate`,
`SOURCE_BINDING_KEY`, `SOURCE_BINDING_FIELDS`, `SPEC_SOURCE_LIMITS`,
`SPEC_SOURCE_FIELD_TYPES`, `SPEC_SOURCE_OPERATIONS` and the types
`SourceBindingContext`, `SourceBindingIssue`, `SpecSourceField`,
`SpecSourceFieldType`, `SpecSourceFilterOperator` and `SpecSourceOperation`
complete the subpath.

## Parity

`tests/source.test.ts` runs one corpus of queries through this checker and
`checkSourceQuery` from `@texuli/core/data-source` (the spec cannot import
core: both are L0) and expects the same verdicts. The Kotlin twin
(`native/texuli-spec`, `Source.kt`) applies the same rules, and the
invalid fixtures are refused with the same codes on both targets; its date
check reads the fields' ranges instead of the platform date parser.

## Migration

`0.7.0 → 0.8.0` only stamps `spec`: data-source bindings are new optional
values, and every 0.7.0 envelope is a valid 0.8.0 envelope.
