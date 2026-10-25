# Layout register-only subpaths

Cold-start registration without pulling layout Svelte components into the
initial chunk:

| Import | Registers |
| --- | --- |
| `texuli/layouts/mobile/register` | `mobile-tabs`, `mobile-drawer` (separate dynamic chunks) |
| `texuli/layouts/dashboard/register` | `dashboard-grid` |
| `texuli/layouts/marketing/register` | `marketing` |
| `texuli/layouts/auth-settings/register` | `auth-split`, `wizard` |

```ts
import { registerMobileLayouts } from 'texuli/layouts/mobile/register';
registerMobileLayouts();
```

Component barrels (`texuli/layouts/mobile`, `…/dashboard`, `…/marketing`) stay
for direct layout/widget imports. They re-export register helpers but do not
statically import layout Svelte files for registration.

`package.json` `sideEffects` is CSS-only; register modules do not self-register
on import.

Gate: `pnpm vitest run packages/texuli/tests/layout-register-tree-shake.test.ts`
