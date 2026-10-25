# Code blocks

> Validated, highlighted code.

- **id:** `blocks-code`
- **package:** `@texuli/blocks`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render code blocks from structured content data.

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
| `oninvalid` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `lineNumbers` | boolean | no | — | — | — |
| `highlights` | array | no | — | — | — |
| `hostStep` | number | no | — | — | — |
| `step` | number | no | — | — | — |
| `copyable` | boolean | no | — | — | — |

### Examples

#### Code blocks example (`basic`)

```json
{
  "block": {
    "type": "code",
    "code": "n = 1"
  }
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
