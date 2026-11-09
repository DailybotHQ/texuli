# Host catalog extensions

A host library adds its own components to the catalog with an **extension**, so a locked
design system can allow or disable them like Texuli's own (ADR-032, spec 0.13.0, new in
`0.15.0`). Texuli ships no extension: hosts publish theirs (for example
`design-systems/catalog-extension.json`) and merge them at run or build time.

```json
{
  "format": "texuli/catalog-extension",
  "version": 1,
  "namespace": "acme",
  "components": [
    {
      "id": "acme:kpi-strip",
      "label": "KPI strip",
      "summary": "A row of key figures for a dashboard header.",
      "group": "display",
      "placement": "app",
      "emit": [],
      "capability": "web-only",
      "props": [{ "name": "tone", "kind": "enum", "enumValues": ["neutral", "brand"] }],
      "axes": { "tone": { "prop": "tone", "values": ["neutral", "brand"], "default": "neutral" } },
      "states": ["hover", "focus-visible"],
      "composes": ["card", "stat", "text"]
    }
  ]
}
```

- **Shape:** the catalog's own component shape (`$defs.component` in
  [`catalog.schema.json`](../../schemas/catalog.schema.json)); the file is
  `$defs.extension`.
- **Ids:** `<namespace>:<kebab-case id>`. The namespace is 2 to 16 lowercase letters and digits;
  `texuli`, `tx`, `spec` and `catalog` are reserved.
- **Host code only:** each component is `placement: "app"`, `emit: []` and
  `capability: "web-only"`, so no agent emits it and no blueprint carries it. It has no events,
  bindings or sources.
- **`composes`:** up to 32 catalog ids the component is built from: Texuli ids or ids of any
  merged extension, never itself. An empty list marks a leaf built directly on host primitives.
- **Axes and states:** the same contract as the catalog. Each axis equals its enum prop's
  values with its default among them; states come from the closed list.

`mergeCatalogs(texuli, extensions)` (`@texuli/spec`) merges the extensions into the Texuli
catalog (`catalog/components.json`) and returns `{ ok, catalog, extensions, issues }`. It is
total over JSON values: at most 16 extensions, 256 components and 256 KB each. It refuses a
bad extension whole, with one of these codes:

| Code | When |
| --- | --- |
| `extension-format` | Not `{ format, version: 1, namespace, components }`, an unknown field, a missing label, summary or group, or a component that is not host-only |
| `extension-oversize` | Over the bounds |
| `extension-namespace` | A missing, malformed or reserved namespace |
| `extension-id` | An id outside its namespace, or not kebab-case |
| `extension-collision` | An id declared twice, or a namespace merged twice |
| `extension-composes` | `composes` is missing or malformed, too long, names itself, names an id the merged catalog lacks, or names a refused extension's id |
| `extension-props` | Props that are not `{ name, kind, required?, enumValues? }` with unique names |
| `extension-axis` | An axis that drifts from its prop |
| `extension-state` | A state outside the list, or a repeat |

The merged catalog feeds everything that reads a catalog:

- **`checkDesignSystemAllow(doc, merged.catalog)`:** `allow` keys and library `composes`
  accept `<ns>:<id>`. An empty list disables a value, and an id the merge lacks is
  `unknown-component`.
- **`compileAllowManifest(doc, { catalog: merged })`** (`@texuli/tokens`): records the merged
  hash as `catalogDigest`, and the namespaces as `extensions`.
- **`texuli/ds-kit`:** extension components appear in the matrix, rendered from the host's
  `samples` snippets keyed by id.
