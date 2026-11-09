# Avatar

> A face or initials for one person, with an optional presence status.

- **id:** `avatar`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show who wrote a message, who owns a task, or who is in a thread

### Don't use when

- A group of faces in one circle (use avatar-group-grid)

### Accessibility

- Named by the person unless decorative.
- Image URLs pass the untrusted image policy.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | string | yes | untrusted | — | — |
| `src` | string | no | untrusted | — | — |
| `srcTrust` | enum(developer | untrusted) | no | — | `"untrusted"` | — |
| `srcset` | string | no | untrusted | — | — |
| `sizes` | string | no | — | — | — |
| `size` | enum(xs | sm | md | lg) | no | — | `"md"` | — |
| `tone` | enum(primary | success | warning | destructive | info | neutral) | no | — | — | — |
| `color` | enum(none | chart-1 | chart-2 | chart-3 | chart-4 | chart-5 | chart-6 | chart-7 | chart-8) | no | — | `"none"` | — |
| `shape` | enum(circle | square) | no | — | — | — |
| `status` | enum(online | away | busy | offline) | no | — | — | — |
| `decorative` | boolean | no | — | `false` | — |
| `delayMs` | number | no | — | `0` | — |
| `initials` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Named person (`person`)

```json
{
  "name": "Ada Example",
  "size": "md"
}
```

### Related

- [`avatar-group-grid`](avatar-group-grid.md)
- [`list-item`](list-item.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
