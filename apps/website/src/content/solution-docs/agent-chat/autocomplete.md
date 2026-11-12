## Composer autocomplete

Pass `suggestions` to the composer or the thread. In development: added after `0.17.4`, not in a published release yet.

- `mentionSuggestions(people)` uses the `@` trigger and inserts a mention token.
- `commandSuggestions(commands)` uses the `/` trigger at the start of a line.
- Any other source is `{ trigger, label, search }`.

The list follows the APG combobox list-autocomplete pattern: arrows choose, Enter or Tab inserts, and Escape closes. Emoji autocomplete arrives with Texuli Emojis.

```ts
import { commandSuggestions, mentionSuggestions } from '@texuli/chat';

const suggestions = [
  mentionSuggestions([{ id: 'jordan', name: 'Jordan Lee' }]),
  commandSuggestions([{ name: 'report', description: 'Build the weekly report' }]),
];
```
