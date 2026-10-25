# Switch primitive

**Package:** `@texuli/primitives`  
**Import:** `import { Switch } from '@texuli/primitives/switch'`  
**Tests:** `packages/primitives/tests/switch.test.ts`  
**Behavior:** `tests/behavior/scenarios/switch.spec.ts`

## Contract

Headless on/off control following the WAI-ARIA **switch** pattern:

| Part | Role |
| --- | --- |
| `Switch.Root` | `role="switch"`, `aria-checked`, `data-state` `checked` \| `unchecked` |
| `Switch.Thumb` | Presentational thumb; mirrors `data-state` |

### Props (Root)

- `checked` / `defaultChecked` / `onCheckedChange` — controllable state
- `name` / `value` (default `"on"`) / `form` — native form bridge (submits only when on)
- `disabled`, `required`, `id`
- `child` snippet for composition (`composeChildProps`)
- Space and Enter toggle; label `for={id}` works via native association

### Accessibility

- Named by associated `<label for>`
- Described via `aria-describedby`
- Disabled switches do not toggle

Built on `@texuli/core/controllable` and `@texuli/core/form-bridge`.
