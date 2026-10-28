# Flow view

> One named view of a multi-step flow; only the current view paints.

- **id:** `flow-view`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Split a wizard or a multi-step report into named steps

### Don't use when

- Content that should always show

### Accessibility

- A labelled region; focus moves to it when an action brings it into view

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | string | yes | — | — | A declared view. |
| `label` | string | no | untrusted | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Review step (`step`)

```json
{
  "name": "review",
  "label": "Review"
}
```

### Related

- [`flow-action`](flow-action.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
