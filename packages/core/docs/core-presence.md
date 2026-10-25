# Core presence — mount until exit motion ends

**Package:** `@texuli/core`  
**Source:** `packages/core/src/presence/presence.ts`  
**Tests:** `packages/core/tests/presence.test.ts`

## Contract

Presence keeps a node **mounted** after the caller sets `present` to `false`
until its CSS **transition** or **animation** ends, then signals exit complete
so a framework binding can unmount. Reduced motion and explicit skip flags
finish exit on the next animation frame without waiting.

- Framework-free TypeScript. The controller takes its element via `setNode`.
- `data-state` is `"open"` while present and `"closed"` while exiting or hidden.
- No `window` / `document` access at import time. Media queries use a supplied
  window or the attached node's owner window (`matchesMedia` from the env texel).

## API

| Export | Role |
| --- | --- |
| `createPresence(options?)` | Presence machine: `setPresent`, `setNode`, `completeExit`, `syncAttributes`, `dispose` |
| `prefersReducedMotion(ownerWindow?, ssrDefault?)` | Reads `(prefers-reduced-motion: reduce)` |
| `hasPendingMotion(element)` | Non-zero CSS transition/animation duration (+ delay) |
| `parseCssTimeList(value)` | `"0.2s, 100ms"` → milliseconds |
| `PRESENCE_STATE_ATTR` | `"data-state"` |
| `REDUCED_MOTION_QUERY` | `"(prefers-reduced-motion: reduce)"` |
| `type PresenceSnapshot` | `{ present, mounted, state, exiting }` |
| `type PresenceState` | `"open" \| "closed"` |

### Options

```ts
createPresence({
  present?: boolean;           // default false
  forceMount?: boolean;        // stay mounted after exit; data-state still closes
  skipExitAnimation?: boolean; // never wait for CSS motion
  reducedMotion?: boolean;     // force on/off; omit to read the OS preference
  ownerWindow?: Window-like;   // media + rAF host before a node is attached
  isMotionPending?: (el) => boolean; // default hasPendingMotion; tests may stub
  onSnapshot?: (s) => void;
  onEnter?: (s) => void;
  onExitComplete?: (s) => void;
});
```

### Snapshot

| Field | Meaning |
| --- | --- |
| `present` | Last intent from `setPresent` |
| `mounted` | Keep the node in the DOM |
| `state` | Value for `data-state` (`open` / `closed`) |
| `exiting` | Waiting for exit motion (or the skip frame) |

## Usage

```ts
import { createPresence } from '@texuli/core';

const presence = createPresence({
  present: open,
  onExitComplete: () => {
    // Framework binding: drop the node when snapshot.mounted is false.
  },
});

// After mount:
presence.setNode(panelElement);
// CSS: [data-state=open] { …enter… } [data-state=closed] { …exit… }

presence.setPresent(false);
// → data-state="closed", mounted stays true until transitionend/animationend
// → onExitComplete, mounted=false (unless forceMount)
```

### Reduced motion

Exit waits are skipped when:

1. `skipExitAnimation: true`, or
2. `reducedMotion: true`, or
3. `reducedMotion` is omitted and the owner window matches
   `prefers-reduced-motion: reduce`, or
4. `hasPendingMotion(node)` is false (no duration).

In those cases exit still sets `data-state="closed"`, then completes on the
next animation frame so one closed style frame can paint.

### Re-open during exit

`setPresent(true)` while `exiting` cancels the wait, sets `data-state="open"`,
and fires `onEnter` again.

## Size

`@texuli/core/presence` measures 1,527 B gzip (`pnpm size`, 2026-10-24), within the
4 KiB budget for a texel subpath. The `@texuli/core` root barrel, which re-exports every texel, measures 22,972 B of its 24,576 B budget.
Presence builds
on the env texel (`listen`, `matchesMedia`, `requestFrame`, `getOwnerWindow`).
