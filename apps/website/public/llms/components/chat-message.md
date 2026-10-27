# Chat message

> One display-only chat message: author, role, time, text and block children.

- **id:** `chat-message`
- **package:** `@texuli/chat`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `chat`

### Use when

- Inside chat-thread, one per message

### Don't use when

- Outside a chat-thread
- For a reply box; that is host chrome

### Accessibility

- Renders an article named by author and time; the role is visible text
- Message text is plain text nodes; links pass the untrusted URL policy

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `author` | string | yes | untrusted | — | — |
| `role` | enum(user | agent | system) | yes | — | — | — |
| `at` | string | no | — | — | ISO 8601 time; omitted when it does not parse. |
| `text` | string | no | untrusted | — | Chat inline subset. |
| `children` | slot | no | — | — | blocks-* nodes. |

### Examples

#### Agent reply (`agent-reply`)

```json
{
  "author": "Fictional Agent",
  "role": "agent",
  "at": "2026-10-24T09:00:00Z",
  "text": "Two items are **blocked**."
}
```

### Related

- [`chat-thread`](chat-thread.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
