# Environment and SSR helpers

`@texuli/core` keeps environment-sensitive behavior out of module initialization.
Importing the package is safe during server rendering; browser globals are read
only by `isBrowser()` when called.

```ts
import {
  getOwnerDocument,
  getOwnerWindow,
  isBrowser,
  listen,
  matchesMedia,
  requestFrame,
} from '@texuli/core';

if (isBrowser()) {
  const dispose = listen(window, 'resize', onResize, { passive: true });
  // Call dispose from the component's onDestroy/onMount cleanup.
}

const view = getOwnerWindow(trigger);
const reduceMotion = matchesMedia('(prefers-reduced-motion: reduce)', view);
const cancelFrame = requestFrame(update, view);
```

## Contracts

- `isBrowser()` checks for both `window` and `document` at call time.
- `getOwnerDocument(node)` and `getOwnerWindow(node)` follow the node's own
  browsing context, including nodes from an iframe. Missing owners return
  `undefined`.
- `listen(target, type, listener, options)` accepts a nullable target and
  returns an idempotent disposer. A missing target produces a no-op disposer,
  which is safe to create before a Svelte `onMount` callback has a target.
- `matchesMedia(query, ownerWindow, ssrDefault)` calls the supplied window's
  `matchMedia`. It returns `false` by default on the server; pass `true` as the
  third argument when the feature should be enabled in the SSR output.
- `requestFrame(callback, ownerWindow)` uses that window's animation frame API
  when available. Otherwise it schedules a 16 ms timeout. Both paths return a
  cleanup function that cancels pending work.

Every environment-dependent function takes its owner explicitly, except
`isBrowser()`, which performs a guarded global check only when invoked. None of
the helpers reads `window` or `document` when the module is imported.
