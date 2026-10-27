# Flow action

> A button that fires one declared flow event, such as next or back.

- **id:** `flow-action`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Move between the views of a declared flow

### Don't use when

- Submitting or navigating away: actions only change the local view

### Accessibility

- A type="button"; aria-disabled when no transition applies from the current view

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `event` | string | yes | — | — | A declared event. |
| `label` | string | yes | untrusted | — | — |

### Examples

#### Next (`next`)

```json
{
  "event": "next",
  "label": "Next"
}
```

### Related

- [`flow-view`](flow-view.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
