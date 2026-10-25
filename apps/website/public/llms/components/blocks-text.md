# Text blocks

> Validated heading, paragraph, list, quote and callout content.

- **id:** `blocks-text`
- **package:** `@texuli/blocks`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render text blocks from structured content data.

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

### Examples

#### Text blocks example (`basic`)

```json
{
  "block": {
    "type": "heading",
    "level": 2,
    "text": "Quarterly update"
  }
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
