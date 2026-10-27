# Choice control

> A segmented choice that sets an enum state variable to one of its values.

- **id:** `control-choice`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Switch between a few views or ranges, such as this week or last week

### Don't use when

- Submitting, saving or sending anything: controls only set local state
- Navigating: use a link

### Accessibility

- A radiogroup of radio buttons; arrows, Home and End move and select (roving tabindex)

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `state` | string | yes | — | — | The declared local-state variable this control sets. |
| `label` | string | yes | untrusted | — | Visible label and accessible name. |

### Examples

#### Week (`range`)

```json
{
  "state": "week",
  "label": "Week"
}
```

### Related

- [`control-toggle`](control-toggle.md)
- [`control-slider`](control-slider.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
