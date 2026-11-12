# Chat composer and typing indicator

`@texuli/chat` exports `Composer` and `TypingIndicator` from its package entry.

`Composer` binds a string draft through `value`, calls `onSubmit` with trimmed
message text on Enter or form submission, and keeps Shift+Enter available for
newlines. It ignores Enter while an input method editor is composing. The
textarea grows up to `maxRows` (default 6); `maxLength`, `disabled`, and
externally controlled `sending` are optional. The `attachments` snippet renders
custom file, emoji, or other actions beside the send button.

An async submission sets its own pending state and prevents duplicate sends.
Returning `false` keeps the draft; rejecting also keeps it and announces the
localized `labels.sendError`. Unexpected exception details are not shown.
Successful sends clear the draft. Override any `ComposerLabels` field for
translated input, placeholder, keyboard hint, send, pending, and error text.

The draft is kept on every failure: a handler that returns `false` (or
resolves to `false`) keeps it silently, and a handler that throws or
rejects keeps it and shows the error. Only a handler that completes with any
other value clears the field. This contract is unchanged since the first
release.

## Row layout and icon-only send (UG-41)

- `layout="row"` keeps the composer on one row: the field first, then the
  attachments and the send or stop button inline after it (the visual order
  follows the DOM and focus order). A send error wraps onto its own line.
  The default, `layout="stack"` (or no `layout`), keeps the actions row under
  the field, and the form then carries no `data-layout` attribute.
- `sendButton="icon"` draws a square, icon-only send button (an arrow glyph,
  `aria-hidden`). Its accessible name is still `labels.send` ("Send
  message"), rendered as visually hidden text, so a translated
  `ComposerLabels` names it; while a send is pending it is named
  `labels.sending`. For another glyph, render a custom send in the `actions`
  snippet and call its `submit`.

```svelte
<Composer layout="row" sendButton="icon" onSubmit={send} />
```

## `ref` and other attributes

`Composer`'s `bind:ref` is its root `form`; `id`, `aria-*`, `data-*`,
`style` and handlers land there. A caller `onsubmit` runs first and the
composer's own submit always runs after it. `onkeydown` is the exception: it
reaches the textarea (see below). `TypingIndicator`'s `bind:ref` is its
status element, which takes the same attributes. Both are covered by the
uniform contract test (`packages/chat/tests/contract.test.ts`).

## Streaming stop, key hook and actions (G32)

- `streaming` marks a running reply. With `onStop`, the send button becomes
  a Stop button named by `labels.stop` ("Stop generating", with
  `aria-keyshortcuts="Escape"`), and Escape in the field calls `onStop`
  too. Focus stays in the field after a stop. Enter does not send while
  `streaming` is true; the field stays editable so the next message can be
  drafted.
- `onkeydown` runs before the built-in keys (Enter to send, Escape to
  stop). Call `event.preventDefault()` to take a key over, for example to
  drive a suggestion list or message history; otherwise the built-in
  handling still runs.
- The `actions` snippet renders just before the send or stop button, for
  a model choice or a custom control. It receives a `ComposerActionContext`:
  `canSend`, `busy`, `streaming`, `submit()` and `stop()`.

`ChatThread` forwards `streaming` and `onStop` to its built-in composer.

## Host composer chrome (G21 contract)

The composer is host chrome: it belongs to the application, never to
message or blueprint content. `ChatThread` accepts a `composer` snippet that
replaces the built-in composer. It renders after the message log, outside
it, in `[data-tx-chat-composer="host"]`; the built-in composer carries
`data-tx-chat-composer="built-in"`. `composerLabels` localizes the built-in
composer.

A host composer that offers mentions, dates or status chips inserts the
strings from `messageTokens.mention(name, id)`, `messageTokens.date(value)`
and `messageTokens.status(tone, label)`. They drop characters that would end
a token early, and they return `null` for input that would not parse back.
The built-in composer reads them with inline autocomplete (below).

## Inline autocomplete: mentions, commands and emoji (PLAN_023)

`suggestions` takes one source per trigger character. Typing the trigger at a
word start (or, for a `lineStart` source, at the start of a line) opens a
listbox under the field. It follows the APG combobox list-autocomplete
pattern on the field itself:

- the field has `aria-autocomplete="list"`, and while the list is open it
  points `aria-controls` at the listbox and `aria-activedescendant` at the
  active option;
- Up and Down move the active option (wrapping), Enter or Tab inserts it,
  Escape closes the list and keeps it closed for that trigger;
- a click inserts without moving focus out of the field;
- a polite status announces how many options are open (`labels.suggestions`,
  with `{count}`).

Enter sends only when no list is open.

```svelte
<script lang="ts">
import { Composer, commandSuggestions, mentionSuggestions } from '@texuli/chat';

const suggestions = [
  mentionSuggestions([{ id: 'jordan', name: 'Jordan Lee', description: 'Support lead' }]),
  commandSuggestions([{ name: 'summarize', description: 'Summarize this thread' }]),
];
</script>

<Composer onSubmit={send} {suggestions} />
```

- `mentionSuggestions(people)` uses the `@` trigger. It inserts the mention
  token `@[Name](mention:id)`, which messages render as a mention.
- `commandSuggestions(commands)` uses the `/` trigger, only at a line start,
  and inserts `/name`.
- Any other source is `{ trigger, label, search }`:
  - `search(query)` returns at most 8 `{ id, label, description?, glyph?, insert }`
    options, synchronously or as a promise; a late answer for an old query is
    dropped;
  - `glyph` is decorative.
- An emoji source (`:`) plugs in the same way. A ready-made emoji source from
  `texuli/emoji` is planned (PLAN_023, after T-emo-web).
- `ChatThread` forwards `suggestions` to its built-in composer.

The trigger logic is the framework-free texel
[`@texuli/core/autocomplete-trigger`](../../core/docs/core-autocomplete-trigger.md).

`TypingIndicator` accepts a readonly list of names. Its polite status region is
empty when no one is typing and announces one, two, or several people otherwise.
Pass `labels` callbacks to localize those messages and `showLabel` to make the
message visible next to the decorative dots.

Run `pnpm vitest run packages/chat/tests/components.test.ts` for interaction
coverage, `pnpm vitest run packages/examples/tests/examples-render.test.ts` for
the example, and `TEXULI_E2E_PORT=4860 pnpm exec playwright test
tests/e2e/chat.spec.ts --project chromium` for its browser and axe
check.
