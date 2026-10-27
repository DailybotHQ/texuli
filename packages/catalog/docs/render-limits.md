# Catalog tree limits

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/render/limits`  
**Tests:** `packages/catalog/tests/render-limits.test.ts`

## Goal

Validate an untrusted catalog tree **before** sink-free rendering:

| Limit | Default | Meaning |
| --- | --- | --- |
| `maxDepth` | 16 | Root depth = 1 |
| `maxNodes` | 512 | Total nodes across all roots |
| `maxBytes` | 256 KiB | UTF-8 size of canonical JSON snapshot |
| `maxBranching` | 64 | Max `children.length` on any node |
| `maxRoots` | 32 | Top-level array length |
| `maxRenderMs` | 100 | Wall clock for validate+render (**perf only**) |

On failure, `renderCatalogTreeWithLimits` returns **empty roots** and does not
call the renderer. Diagnostics use stable codes (`depth-exceeded`,
`value-depth-exceeded`, `value-cycle`, `nodes-exceeded`, `bytes-exceeded`,
`branching-exceeded`, `roots-exceeded`, `time-exceeded`).

Prop values are measured too, iteratively, so a value bomb cannot exhaust the
stack. A value nested deeper than `MAX_VALUE_MEASURE_DEPTH` (128) is refused
with `value-depth-exceeded`. A value that refers back to one of its own
ancestors (a cycle, which only a host-built object can carry, never JSON) is
refused with `value-cycle` instead of being walked forever. A value shared by
two props is not a cycle: it is measured at its deepest reference.

## Usage

```ts
import { renderCatalogFromSpecs } from '@texuli/catalog/render/renderer';
import {
  DEFAULT_TREE_LIMITS,
  measureCatalogTree,
  renderCatalogTreeWithLimits,
  validateCatalogTreeLimits,
} from '@texuli/catalog/render/limits';

const catalog = renderCatalogFromSpecs([/* … */]);
const check = validateCatalogTreeLimits(tree, { maxNodes: 100 });
if (!check.ok) {
  // refuse to render
}

const { roots, withinLimits, metrics } = renderCatalogTreeWithLimits(tree, {
  catalog,
  tier: 'untrusted',
  limits: { maxDepth: 8 },
});
```

### Perf / wall clock

`maxRenderMs` is enforced only when:

- `options.enforceRenderTime: true`, or
- `process.env.TEXULI_PERF === '1'`

Default unit tests never assert wall clock. Perf coverage lives under
`tests/perf/` or `it` blocks gated on `TEXULI_PERF`.

## Security

Limits are a DoS boundary in front of the sink-free renderer (see
`docs/SECURITY.md`). They do not replace schema checks, tier gates, or the
URL policy.
