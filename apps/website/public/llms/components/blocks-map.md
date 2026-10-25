# Map blocks

> Validated map points and routes.

- **id:** `blocks-map`
- **package:** `@texuli/blocks`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render map blocks from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `block` | object | yes | untrusted | — | Untrusted block data validated by the component before rendering. |
| `labels` | object | no | — | — | — |
| `locale` | string | no | — | — | — |
| `headingLevel` | number | no | — | — | — |
| `oninvalid` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |

### Examples

#### Map blocks example (`basic`)

```json
{
  "block": {
    "type": "map",
    "label": "Depot",
    "points": [
      {
        "id": "a",
        "label": "Depot",
        "lng": 0,
        "lat": 0
      }
    ]
  }
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
