# Heatmap

> A matrix of labeled cells with an accessible data table.

- **id:** `charts-heatmap`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render heatmap from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | — | — |
| `description` | string | yes | — | — | — |
| `cells` | array | yes | — | — | — |
| `mode` | enum(light | dark) | no | — | — | — |
| `interactive` | string | no | — | — | — |
| `class` | string | no | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |
| `annotations` | string | no | — | — | — |

### Examples

#### Heatmap example (`basic`)

```json
{
  "title": "Weekly volume",
  "description": "Volume by day and hour",
  "cells": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
