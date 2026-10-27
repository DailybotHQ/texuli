# Toggle control

> A switch that sets a boolean state variable.

- **id:** `control-toggle`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Show or hide details, include or exclude a series

### Don't use when

- Submitting, saving or sending anything: controls only set local state
- Navigating: use a link

### Accessibility

- A button with role="switch" and aria-checked; Space or Enter flips it

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `state` | string | yes | — | — | The declared local-state variable this control sets. |
| `label` | string | yes | untrusted | — | Visible label and accessible name. |

### Examples

#### Show details (`details`)

```json
{
  "state": "details",
  "label": "Show details"
}
```

### Related

- [`control-choice`](control-choice.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
