# Roving focus and typeahead

Composite widgets (toolbars, tabs, listboxes, menus, radio groups) put one item
in the tab order and move focus among the rest with the keyboard. This texel
does the bookkeeping. It is framework-free: every function takes its elements
explicitly, and the controller attaches no listeners of its own.

```ts
import { createRovingFocus, listen } from '@texuli/core';

const toolbar = document.querySelector<HTMLElement>('[role="toolbar"]')!;
const roving = createRovingFocus({
  items: () => [...toolbar.querySelectorAll<HTMLElement>('button')],
  orientation: 'horizontal',
  direction: toolbar, // read with directionOf: ArrowLeft moves forward in RTL
  typeahead: true,
});

roving.sync(); // the first enabled item gets tabindex="0", the rest "-1"
const stopKeys = listen(toolbar, 'keydown', (event) => roving.handleKeydown(event as KeyboardEvent));
const stopFocus = listen(toolbar, 'focusin', (event) => roving.handleFocusIn(event));
// call roving.sync() after items are added, removed or disabled
```

## The controller

`createRovingFocus(options)` returns `{ active, setActive, handleKeydown, handleFocusIn, sync }`.

| Option | Default | Meaning |
| --- | --- | --- |
| `items` | required | The items in visual order, read on every key, so the list may change |
| `orientation` | required | `horizontal` (ArrowLeft and ArrowRight), `vertical` (ArrowUp and ArrowDown) or `both` |
| `direction` | `ltr` | `'ltr'`, `'rtl'`, or an element whose direction `directionOf` reads on each key |
| `wrap` | `true` | Past the last item go to the first, and back |
| `homeEnd` | `true` | Home and End move to the first and last enabled item |
| `pageKeys` / `pageSize` | `false` / 10 | PageDown and PageUp move a page and clamp at the ends |
| `focusDisabled` | `false` | Let disabled items take focus (some menus do, so users can find them) |
| `typeahead` | off | `true`, or `{ timeout, now }`: typed characters move to the matching item |
| `onActiveChange` | — | Called with `(index, item)` after the active item changes |

- **`handleKeydown(event)`** moves focus and returns `true`, calling
  `preventDefault`, when the key navigated or typeahead matched. Otherwise it
  returns `false` and leaves the event alone. It reuses the keyboard model:
  composing keys and chords with Ctrl, Meta or Alt never move.
- **`handleFocusIn(event)`** makes a focused item active, so clicks and Tab
  keep the tab stop right.
- **`sync()`** re-applies tabindex: it keeps the active item when it is still
  enabled, else moves to the first enabled one. With no enabled item, nothing
  is in the tab order. It never moves focus.
- **`setActive(index, { focus })`** activates an item, focusing it unless
  `focus: false`.

An item is disabled when it has `disabled`, `aria-disabled="true"` or `hidden`
(`isItemDisabled`). Disabled items are skipped by arrows, Home and End, pages
and typeahead, unless `focusDisabled` is set.

## Index math

`stepRovingIndex(count, from, intent, { wrap, pageSize, enabled })` is the pure
core: the index an intent (`next`, `previous`, `first`, `last`, `page-next`,
`page-previous`) moves to, or -1 when no item is enabled.

- From -1 (nothing active), `next` starts at the first item and `previous` at
  the last.
- `wrap: false` returns -1 at the ends, so the caller stays put.
- A page lands on the nearest enabled item at or before its target, still
  moving away from `from`. Failing that it takes the nearest one past the
  target, and otherwise stays.

`setRovingTabIndex(items, active)` gives one item `tabindex="0"` and the rest
`-1`.

## Typeahead

`createTypeahead({ timeout = 500, now })` returns `{ buffer, match, reset }`.
`match(event, labels, current, enabled?)` returns the matched index or -1.

- **Search:** characters typed within `timeout` milliseconds build one search.
  It finds the first label, from the current item on, that starts with the
  search, ignoring case. A longer search may keep the current item when it
  still matches.
- **Cycling:** repeating one letter (`b`, `b`, `b`) cycles through the items
  starting with it, wrapping at the end.
- **Space:** joins words (`New f`) once a search has started. A first Space is
  not a search, so it stays free to activate the item.
- **Ignored keys:** keys that are not one character, chords with Ctrl, Meta or
  Alt, composing events and disabled items never match.
- **Labels:** in the controller an item's label is its `data-typeahead`
  attribute, else its trimmed text (`typeaheadLabel`).
- **Clock:** `now` defaults to `performance.now()`. Pass a clock to make tests
  deterministic.

## Limits

- Matching is a case-insensitive prefix match on the label as written. It does
  not fold accents (`é` does not match `e`) and has no fuzzy search.
- The controller tracks one active item. Multi-selection and grid
  two-dimensional movement (rows and columns) are left to the widget, which
  can use `stepRovingIndex` per axis.

## Size

Measured by `pnpm size` (gzip -9) on 2026-10-24, `@texuli/core/roving` is
2,416 B, within the 4 KiB budget for a texel; most of that is the keyboard and
direction code it shares with the rest of core. The `@texuli/core` root barrel
is 22,972 B of its 24,576 B budget (this texel took it from 14.75 KiB to
15.81 KiB when it landed).

## The selected item is the tab stop (FIX-roving-selected)

In a single-selection widget (radio group, tabs, a single toggle group or
segmented control), WAI-ARIA APG puts the one tab stop on the **selected**
item, and on the first enabled item only when nothing is selected.

- `createRovingFocus({ selected: () => index })`: `sync()` picks the tab stop
  in this order:
  1. the focused item, so it never jumps away while the user navigates;
  2. the selected item;
  3. the last active item;
  4. the first enabled item.
- `indexOfSelected(items)` finds the item with `aria-checked`,
  `aria-selected` or `aria-pressed` set to `"true"`; pass it as `selected`.
- Call `sync()` when the selection changes. In `@texuli/primitives`, the
  `attachRovingFocus` binding and the RadioGroup and Tabs lists re-sync
  when those attributes change. That covers controlled values, uncontrolled
  values and clicks.

Before this fix, `sync()` at attach ran with no active item and made the
first enabled item the tab stop. It overwrote the component's own tabindex:
RadioGroup `value="team"` put the stop on "free", Tabs `value="b"` on "a".
Tests:
- `packages/core/tests/roving.test.ts`;
- `packages/primitives/tests/composites.test.ts`;
- `packages/texuli/tests/forms.test.ts`;
- the behavior rows `tab-stop-on-initial-value` and `tab-stop-follows-value`
  for radio-group and tabs.
