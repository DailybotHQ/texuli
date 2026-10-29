# Chat thread and message list

`@texuli/chat` exports `ChatThread`, `MessageList`, and `groupMessages` for
generic people or agent conversations. Messages use a stable id, author id and
display name, body text, and a `Date`, timestamp, or parseable date string.
Consecutive messages from one author group when they are within five minutes;
each new local calendar day begins with a date separator. `currentUserId`
controls own-message alignment. The list includes author avatars, localized
timestamps, status text, and a polite live log.

By default, the list virtualizes at 100 messages using variable row
measurements and five rows of overscan. For a long burst by one author,
rendered rows split at 20 messages while keeping the author header on the first
row. Set `virtualizeAfter` to another positive message count, or `Infinity` to
render every row. When older history is prepended, `MessageList` keeps the
message at the top of the view in place, including while virtualized rows are
still being measured, and it follows new messages when the reader is at the
bottom.
`ChatThread` composes the list with the existing composer; omit
`onSend` for a read-only thread. `label`, `virtualizeAfter`, and `overscan`
pass through to the list. `draft` can be bound by the parent, and
`typing`, `header`, and `body` support application-specific content.

The default body renderer supports plain text, `**strong**`, `*emphasis*`,
backtick code, and links written as `[label](https://example.com)`. It renders
Svelte text nodes rather than HTML. Link destinations pass the untrusted URL
policy; a rejected link remains visible as literal text.

Three closed inline node types (G21) are parsed too. They are never markup:
- `@[Name](mention:id)` paints `@Name` with `data-mention-id`, and
  `data-self` when the id is `currentUserId`. The id must match
  `[A-Za-z0-9._:-]{1,64}`.
- `[[date:ISO]]` paints a `<time>` with the normalized ISO `datetime`,
  formatted for `locale`. Only ISO 8601 dates and date-times parse.
- `[[status:tone|Label]]` paints a chip with `data-tone`. The tone is one of
  `MESSAGE_STATUS_TONES` (`neutral`, `info`, `success`, `warning`,
  `danger`).

Names and labels are capped at 64 characters. A token that fails any check
stays visible as literal text. Mentions are display-only: they do not notify
anyone or link anywhere. For attachments or a
different renderer, pass a Svelte snippet through `body`. Never convert user
messages to HTML.

Visible labels have English defaults. Pass `labels` to override the `you`
marker and message status strings; use `emptyText`, `label`, and `locale` for
the empty-state copy, live-region label, and locale-specific date formatting.
## Streaming replies

`applyChatStreamEvent(messages, event)` folds one event of an agent's reply
into the list and returns a new array. It returns the same array when it
ignores an event.
- `start {id, author, at, body?}` appends a message with `streaming: true`.
  It is ignored if the id already exists.
- `delta {id, text}` appends text.
- `end {id, body?, status?}` finishes the message; `body` replaces the
  streamed text when present.
- `error {id}` finishes it with `status: 'failed'`.

Events are checked because they usually come off the network. Malformed
events, and events for a message that is not streaming, are ignored. Bodies
are capped at `MAX_STREAM_BODY` (64 000 characters). The text stays plain and
goes through `parseMessageText` like any other body, so an unclosed `**`
shows literally until it closes.

While `streaming` is true, the bubble has `data-streaming` and
`aria-busy="true"`, plus a caret that does not blink under reduced motion.
Its partial text is `aria-hidden`, so the polite log does not read it token
by token; screen readers get the `labels.streaming` text ("Writing a
reply…"). When the stream ends, a new node replaces the bubble, so the
finished message is announced once. No status line shows while streaming.
The transport (SSE, WebSocket) is the host's; this package opens no
connection.

This component does not provide message persistence, delivery, encryption, or
network behavior.

## Message actions, inline edit and the scroll anchor (G33)

- `actions` is a snippet rendered under each finished message (never
  while it streams) with the message and a `ChatMessageActions` object:
  `edit()` and `canEdit`. Use it for feedback, copy, regenerate or edit
  buttons. The row is excluded from the live log's announcements.
- `onEdit(message, body)` enables inline edit. `edit()` swaps the bubble
  for a labelled textarea ("Edit message") with Save and Cancel, and
  focuses it. Enter saves, Shift+Enter adds a line, and Escape cancels.
  An unchanged body just closes. Return `false`, or reject, to keep the
  editor open with the draft. On close, focus returns to the control that
  opened the editor (or the log when it is gone).
- While the reader is at the bottom, the list follows a streaming reply as
  it grows. Once they scroll up it stays put, and a "Jump to latest"
  button appears. A polite status announces "New messages below" when
  messages arrive while they are scrolled up. The button scrolls to the
  bottom and moves focus to the log.

The labels `jumpToLatest`, `newBelow`, `editInput`, `saveEdit` and
`cancelEdit` translate these controls. `ChatThread` forwards `actions` and
`onEdit`.

## Reading position, avatars and day separators (G59, G70, G71)

- **Reading position.** `bind:anchor` (a `ChatReadingAnchor`) holds where
  the reader is: `messageId` (the first message in view, the one crossing
  the top edge or the first below it), `offset` (px from the viewport's top
  edge to that message's top, negative when it starts above the view) and
  `atLatest` (the reader is at the bottom). The list writes it as the reader
  scrolls, at most once per frame, and calls `onAnchorChange(anchor)` when it
  changes. An anchor the host sets (on mount, or with a new `messages` array
  when it swaps conversations) is restored: the list scrolls the message to
  `offset` (moving the virtual window to its estimated row first, then
  correcting from the rendered row), or to the bottom for `atLatest`.
  Restoring is not announced as new messages. An anchor whose message is not
  in the list, or `null`, opens at the latest message. `ChatThread` forwards
  `anchor` and `onAnchorChange`. `bind:ref` binds the scrolling log element.
- **Avatars.** `ChatAuthor.avatarSrcset` passes responsive candidates to the
  author's avatar (`srcset` on texuli `Avatar`); each candidate goes through
  the untrusted image URL policy, and refused ones are dropped. Stream
  `start` events carry it too (a non-string value rejects the event).
- **Day separators** are their own full-width row at the top of a group,
  above the row that holds the avatar and the bubbles
  (`.tx-chat-message-group__row`), so a narrow screen never squeezes the date
  beside the avatar. Each message bubble carries `data-message-id`.

## Display transcript for the player (G10)

`ChatThreadDisplay` and `ChatMessageDisplay` are the painters for the
`@texuli/player` ids `chat-thread` and `chat-message`; `CHAT_DISPLAY_LOADERS`
maps the ids to them. They take only plain props from a validated blueprint:
- thread: `label`;
- message: `author`, `role` (`CHAT_DISPLAY_ROLES`), `at` and `text`.

The thread renders a labelled section. Each message renders an article named
by its author line, with a role badge for `agent` and `system` and a `<time>`
only when `at` parses. Text uses the same inline subset and renderer as
`MessageList`; block children render below the text. The transcript is
static: there is no live region, scrolling, virtualization or composer.
