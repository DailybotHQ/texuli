# ScreenOutlet

> Stable screen mount point that survives layout switches.

- **id:** `screen-outlet`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- LayoutHost needs a durable screen node

### Don't use when

- Static pages without layout switching

### Accessibility

- Outlet is a plain region; screen content supplies its own landmarks.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `children` | slot | yes | — | — | — |
| `onready` | event | no | — | — | Fires with the outlet element |

### Examples

#### Outlet (`basic`)

```json
{}
```

### Related

- [`layout-host`](layout-host.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
