# Primitive: RadioGroup

**Package:** `@texuli/primitives`  
**Source:** `packages/primitives/src/radio-group/`  
**Tests:** `packages/primitives/tests/radio-group.test.ts`  
**Behavior:** `tests/behavior/scenarios/radio-group.spec.ts`  
**Task:** T-prim-radio-group

## Import

```ts
import { RadioGroup } from '@texuli/primitives/radio-group';
// or
import { RadioGroup } from '@texuli/primitives';
```

## API (Bits-compatible surface)

| Part | Role | Notes |
| --- | --- | --- |
| `RadioGroup.Root` | `radiogroup` | `bind:value`, `onValueChange`, `name`, `required`, `disabled`, `readonly`, `orientation` (`vertical` default), `loop` |
| `RadioGroup.Item` | `radio` | `value`, `disabled`, `id`; `data-state` checked/unchecked; children snippet `{ checked }` |

## Behavior

- One Tab stop on the checked (or first enabled) item via roving focus (`@texuli/core/roving`).
- Arrow keys move and select (orientation + RTL via roving); Space/Enter select.
- Disabled items are skipped.
- Optional `name` installs a form bridge (`@texuli/core/form-bridge`) for native submit/reset.
- Headless: no styles; consumers supply labels with `for` / `id`.

## Behavior

```bash
pnpm exec playwright test tests/behavior/scenarios/radio-group.spec.ts
```
