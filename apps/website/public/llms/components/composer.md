# Composer

> The host reply box for a chat thread. Host chrome; agents never emit it.

- **id:** `composer`
- **package:** `@texuli/chat`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `chat`

### Use when

- The person replies in a live chat the host owns

### Don't use when

- A read-only transcript (use chat-thread)
- A form (use action-form or schema-form)

### Accessibility

- The field is labelled; Enter sends and Escape stops a stream
- Pending send is announced; the send control stays named while streaming

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | untrusted | — | Draft text. |
| `onSubmit` | event | yes | — | — | Send the draft. |
| `disabled` | boolean | no | — | `false` | — |
| `sending` | boolean | no | — | `false` | — |
| `maxRows` | number | no | — | `6` | — |
| `maxLength` | number | no | — | — | — |
| `streaming` | boolean | no | — | `false` | — |
| `onStop` | event | no | — | — | Stop a streaming reply. |
| `layout` | enum(stack | row) | no | — | `"stack"` | — |
| `sendButton` | enum(label | icon) | no | — | `"label"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Reply box (`reply`)

```json
{
  "layout": "stack"
}
```

### Related

- [`chat-thread`](chat-thread.md)
- [`chat-message`](chat-message.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
