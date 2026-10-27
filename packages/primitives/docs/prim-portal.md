# Primitive: Portal

**Package:** `@texuli/primitives`  
**Source:** `packages/primitives/src/portal/`  
**Tests:** `packages/primitives/tests/overlays.test.ts`  
**Behavior:** `tests/behavior/scenarios/portal.spec.ts`  
**Task:** T-prim-portal

## Import

```ts
import { Portal } from '@texuli/primitives/portal';
// or
import { Portal } from '@texuli/primitives';
```

## API

| Prop | Type | Notes |
| --- | --- | --- |
| `to` | `Element \| null \| undefined` | Destination; omit/`undefined`/`null` → owner document `body` |
| `disabled` | `boolean` | Keep content in place (no move) |
| `children` | `Snippet` | Portaled content |

Built on `@texuli/core/portal` `createPortal`: the same DOM node is moved (not cloned), so listeners and Svelte state stay attached. Destroy restores the original sibling order.

## Behavior

- Default target is `document.body` (from the source element's owner document).
- Changing `to` moves the content to the new host.
- Unmount restores the origin position.
- Invalid targets (cross-document, self, descendant) are rejected by the texel.

## Behavior

```bash
TEXULI_E2E_PORT=4940 pnpm exec playwright test tests/behavior/scenarios/portal.spec.ts
```

The owned scenario portals a toast region, retargets it into a device frame, and opens a **non-trapping** modal so the toast stays keyboard-reachable (R16).
