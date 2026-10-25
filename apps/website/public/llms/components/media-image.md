# Responsive image

> A responsive image with URL validation, loading states and actions.

- **id:** `media-image`
- **package:** `@texuli/media`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render responsive image from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `src` | string | yes | untrusted | — | URL input is checked by the package URL policy. |
| `srcset` | string | no | — | — | — |
| `sizes` | string | no | — | — | — |
| `widths` | array | no | — | — | — |
| `loader` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `alt` | string | yes | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |
| `fit` | enum(cover | contain | fill | none | scale-down) | no | — | — | — |
| `focalPoint` | object | no | — | — | — |
| `placeholder` | object | no | — | — | — |
| `loading` | enum(eager | lazy) | no | — | — | — |
| `fetchPriority` | enum(high | low | auto) | no | — | — | — |
| `trust` | enum(developer | untrusted) | no | — | — | — |
| `href` | string | no | untrusted | — | URL input is checked by the package URL policy. |
| `onactivate` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `actionLabel` | string | no | — | — | — |
| `labels` | object | no | — | — | — |
| `onload` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `onerror` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `onstatus` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `class` | string | no | — | — | — |

### Examples

#### Responsive image example (`basic`)

```json
{
  "src": "images/team.webp",
  "alt": "A team planning together"
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
