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
The built-in composer has no mention picker yet (planned).

`TypingIndicator` accepts a readonly list of names. Its polite status region is
empty when no one is typing and announces one, two, or several people otherwise.
Pass `labels` callbacks to localize those messages and `showLabel` to make the
message visible next to the decorative dots.

Run `pnpm vitest run packages/chat/tests/components.test.ts` for interaction
coverage, `pnpm vitest run packages/examples/tests/examples-render.test.ts` for
the example, and `TEXULI_E2E_PORT=4860 pnpm exec playwright test
tests/e2e/chat.spec.ts --project chromium` for its browser and axe
check.
