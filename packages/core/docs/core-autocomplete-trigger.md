# Core autocomplete trigger

> **Status: in development.** Added in PLAN_023 (T-cmp-chat); not yet in a
> published release.

`@texuli/core/autocomplete-trigger` is the framework-free half of inline
autocomplete in a text field (`@mention`, `/command`, `:emoji`). The
functions are pure and bounded, and they never throw.

```ts
import {
  applyAutocomplete,
  autocompleteKeyAction,
  findAutocompleteTrigger,
  moveAutocompleteActive,
} from '@texuli/core/autocomplete-trigger';

const match = findAutocompleteTrigger(text, caret, [{ char: '@' }, { char: '/', lineStart: true }]);
if (match) ({ text, caret } = applyAutocomplete(text, match, '@[Jordan](mention:jordan)'));
```

## Exports

- **`findAutocompleteTrigger(text, caret, triggers)`** returns
  `{ trigger, query, start, end }`, or `null`. A trigger counts when:
  - it starts the text, or follows whitespace or opening punctuation;
  - with `lineStart`, it starts a line;
  - the query up to the caret has no whitespace;
  - the query stays within `minQuery` and `maxQuery` (32 by default, at most 64).

  The scan looks back at most `maxQuery` characters.
- **`applyAutocomplete(text, match, insertion)`** replaces the trigger and query,
  adds one space unless whitespace follows, and returns `{ text, caret }`.
- **`autocompleteKeyAction(key, modifiers)`** maps keys for an open list (the APG
  combobox, list autocomplete):
  - Down and Up move;
  - Enter and Tab accept;
  - Escape closes;
  - Page Up and Page Down jump to the first and last option;
  - everything else (Home and End included) stays with the field.
- **`moveAutocompleteActive(active, count, action)`** returns the next active
  index, wrapping; it is -1 when there are no options.

`@texuli/chat`'s `Composer` builds its `suggestions` on these functions
([chat-composer](../../chat/docs/chat-composer.md)).
