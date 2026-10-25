# Core ids — deterministic, SSR-stable identifiers

**Package:** `@texuli/core`  
**Source:** `packages/core/src/ids/ids.ts`  
**Tests:** `packages/core/tests/ids.test.ts`

## Contract

Ids come from a **per-root counter** and a **stable prefix**. The same options
and the same call order on the server and on the client produce the same
strings, so SSR markup and hydration agree.

- No `Math.random`, `crypto.randomUUID`, or other non-deterministic source.
- No module-scope counter shared across roots (that would cross SSR requests).
- Framework-free TypeScript. Functions are pure, or they take an `Element` /
  scope explicitly (`ensureElementId`).

## API

| Export | Role |
| --- | --- |
| `createIdScope(options?)` | Per-root factory: `next(part?)`, `reset()`, `prefix`, `count`, `cursor` |
| `createIdFamily(scope, parts)` | One counter step → `{ part: id }` map for label/hint/error sets |
| `sanitizeIdPart(value)` | HTML-id-safe fragment (letters, digits, `-`, `_`) |
| `joinIds(...ids)` | Space-separated tokens; `undefined` when empty |
| `ariaLabelledBy` / `ariaDescribedBy` / `ariaControls` | Aria attribute helpers over `joinIds` |
| `ensureElementId(el, scope, part?)` | Keep existing `id` or assign `scope.next(part)` |

### Options

```ts
createIdScope({
  prefix?: string; // default "tx"; sanitized; empty → "tx"
  start?: number;  // default 0; first counter value `next()` uses
});
```

### Shape of an id

```text
{prefix}-{n}           // next()
{prefix}-{n}-{part}    // next('part') or createIdFamily slot
```

Examples: `tx-0`, `dialog-2-title`, `field-0-label`.

## SSR usage

```ts
import { createIdScope, ariaLabelledBy, ariaDescribedBy } from '@texuli/core';

// One scope per render root. Same prefix + start on server and client.
const ids = createIdScope({ prefix: 'dialog' });

const titleId = ids.next('title');
const descId = ids.next('desc');

// In markup / props:
// id={titleId}
// aria-labelledby={ariaLabelledBy(titleId)}
// aria-describedby={ariaDescribedBy(descId, errorId)}
```

Issue ids in a **stable order** during render (not inside event handlers that
run only on one side). Reset is for tests and controlled re-renders, not for
random mid-tree re-keying.

## Aria linking

```ts
ariaLabelledBy(titleId, optionalSubtitleId); // "title-id subtitle-id" | undefined
ariaDescribedBy(hintId, errorId);
ariaControls(panelId);
joinIds(a, null, false, '  ', b); // "a b"
```

Falsy and blank tokens are dropped so optional ids do not leave extra spaces
or empty attributes.

## Size

`@texuli/core/ids` measures 686 B gzip (`pnpm size`, 2026-10-24), within the
4 KiB budget for a texel subpath. The `@texuli/core` root barrel, which re-exports every texel, measures 22,972 B of its 24,576 B budget.
It is a small pure TypeScript surface with no dependencies.
