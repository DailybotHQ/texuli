# Direction, locale and messages

`@texuli/core` provides small, framework-free helpers shared by controls and
other packages. Direction reads are explicit: pass the element or document
whose `dir` context should be used. No global DOM object is read at module
import time.

```ts
import {
  compareLocale,
  directionOf,
  inlineSideToPhysical,
  resolveMessages,
} from '@texuli/core';

const direction = directionOf(button); // nearest `dir`, defaulting to `ltr`
const closeSide = inlineSideToPhysical('start', direction);
const compare = compareLocale('item 2', 'item 10', 'en'); // negative
const messages = resolveMessages({ close: 'Cerrar', next: 'Siguiente' });
```

## Direction

`directionOf(target, fallback?)` walks from an `Element` through its ancestors
and, for shadow trees, through the host. For a `Document`, it starts at the
document element. The nearest case-insensitive `dir="ltr"` or `dir="rtl"`
wins; empty and invalid values inherit. `dir="auto"` uses computed browser
direction when available and inherits on the server. When no direction is
found the default is `ltr`, or the explicit fallback.

`inlineSideToPhysical('start' | 'end', direction)` maps only horizontal inline
sides: in LTR, start is left and end is right; in RTL, start is right and end
is left. It does not infer writing mode or map block sides.

## Locale comparison

`createCollator(locale, options?)` returns an `Intl.Collator` for reuse. Its
default options enable numeric comparison and ignore case and accents
(`sensitivity: 'base'`). `compareLocale(left, right, locale, options?)` is the
one-off form. Both require an explicit locale, so callers do not accidentally
depend on the user's machine locale. Invalid locales follow the platform's
`Intl.Collator` behavior and throw `RangeError`.

## Translatable labels

`TexuliMessages` names the labels used by built-in controls, and
`DEFAULT_MESSAGES` contains their English defaults. Pass a partial translation
to `resolveMessages`; missing or `undefined` values use English. Empty strings
are preserved so a caller can intentionally supply an empty label, though
interactive controls should generally keep a meaningful accessible name.

These helpers do not set an element's `dir` or `lang`, change global locale,
or translate application-authored content. Components remain responsible for
applying the resolved labels to their visible and accessible text.
