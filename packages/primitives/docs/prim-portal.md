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
| `to` | `Element \| null \| undefined` | Destination; omit/`undefined`/`null` → the portal root of the nearest token scope, or the owner document `body` |
| `scope` | `'auto' \| Element \| (() => Element \| null) \| null` | Token scope followed when `to` is omitted (ADR-023). `'auto'` (default): the nearest `[data-tx-scope]` or `[data-tx-theme]` around the Portal; `null`: always `body` |
| `disabled` | `boolean` | Keep content in place (no move) |
| `children` | `Snippet` | Portaled content |

Built on `@texuli/core/portal` `createScopedPortal` (`createPortal` plus token scopes): the same DOM node is moved (not cloned), so listeners and Svelte state stay attached. Destroy restores the original sibling order.

## Behavior

- Default target is `document.body` (from the source element's owner document), unless the Portal sits inside a token scope: then a scoped portal root at the end of `body` (`div[data-tx-portal-root]`, `display: contents`) that mirrors the scope's `data-tx-*` attributes and inline custom properties, kept in sync ([core-portal](../../core/docs/core-portal.md#token-scopes-adr-023)). The Portal renders an empty `<template data-tx-portal-anchor>` in place to find its scope, and places its host again once the current update has flushed, so an ancestor that applies its theme in its own effect is still followed.
- Changing `to` moves the content to the new host.
- Unmount restores the origin position.
- Invalid targets (cross-document, self, descendant) are rejected by the texel.

## Behavior

```bash
TEXULI_E2E_PORT=4940 pnpm exec playwright test tests/behavior/scenarios/portal.spec.ts
```

The owned scenario portals a toast region, retargets it into a device frame, and opens a **non-trapping** modal so the toast stays keyboard-reachable (R16).
