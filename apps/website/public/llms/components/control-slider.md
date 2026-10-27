# Slider control

> A range input that sets a number state variable within its declared min and max.

- **id:** `control-slider`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Adjust a threshold or a count within a bounded range

### Don't use when

- Submitting, saving or sending anything: controls only set local state
- Navigating: use a link

### Accessibility

- A native range input with a visible label and value

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `state` | string | yes | — | — | The declared local-state variable this control sets. |
| `label` | string | yes | untrusted | — | Visible label and accessible name. |
| `step` | number | no | — | — | Increment; default 1. |

### Examples

#### Limit (`limit`)

```json
{
  "state": "limit",
  "label": "Items shown",
  "step": 1
}
```

### Related

- [`control-choice`](control-choice.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
