# Texel: tabbable query

**Package:** `@texuli/core`  
**Path:** `packages/core/src/tabbable/`

Framework-free helpers that list focusable and tabbable elements under a root.
Texuli owns this code; there is no runtime dependency on `tabbable`.

## API

```ts
import {
  getFocusableElements,
  getTabbableElements,
  isFocusable,
  isTabbable,
  type TabbableOptions,
} from '@texuli/core';

isFocusable(element, options?): boolean
isTabbable(element, options?): boolean
getFocusableElements(root, options?): HTMLElement[]  // tree order
getTabbableElements(root, options?): HTMLElement[]   // sequential Tab order
```

`root` is an `Element` or `Document`. Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `includeContainer` | `false` | When `root` is an element, include it if it qualifies |
| `document` | `root.ownerDocument` | Where `getComputedStyle` runs |

Nothing reads `window` or `document` at import time; pass the root explicitly.

## Rules

An element is **focusable** when it is a candidate and not blocked:

- **Candidates:** `a[href]`, `area[href]`, `input` (not `hidden`), `select`,
  `textarea`, `button`, `iframe`, `object`, `embed`, `audio[controls]`,
  `video[controls]`, `summary`, anything with `tabindex`, `contenteditable`
  (true / empty / plaintext-only).
- **Blocked:** `disabled` form controls; descendants of a disabled `fieldset`
  outside its first `legend`; `hidden` on an ancestor; computed
  `display: none` or `visibility: hidden`; `inert` on an ancestor;
  `aria-hidden="true"` on an ancestor; content of a closed `<details>` other
  than its summary; `area` without a visible `img[usemap]`.

An element is **tabbable** when it is focusable, its `tabindex` is not
negative, and — for a named radio group — it is the single tab stop (the
checked radio, or the first enabled radio when none is checked).

`getTabbableElements` orders positive `tabindex` values ascending, then the
remaining tab stops in tree order. Open shadow roots are walked.

## Usage

```ts
const dialog = document.getElementById('dialog');
if (!dialog) throw new Error('missing dialog');

const stops = getTabbableElements(dialog);
const first = stops[0];
const last = stops[stops.length - 1];
first?.focus();
```

Focus scope and trap (a later texel) builds on this list for Tab cycling.

## Testing

```bash
pnpm vitest run packages/core/tests/tabbable.test.ts
```

Tests run in happy-dom and cover disabled/hidden/inert/aria-hidden, details,
fieldset + legend, radio groups, tabindex ordering, shadow roots, and
`includeContainer`.
