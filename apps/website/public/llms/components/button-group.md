# ButtonGroup

> Groups related buttons with shared borders and orientation.

- **id:** `button-group`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Cluster related actions that share a single decision

### Don't use when

- Unrelated actions across a toolbar (use a plain flex row)

### Accessibility

- role=group with an optional accessible label.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `orientation` | enum(horizontal | vertical) | no | — | `"horizontal"` | — |
| `attached` | boolean | no | — | `true` | Share borders between buttons |
| `label` | string | no | — | — | Accessible name for the group |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Attached horizontal group (`attached`)

```json
{
  "orientation": "horizontal",
  "attached": true,
  "label": "View mode"
}
```

### Related

- [`button`](button.md)
- [`icon-button`](icon-button.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
