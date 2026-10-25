# Charts: prop schemas and tiers

**Package:** `@texuli/charts`  
**Import:** `import { chartPropSchemas, chartSchemaDefinitions } from '@texuli/charts/schemas'`

JSON-safe, introspectable descriptions of every blueprint-rendered chart's
props, keyed by catalog-style id (`charts-line` … `charts-calendar`, 24
schemas). Builders and inspectors read them to render editors. The per-family
docs' prop tables are generated from these schemas.

## Shape

Each `ChartComponentPropSchema` has `schemaVersion: 1`, `id`, `component`,
`family` and `props`. A prop has `name`, `label`, `description`, `group`
(`accessibility`, `data`, `series`, `axes`, `bins`, `layout`, `appearance`,
`interaction`, `localization`), `required`, an optional `default` and a
value schema (`string`, `number`, `boolean`, `enum`, `nullable`, `union`,
`array`, `tuple`, `object`, `record`, `reference` or `event`).
`chartSchemaDefinitions` holds the recursive `tree-node` used by hierarchy
charts.

## Tiers

Three tier ideas meet around charts. Only the first two exist today.

| Tier | Values | Where it applies |
| --- | --- | --- |
| Prop exposure | `blueprint` or `developer` | Every schema prop. `developer` props (callbacks such as `onselect` and `class`) are visible to tooling but are not blueprint-editable. Compact-chart `format` is a plain JSON format specification and is blueprint-editable. |
| Render tier | `untrusted` or `developer` | The catalog renderer (`@texuli/catalog`). It resolves to `untrusted` unless the host passes exactly `'developer'`. Chart nodes are catalog tier `content` and agent-emittable. |
| Capability tier (portable or web-only) | — | **Planned.** The roadmap proposes marking each chart as portable to native targets or web-only. No manifest or schema carries this yet. |

Chart blocks in `@texuli/blocks` accept only blueprint props, and add document
caps for untrusted JSON (for example 8 series × 64 points); see
`packages/blocks/docs/blocks-data.md`.

## Testing

```bash
pnpm vitest run packages/charts/tests/schemas.test.ts
```
