# Filter control

> A text field that sets a string state variable, capped at its declared length.

- **id:** `control-filter`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Type a filter that other nodes read through a binding

### Don't use when

- Submitting, saving or sending anything: controls only set local state
- Navigating: use a link

### Accessibility

- A native search input with a visible label; Enter never submits

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `state` | string | yes | — | — | The declared local-state variable this control sets. |
| `label` | string | yes | untrusted | — | Visible label and accessible name. |
| `placeholder` | string | no | untrusted | — | — |

### Examples

#### Filter (`query`)

```json
{
  "state": "query",
  "label": "Filter tickets"
}
```

### Related

- [`control-toggle`](control-toggle.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
