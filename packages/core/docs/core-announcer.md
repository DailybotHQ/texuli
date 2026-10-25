# Texel: live-region announcer

**Package:** `@texuli/core`  
**Path:** `packages/core/src/announcer/`  
**Task:** T-core-announcer

One **polite** and one **assertive** live region per document. Announcements are
debounced, deduplicated, written with `textContent` only, and registered as
**inert exemptions** so status text still reaches assistive technology under
modals (R16).

## API

```ts
import {
  createAnnouncer,
  getAnnouncer,
  resetAnnouncer,
  type Announcer,
} from '@texuli/core';

const announcer = createAnnouncer({ document });
announcer.announce('Saved');
announcer.announce('Upload failed', 'assertive');
announcer.announce('Now', { politeness: 'polite', immediate: true });

announcer.clear();
announcer.destroy();
```

| Export | Role |
| --- | --- |
| `createAnnouncer({ document, … })` | Isolated announcer for one document |
| `getAnnouncer(document, options?, global?)` | Page-wide instance per document |
| `resetAnnouncer(document?, global?)` | Destroy shared instance (tests) |
| `ANNOUNCER_GLOBAL_KEY` | `__TEXULI_ANNOUNCER_V1__` |
| `ANNOUNCER_REGION_ATTR` | `data-texuli-announcer` on region nodes |
| `createLiveRegion` / `appendRegion` | Low-level region node helpers |

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `document` | required | Owner document (no import-time DOM) |
| `appendTo` | `document.body` | Parent for the region nodes |
| `politeDebounceMs` | `150` | Debounce for polite messages |
| `assertiveDebounceMs` | `50` | Debounce for assertive messages |
| `dedupeMs` | `1000` | Skip identical message on the same region within this window (`0` = off) |
| `inertRegistry` | page registry | Pass `null` to skip exemptions |
| `clock` | document timers | Inject for tests |

## Behavior

- **Two regions.** Polite: `role="status"` + `aria-live="polite"`. Assertive:
  `role="alert"` + `aria-live="assertive"`. Both use `aria-atomic="true"`.
- **Visually hidden** with clipped 1×1 CSS (logical `inline-size` /
  `block-size`). Not `display: none`, not `aria-hidden`.
- **Debounce** per politeness keeps the last queued string.
- **Dedupe** skips the same string on the same region inside `dedupeMs`.
- **Re-announce** clears `textContent`, then writes after a short gap so
  repeated phrases after the dedupe window are heard again.
- **No HTML.** Messages go through `textContent` only.
- **Inert exemption.** On first ensure/announce, both nodes call
  `inertRegistry.exempt({ element, label: 'announcer:polite' | 'announcer:assertive' })`.
  `destroy()` releases them.
- **SSR-safe.** Nothing runs at import time; the document is always passed in.

## With modals

```ts
import { createAnnouncer, getInertRegistry } from '@texuli/core';

const announcer = createAnnouncer({ document });
announcer.ensure(); // regions exist + exempt before the modal opens

const scope = getInertRegistry().inertOutside(dialogEl);
announcer.announce('Changes saved');
// …

scope.release();
```

## Testing

```bash
pnpm vitest run packages/core/tests/announcer.test.ts
```

## Size

`@texuli/core/announcer` measures 2,774 B gzip (`pnpm size`, 2026-10-24), within the
4 KiB budget for a texel subpath. The `@texuli/core` root barrel, which re-exports every texel, measures 22,972 B of its 24,576 B budget.
Prefer one page-wide announcer via
`getAnnouncer` so islands share regions.
