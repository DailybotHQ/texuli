# @texuli/chat

Chat interfaces for conversations between people, or between a person and an
agent: thread, message list, composer and typing indicator. The L4 domain
package composes `texuli` components, `@texuli/primitives` behavior and the
`@texuli/tokens` engine into Svelte 5 surfaces. Published to npm as `0.1.0-next.1` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## Status

Implemented in `src/` and exported from the package entry: `ChatThread`,
`MessageList` and `groupMessages` for the conversation view; `Composer` and
`TypingIndicator` for input. They are covered by 18 unit tests in 2 files
(`pnpm vitest run packages/chat`), with per-item notes in
[`docs/chat-thread.md`](docs/chat-thread.md) and
[`docs/chat-composer.md`](docs/chat-composer.md).

## Using the components

The package peers on Svelte 5 (`^5.57.2`); its `@texuli/*` dependencies are
workspace links.

```svelte
<script lang="ts">
  import { ChatThread, Composer, type ChatMessage } from '@texuli/chat';

  let messages: ChatMessage[] = [/* stable ids, author ids, body, dates */];
  let draft = '';
</script>

<ChatThread {messages} currentUserId="u-1" />
<Composer bind:value={draft} onSubmit={(text) => {}} />
```

## What the surfaces do today

- **`ChatThread` / `MessageList`.** Messages carry a stable id, author id and
  display name, body text and a date. Consecutive messages from one author
  group within five minutes; each local calendar day starts with a date
  separator. `currentUserId` controls own-message alignment; the list shows
  avatars, localized timestamps, status text, and a polite live log. It
  virtualizes from 100 messages with variable row measurements and five rows
  of overscan. `parseMessageText` splits body text into typed text parts,
  including the closed G21 inline nodes: mentions, dates and status chips.
  `composer` replaces the built-in composer with host-owned chrome.
- **Display components (G10).** `ChatThreadDisplay` and
  `ChatMessageDisplay` paint the player's `chat-thread` and `chat-message`
  ids as a static transcript: a labelled section, with one article per
  message showing author, role and time. Text goes through
  `parseMessageText`, and block children render under it. There is no
  composer or live region. `CHAT_DISPLAY_LOADERS` maps both ids for a
  `@texuli/player` host. Role labels are English only for now.
- **Streaming replies.** `applyChatStreamEvent(messages, event)` folds
  `start` / `delta` / `end` / `error` events into the message list. A message
  with `streaming: true` is busy and shows a caret; its partial text is
  hidden from the live log and announced once, when it finishes.
- **`Composer`.** Binds a string draft through `value`, submits trimmed text
  on Enter or form submission (Shift+Enter makes a newline), ignores Enter
  while an input method editor is composing, grows to `maxRows` (default 6),
  and supports `maxLength`, `disabled`, externally controlled `sending`, an
  `attachments` snippet, and async submissions that set pending state and
  prevent duplicate sends.
- **`TypingIndicator`.** Localized typing labels for one or more authors.

## Planned

Roadmap items not started as of 2026-10-24: moving the chat display
manifests into a catalog `chat` group, localized display role labels, a
mention picker in the built-in composer, and the chat→blueprint drafting
loop in the agent service. They are PLAN_004 tasks; do not assume any of
them works today.

## Verification

```bash
pnpm vitest run packages/chat        # 18 tests / 2 files
pnpm --filter @texuli/chat typecheck  # exit 0
npx biome check packages/chat        # exit 0
```

Browser behavior and size budgets live in the repository's
[testing guide](../../docs/TESTING_GUIDE.md).
