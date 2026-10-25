# Code

> Inline or block code with escaped text (no HTML).

- **id:** `code`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show a short code sample or token

### Don't use when

- A full syntax-highlighted editor

### Accessibility

- Text is always escaped; language is display-only metadata.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | untrusted | — | Plain source (preferred for agent/user content) |
| `variant` | enum(inline | block) | no | — | `"inline"` | — |
| `language` | string | no | — | — | Optional language hint |
| `class` | string | no | — | — | — |

### Examples

#### TypeScript block (`block-ts`)

```json
{
  "variant": "block",
  "language": "ts",
  "value": "const n = 1;"
}
```

### Related

- [`kbd`](kbd.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
