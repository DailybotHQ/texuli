# Wizard layout

> Centered onboarding wizard frame with steps.

- **id:** `layout-wizard`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Multi-step setup and onboarding

### Don't use when

- Single-page forms

### Accessibility

- Steps expose current position
- Back and next controls are named

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `steps` | array | no | — | — | — |
| `content` | slot | no | — | — | — |
| `mountScreen` | event | no | — | — | — |
| `current` | number | no | — | `0` | — |
| `title` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `canAdvance` | event | no | — | — | — |
| `validate` | event | no | — | — | — |
| `onFinish` | event | no | — | — | — |
| `onStepChange` | event | no | — | — | — |
| `backLabel` | string | no | — | — | — |
| `nextLabel` | string | no | — | — | — |
| `finishLabel` | string | no | — | — | — |
| `secondaryActions` | slot | no | — | — | — |
| `brand` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Onboarding (`onboarding`)

```json
{
  "title": "Welcome",
  "steps": [
    {
      "id": "profile",
      "label": "Profile"
    }
  ],
  "current": 0
}
```

### Related

- [`layout-auth-split`](layout-auth-split.md)
- [`layout-settings`](layout-settings.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
