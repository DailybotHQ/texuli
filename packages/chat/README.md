# @texuli/chat

Chat interfaces for Svelte 5: a conversation thread, a virtualized message
list, a composer and a typing indicator, generic enough for conversations
between people or between a person and an agent. It handles message
grouping, date separators, streamed agent replies and screen-reader
announcements, and it renders message text without ever injecting HTML. It
is part of [Texuli](https://texuli.com), "Small pieces. Infinite
possibilities.": an MIT Svelte 5 component library by Dailybot, Inc.

> **Status: 0.x release.** `@texuli/chat` is published on npm as `0.4.0`, a
> pre-1.0 release (1.0.0 will be the first stable release). Under 0.x, a new
> minor (`0.5.0`) may contain breaking changes, so pin the exact version or
> use `^0.4.0`, which accepts only 0.4.x.

## Install

```sh
npm install @texuli/chat @texuli/tokens svelte
```

- `svelte` (^5.57.2) is a peer dependency.
- The components style themselves with the Texuli `--tx-*` design tokens.
  Import the token stylesheet once in your app (installing `@texuli/tokens`
  directly lets your bundler resolve it).

```css
@import '@texuli/tokens/base.css';
```

## Quick start

```svelte
<script lang="ts">
  import { ChatThread, type ChatMessage } from '@texuli/chat';

  const me = { id: 'u-1', name: 'Ada' };
  const agent = { id: 'agent', name: 'Helper' };

  let messages = $state<ChatMessage[]>([
    { id: 'm1', author: agent, body: 'Hi! How can I help?', at: '2026-01-05T09:00:00Z' },
  ]);

  function send(body: string) {
    messages = [...messages, { id: crypto.randomUUID(), author: me, body, at: new Date() }];
  }
</script>

<ChatThread {messages} currentUserId="u-1" onSend={send} label="Support chat" />
```

`ChatThread` combines the message list with the built-in composer; omit
`onSend` for a read-only thread, or pass a `composer` snippet to supply your
own input chrome.

### Streaming an agent reply

`applyChatStreamEvent(messages, event)` folds `start`, `delta`, `end` and
`error` events into the message list immutably:

```ts
import { applyChatStreamEvent } from '@texuli/chat';

messages = applyChatStreamEvent(messages, { type: 'start', id: 'r1', author: agent, at: new Date() });
messages = applyChatStreamEvent(messages, { type: 'delta', id: 'r1', text: 'Checking your order' });
messages = applyChatStreamEvent(messages, { type: 'end', id: 'r1' });
```

While a message streams it shows a caret; its partial text stays out of the
live region and is announced once, when it finishes.

## What's inside

Everything is exported from the package root, `@texuli/chat`:

| Export | What it does |
| --- | --- |
| `ChatThread` | The full conversation view: message list plus composer, typing indicator and header slots |
| `MessageList` | The message log on its own: grouping, date separators, avatars, timestamps, status, virtualization, per-message actions, inline edit and jump to latest |
| `Composer` | Message input: Enter to send, Shift+Enter for a new line, auto-growing, with attachments, actions, a key hook, pending states and Stop for a streaming reply |
| `TypingIndicator` | Localized "is typing" labels for one or more authors |
| `ChatThreadDisplay`, `ChatMessageDisplay` | A static transcript view (no composer, no live region) for rendering saved or generated conversations |
| `CHAT_DISPLAY_LOADERS` | Loaders that map the display components for a `@texuli/player` host |
| `applyChatStreamEvent` | Folds streamed reply events into a message list |
| `groupMessages`, `parseMessageText`, `messageTokens` | The grouping and text-parsing helpers behind the list |

## Key guarantees

- **No HTML sinks.** Message bodies support a small text format (`**strong**`,
  `*emphasis*`, backtick code and `[label](https://example.com)` links), and
  it renders as Svelte text nodes, never as HTML.
- **URL policy on links.** Link destinations pass the Texuli URL policy at
  the `untrusted` tier; a rejected link stays visible as literal text.
- **Closed inline tokens.** Mentions (`@[Name](mention:id)`), dates
  (`[[date:ISO]]`) and status chips (`[[status:tone|Label]]`) are parsed
  against strict patterns; anything that fails a check stays literal text.
  Mentions are display-only and do not notify anyone.
- **Screen-reader friendly.** The list is a polite live log, streamed replies
  are announced once on completion, and the list, thread and composer take
  translatable `labels`.
- **Input-method safe.** The composer ignores Enter while an input method
  editor is composing, and async submissions prevent duplicate sends.
- **Scales to long threads.** The list virtualizes from 100 messages with
  measured row heights, and keeps your place when older history is
  prepended.

## Unreleased (prepared for 0.5.0, not on npm yet)

In the repository, not in the `0.4.0` tarball:

- `Composer`: `streaming` with `onStop` (a Stop button and Escape), an
  `onkeydown` hook that runs before the built-in keys, and an `actions`
  snippet ([chat-composer](https://github.com/DailybotHQ/texuli/blob/main/packages/chat/docs/chat-composer.md)).
- `MessageList`: per-message `actions`, inline edit with `onEdit`, and a
  bottom-anchored scroll with "Jump to latest"
  ([chat-thread](https://github.com/DailybotHQ/texuli/blob/main/packages/chat/docs/chat-thread.md)). `ChatThread` forwards all
  of these.

## Not yet available

These are planned and do not work today: a mention picker in the built-in
composer, and localized role labels in the transcript display components
(they are English only for now).

## Documentation

- Site: [texuli.com](https://texuli.com) and the
  [live examples](https://texuli.com/examples/)
- Guides:
  [chat thread and message list](https://github.com/DailybotHQ/texuli/blob/main/packages/chat/docs/chat-thread.md),
  [composer and typing indicator](https://github.com/DailybotHQ/texuli/blob/main/packages/chat/docs/chat-composer.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-chat).
