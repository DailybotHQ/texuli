# Button

> A pressable action control with loading and optional link rendering.

- **id:** `button`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Primary and secondary actions
- Submit and reset controls in forms

### Don't use when

- An icon-only control (use icon-button)
- A toggleable filter chip (use chip)
- Navigation that is not an action (use a link or nav item)

### Accessibility

- Real button or link element with an accessible name
- Busy state exposes aria-busy and aria-disabled, keeps focus and blocks further activation
- Rejected href schemes render as a non-interactive control

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `variant` | enum(default | secondary | outline | ghost | destructive | link) | no | — | `"default"` | — |
| `size` | enum(sm | md | lg | icon) | no | — | `"md"` | — |
| `href` | string | no | developer | — | Optional link target (URL policy) |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `type` | enum(button | submit | reset) | no | — | `"button"` | — |
| `disabled` | boolean | no | — | `false` | — |
| `loading` | boolean | no | — | `false` | — |
| `loadingLabel` | string | no | — | — | Accessible name while loading |
| `autoLoading` | boolean | no | — | `true` | Show pending when onclick returns a promise |
| `label` | string | no | — | — | Plain-text label, escaped; replaces children when both are given |
| `onclick` | event | no | — | — | Activated handler; may return a promise |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The visible label (an inline-text node in a tree) |

### Examples

#### Default button (`default`)

```json
{
  "variant": "default"
}
```

#### Loading button (`loading`)

```json
{
  "loading": true,
  "loadingLabel": "Saving"
}
```

#### Labelled submit button (`labelled`)

```json
{
  "type": "submit",
  "label": "Save changes"
}
```

### Related

- [`icon-button`](icon-button.md)
- [`button-group`](button-group.md)
- [`form`](form.md)
- [`inline-text`](inline-text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
