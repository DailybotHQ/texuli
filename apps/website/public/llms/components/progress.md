# Progress

> A linear or circular progress bar, determinate or indeterminate.

- **id:** `progress`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show how far a task has gone, or that it is still running

### Don't use when

- A short wait with no value (use spinner)

### Accessibility

- A progressbar named by label or ariaLabel; null value is indeterminate.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | number | no | — | `0` | Current value; omit or null while unknown |
| `max` | number | no | — | `100` | — |
| `min` | number | no | — | `0` | — |
| `label` | string | no | — | — | — |
| `ariaLabel` | string | no | — | — | — |
| `showValue` | boolean | no | — | `false` | — |
| `tone` | enum(primary | success | warning | destructive | info | neutral) | no | — | `"primary"` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `shape` | enum(linear | circular) | no | — | `"linear"` | — |
| `loadingLabel` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Upload (`upload`)

```json
{
  "value": 40,
  "label": "Upload",
  "showValue": true
}
```

### Related

- [`spinner`](spinner.md)
- [`skeleton`](skeleton.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
