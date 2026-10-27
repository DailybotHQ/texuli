# `@texuli/blocks/formula`

Closed calculator engine: parser, AST, evaluator, limits and diagnostics.
**Pure TypeScript** — no Svelte, no DOM, no interactive renderers.

```ts
import { evaluateFormula, parseFormula } from '@texuli/blocks/formula';

const parsed = parseFormula({
  op: 'mul',
  left: { op: 'var', name: 'seats' },
  right: { op: 'num', value: 12 },
});
if (parsed.success) evaluateFormula(parsed.formula, { seats: 3 }); // 36
```

## Why a separate subpath

Importing `@texuli/blocks/interactive` (or its renderers) pulls calculator UI
and related families. Protoyard cold starts that only need formula evaluation
import `@texuli/blocks/formula` instead.

`@texuli/blocks/interactive` still **re-exports** the same engine for
compatibility. `@texuli/blocks/core` also includes it among schemas and catalog
metadata.

## Surface

| Export | Role |
| --- | --- |
| `parseFormula` | Validate untrusted formula JSON into a closed AST |
| `evaluateFormula` / `evaluateCondition` | Pure interpreters (never throw) |
| `formatFormulaValue` / `roundTo` | Display helpers |
| `FORMULA_LIMITS` | Node/depth/args caps |
| `formulaVariables` / `formulaJsonPath` | Diagnostics helpers |
| Types | `NumberFormula`, `Condition`, `FormulaInputs`, … |

## Gates

```sh
pnpm vitest run packages/blocks/tests/engine-subpaths.test.ts packages/blocks/tests/core.test.ts
pnpm size --filter blocks/formula
```
