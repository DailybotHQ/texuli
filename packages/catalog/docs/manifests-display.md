# Display and feedback manifests

**Package:** `@texuli/catalog`  
**Source:** `packages/catalog/src/manifests/display/`  
**Tests:** `packages/catalog/tests/manifests-display.test.ts`

Authored catalog entries for display and feedback components in `texuli`:

| Id | Component |
| --- | --- |
| `card` | Card |
| `badge` / `tag` / `chip` | Badge family |
| `table` | Table |
| `alert` / `callout` / `banner` | Alert family |
| `stat` / `kpi` | Metrics |
| `empty-state` / `error-state` | Empty / error |
| `stepper` | Stepper |
| `timeline` | Timeline (UI list, not Gantt) |
| `kbd` / `code` | Kbd and Code |
| `inline-text` | No component: a catalog text node (audit G03) |

Each manifest is validated with `defineCatalogManifest`. Tests assert
`props[].name` equals the canonical lists in `prop-names.ts`, which mirror the
Svelte `Props` surfaces.

```ts
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { validateCatalogManifests } from '@texuli/catalog/manifest';

expect(validateCatalogManifests(DISPLAY_MANIFESTS).valid).toBe(true);
```

All entries are `tier: 'app'` and `agentEmittable: false` (chrome and feedback
are not agent-emitted content blocks).

## Plain text in slot-only components (audit G03)

`label`, `description`, `field-error`, `select-label` and the menu and select
triggers take their visible text through a `children` snippet and have no
string label prop. A catalog tree gives them text with the `inline-text` node,
whose one prop is a required `text` string. It works for `button`, `badge` and
`kbd` too:

```json
{
  "id": "button",
  "props": { "type": "submit" },
  "children": [{ "id": "inline-text", "props": { "text": "Save changes" } }]
}
```

- `inline-text` is not a `texuli` component, so its manifest names
  `@texuli/catalog` as its package. A host paints `text` as one escaped text
  node in the parent's slot.
- The renderer refuses markup-like strings, as it does for every prop, and
  treats `inline-text` as a leaf: any children are dropped with an
  `invalid-node` diagnostic.
- It follows the same tier contract as the components it labels: app tier and
  not agent-emittable, so it renders only for a host that passes
  `renderCatalogFromBuild(catalog, { developer: 'all' })`.
- `badge` and `kbd` now declare their `children` slot, which their Svelte
  components already render.

`button`, `badge` and `kbd` also take an optional plain-text `label` prop,
which their `texuli` components render as escaped text. A non-empty `label`
replaces `children` when both are given:

```json
{ "id": "button", "props": { "type": "submit", "label": "Save changes" } }
```

These ids are still app chrome, so the label changes no tier: the audit 03
probe above is valid for a host with `{ developer: 'all' }` and stays
`tier-denied` at the D5 developer tier.

`packages/catalog/tests/manifests-inline-text.test.ts` pins the slot-only ids,
checks that each one takes an `inline-text` child, and covers the `label`
prop and its tier outcome.
