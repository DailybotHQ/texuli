# ResponsiveModal

> Dialog on large screens, drawer/sheet on small screens.

- **id:** `responsive-modal`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- One flow that should adapt across breakpoints

### Don't use when

- Fixed desktop-only dialogs

### Accessibility

- Preserves dialog semantics on large viewports.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg | xl) | no | — | `"md"` | — |
| `side` | enum(top | right | bottom | left | start | end | center) | no | — | `"bottom"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Adaptive (`adaptive`)

```json
{
  "size": "md"
}
```

### Related

- [`dialog`](dialog.md)
- [`drawer`](drawer.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
