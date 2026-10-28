# Chat thread

> Read-only conversation transcript of chat-message nodes, without a composer.

- **id:** `chat-thread`
- **package:** `@texuli/chat`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `chat`

### Use when

- Show a conversation an agent summarized or quoted
- Show a chat transcript inside a report or document

### Don't use when

- The person needs to reply: the host renders its own composer (host chrome)
- The content is not a conversation; use text blocks

### Accessibility

- Renders a labelled section; each message is an article with author and time
- Static: no live region, focus trap or keyboard handling is added

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | no | untrusted | — | Accessible name. |
| `children` | slot | no | — | — | chat-message nodes. |

### Examples

#### Stand-up excerpt (`standup`)

```json
{
  "label": "Stand-up thread"
}
```

### Related

- [`chat-message`](chat-message.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
