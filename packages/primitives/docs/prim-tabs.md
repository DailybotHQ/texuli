# Primitive: Tabs

**Package:** `@texuli/primitives`  
**Source:** `packages/primitives/src/tabs/`  
**Tests:** `packages/primitives/tests/composites.test.ts`  
**Behavior:** `tests/behavior/scenarios/tabs.spec.ts`  
**Task:** T-prim-tabs

## Import

```ts
import { Tabs } from '@texuli/primitives/tabs';
// or
import { Tabs } from '@texuli/primitives';
```

## API (Bits-compatible surface)

| Part | Role | Notes |
| --- | --- | --- |
| `Tabs.Root` | container | `bind:value`, `onValueChange`, `orientation` (horizontal default), `activationMode` (`automatic` \| `manual`), `loop` (default false), `disabled` |
| `Tabs.List` | `tablist` | Roving focus; Home/End |
| `Tabs.Trigger` | `tab` | `value`, `disabled`; `aria-selected`, `aria-controls`, `data-state` |
| `Tabs.Content` | `tabpanel` | `value`; `forceMount` (default true, inactive `hidden`); `aria-labelledby` |

## Behavior

- **Automatic** (default): focusing a tab selects it and shows its panel.
- **Manual**: arrows only move focus; Space/Enter or click selects.
- Disabled triggers are skipped by roving focus.
- Lazy panels: set `forceMount={false}` on `Content` to unmount inactive panels.

## Behavior

```bash
TEXULI_E2E_PORT=4940 pnpm exec playwright test tests/behavior/scenarios/tabs.spec.ts
```
