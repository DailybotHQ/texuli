# Notification inbox

> Notifications, newest first, with unread state, mark read and unread, mark all read and an unread view.

- **id:** `data-notification-inbox`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- List updates someone should catch up on, such as mentions or review requests

### Don't use when

- A short-lived confirmation: that is a host toast
- A history of changes without read state: use timeline

### Accessibility

- A section named by its heading; the unread count is read after it
- Every item has a read toggle named with its title; new unread items are announced politely

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | untrusted | — | Notifications, newest first. href passes the untrusted URL policy (https, mailto and #fragments); read changes stay in view. |
| `filter` | enum(all | unread) | no | — | `"all"` | — |
| `now` | string | no | — | — | The ISO instant the time labels count from (default: when it paints). |
| `timeZone` | string | no | — | `"UTC"` | — |
| `locale` | string | no | — | `"en-US"` | — |
| `markReadOnOpen` | boolean | no | — | `true` | Opening an unread item marks it read. |
| `headingLevel` | number | no | — | `2` | Level of the inbox heading, 2 to 6. |

### Examples

#### Mentions (`mentions`)

```json
{
  "now": "2026-10-27T12:00:00Z",
  "items": [
    {
      "id": "n1",
      "title": "Ana Example mentioned you in Launch plan",
      "body": "Can you check the timeline before Friday?",
      "at": "2026-10-27T11:40:00Z",
      "read": false,
      "href": "https://example.com/docs/launch-plan"
    },
    {
      "id": "n2",
      "title": "Weekly report is ready",
      "at": "2026-10-26T09:00:00Z",
      "read": true
    }
  ]
}
```

### Related

- [`timeline`](timeline.md)
- [`chat-thread`](chat-thread.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
