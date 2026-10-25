# Keyboard model

`@texuli/core` normalizes key handling for every widget and turns shortcuts
into data. Everything is framework-free and pure: functions take the event,
the direction or the platform explicitly and never read `window`, `document`
or `navigator`.

```ts
import {
  createShortcutMap,
  detectPlatform,
  directionOf,
  getNavigationIntent,
  isActivationKey,
  isTextEntryTarget,
} from '@texuli/core';

function onKeydown(event: KeyboardEvent, tablist: HTMLElement) {
  if (isActivationKey(event)) return activate();
  const intent = getNavigationIntent(event, {
    orientation: 'horizontal',
    direction: directionOf(tablist), // ArrowLeft moves forward in RTL
  });
  if (intent) {
    event.preventDefault();
    move(intent); // 'next' | 'previous' | 'first' | 'last' | 'page-next' | 'page-previous'
  }
}

const shortcuts = createShortcutMap(
  [
    { id: 'palette', keys: ['Mod+K', 'Mod+P'] },
    { id: 'help', keys: '?' },
  ],
  detectPlatform(navigator) // call from an event or effect, never at import
);

document.addEventListener('keydown', (event) => {
  const id = shortcuts.match(event);
  if (id === 'help' && isTextEntryTarget(event.target)) return; // a bare "?" types text there
  if (id) run(id);
});

shortcuts.describe('palette'); // ['⌘K', '⌘P'] on mac, ['Ctrl+K', 'Ctrl+P'] elsewhere
shortcuts.ariaKeyShortcuts('palette'); // 'Meta+K Meta+P' for aria-keyshortcuts
```

## Keys

- **`normalizeKey(key)`** maps legacy and alternative `KeyboardEvent.key`
  values to the current names: `Esc` → `Escape`, `Left` → `ArrowLeft`,
  `Del` → `Delete`. The space bar is always `Space` (never `' '`), and a single
  letter is lowercased. Other characters and named keys pass through.
- **`isComposing(event)`** is true while an input method editor composes text.
  It uses `isComposing`, Safari's `keyCode` 229 (reported before `isComposing`
  turns true) and the `Process` key. Enter then confirms a candidate and arrows
  move inside the composition, so every helper below ignores these events.
- **`isActivationKey(event, which?)`** is Enter or Space without Ctrl, Meta or
  Alt and outside composition. `which` narrows it to `'Enter'` (links) or
  `'Space'` (checkboxes, switches). Shift is allowed.
- **`hasCommandModifier(event)`** is true when Ctrl, Meta or Alt is held.

## Navigation and direction

`getNavigationIntent(event, options)` returns what a key asks a composite
widget to do, or `null`:

| Key | `horizontal` | `vertical` | `both` |
| --- | --- | --- | --- |
| ArrowRight (ArrowLeft in RTL) | `next` | — | `next` |
| ArrowLeft (ArrowRight in RTL) | `previous` | — | `previous` |
| ArrowDown | — | `next` | `next` |
| ArrowUp | — | `previous` | `previous` |
| Home, End | `first`, `last` | same | same |
| PageDown, PageUp (with `pageKeys: true`) | `page-next`, `page-previous` | same | same |

- `direction` (`'ltr'` by default) flips only the horizontal arrows. Read it
  with `directionOf(element)`, which honors the nearest `dir`.
- `homeEnd` is on by default; `pageKeys` is off by default, because only long
  lists and grids page.
- A key held with Ctrl, Meta or Alt never navigates: those chords belong to
  the platform (for example ⌘← on macOS). Shift passes through, and the caller
  decides whether it extends a selection.
- `flipArrowForDirection(key, direction)` is the underlying swap, for widgets
  that need the logical arrow itself.

`isTextEntryTarget(target)` is true for text-like `<input>` types,
`<textarea>`, `<select>`, `contenteditable` (unless `"false"`) and the
`textbox`, `searchbox` and `combobox` roles. Single-key shortcuts should not
fire there. Buttons, checkboxes, ranges and other non-text inputs are not text
entry.

## Shortcuts

A shortcut is a string of modifiers and one key joined by `+`. Case does not
matter.

| Part | Meaning |
| --- | --- |
| `Mod` | The command key: Meta (⌘) on macOS, iOS and iPadOS; Ctrl elsewhere |
| `Ctrl` / `Control`, `Meta` / `Cmd` / `Command`, `Alt` / `Option` / `Opt`, `Shift` | That specific key |
| Last part | One character, or a key name: `Enter` (`Return`), `Escape` (`Esc`), `Space`, `Tab`, `Backspace`, `Delete` (`Del`), `Insert`, `Home`, `End`, `PageUp`, `PageDown`, `ArrowUp` (`Up`)…, `ContextMenu`, `F1`–`F24`, `Plus` for `+` |

- **`parseShortcut(text)`** returns the key and modifier flags, and throws a
  `RangeError` for an empty part, an unknown modifier or key, a repeated
  modifier or a missing key. **`resolveShortcut(text, platform)`** turns
  `Mod` into Meta or Ctrl.
- **`detectPlatform(source)`** returns `'mac'` for macOS, iOS and iPadOS and
  `'other'` otherwise. It reads only the navigator fields you pass
  (`userAgentData.platform`, `platform`, `userAgent`); without one it returns
  `'other'`.
- **`matchesShortcut(event, shortcut, platform, { allowRepeat? })`** requires
  exactly the written modifiers (`Mod+K` does not match ⌘⇧K). Two allowances
  keep shortcuts working on real keyboards:
  - A symbol written without `Shift` (`?`, `/`) ignores Shift, because many
    layouts need Shift to type it. Letters stay strict: `k` is not Shift+K.
  - When the typed character differs from the key (⌥K types `˚` on macOS, or a
    Cyrillic layout types `л`), a letter or digit falls back to the physical
    key in `event.code`.

  Composing events and auto-repeats never match, unless `allowRepeat` is set.
- **`createShortcutMap(bindings, platform)`** compiles `{ id, keys }` bindings
  once. Two bindings that resolve to the same chord on that platform throw a
  `RangeError` naming both, as do a repeated id or a binding with no keys. So
  conflicts surface when the map is built, not when a key is pressed. `match`
  returns the first matching id, `describe(id, style?)` formats each
  alternative, and `ariaKeyShortcuts(id)` returns the attribute value.
- **`formatShortcut(text, platform, style?)`** follows the platform
  convention.
  - `symbols` (the default): on mac, ⌃⌥⇧⌘ in that order with no separator
    (`⌘⇧K`); elsewhere `Ctrl+Shift+K`.
  - `text`: `Cmd+Shift+K` on mac.

  Arrows, Enter, Backspace and Tab have symbols. These labels are key names,
  not translatable words.
- **`ariaKeyShortcuts(text, platform)`** gives the WAI-ARIA token
  (`Control+Shift+K`, `Shift+Meta+K`, `Control+Plus`). Put it on the control
  that the shortcut triggers.

## Limits

- Shortcuts are single chords. Sequences such as `g then m` are left to the
  caller.
- Keys are matched by `KeyboardEvent.key`, with an `event.code` fallback for
  letters and digits only. Symbols on non-US layouts match by the character
  they type.
- The platform is the caller's choice. These helpers never sniff `navigator`
  on their own, so server rendering and tests stay deterministic.

## Size

Measured with `pnpm size` (gzip -9) on 2026-10-24:

- `@texuli/core/keyboard` is 2,662 B, within the 4 KiB budget for a texel.
- The `@texuli/core` root barrel, which re-exports every texel, is 22,972 B
  of its 24,576 B budget. When this texel landed it grew the barrel from
  5,623 B to 7,934 B.
- Importing only a few functions tree-shakes the rest.
