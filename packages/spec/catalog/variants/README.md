# Catalog variants, sizes and states

Per-group source files for the optional `axes` and `states` of each catalog component
(ADR-032, spec 0.13.0). `pnpm exec tsx packages/spec/scripts/bootstrap-catalog.ts` merges every
`*.json` file here (in name order) with the `axes` and `states` the catalog manifests declare,
and projects them into `../components.json`. Each component id is declared once: in one file
here, or in its manifest.

```json
{
  "format": "texuli-catalog-variants",
  "version": 1,
  "name": "part-a",
  "components": {
    "button": {
      "axes": { "variant": "variant", "size": "size" },
      "states": ["hover", "focus-visible", "active", "disabled", "loading"]
    },
    "data-grid": {
      "axes": { "density": { "prop": "density", "default": "comfortable" } }
    }
  }
}
```

- **`axes`**: `variant`, `size`, `tone` and `density` only. Each names one of the component's
  `enum` props. The projection copies the prop's `enumValues` as the axis `values`, and takes the
  `default` from the prop's manifest default. Write `{ "prop", "default" }` only when the prop
  declares no default. Other enums (`orientation`, `side`, `mode`…) stay plain props.
- **`states`**: from the closed list `hover`, `focus-visible`, `active`, `disabled`, `loading`,
  `invalid`, `selected`, `expanded`, `checked`, `open`, `readonly`, each at most once. List only
  states the component paints or sets (a CSS rule or an ARIA state). The projection writes them
  in that order.
- **Checks:** the files are untrusted data, bounded to 512 components and 256 KB each. Every
  problem has a stable code (`CATALOG_VARIANTS_CODES` in `src/catalog.ts`):

  | Code | Problem |
  | --- | --- |
  | `variants-format` | malformed file |
  | `variants-oversize` | over the bounds |
  | `variants-unknown-component` | an id that is not in the catalog |
  | `variants-duplicate-component` | an id declared twice |
  | `variants-unknown-axis` | an axis outside the four |
  | `variants-axis-prop` | the prop is missing or not an enum |
  | `variants-axis-default` | no default, a default outside the values, or one that contradicts the prop |
  | `variants-unknown-state` | a state outside the list |
  | `variants-duplicate-state` | a state listed twice |

  In `components.json`, `variants-axis-drift` means an axis no longer equals its prop's
  `enumValues`.

The split into `part-a.json`, `part-b.json` and `part-c.json` follows the catalog groups:

| File | Groups |
| --- | --- |
| `part-a.json` | forms, overlays |
| `part-b.json` | content, display, chat, documents, canvas |
| `part-c.json` | layouts, data, state, composition, schema-forms, sheets, workflows |
