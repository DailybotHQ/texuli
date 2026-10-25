# Inline text

> A plain text run for the slot of a slot-only component (button, label, badge).

- **id:** `inline-text`
- **package:** `@texuli/catalog`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Give a form label, description, field error or menu trigger its visible text
- Text for a button, badge or kbd when the tree prefers a child to the label prop
- Any slot that needs a short phrase rather than a block

### Don't use when

- A paragraph, heading or list (use blocks-text)
- Text that needs formatting or links (use blocks-text)
- A component that already has a label or title prop (set that prop)

### Accessibility

- Painted as one escaped text node, so it names the parent control (a button label)
- A leaf: children are dropped

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `text` | string | yes | — | — | Plain text; the renderer refuses markup-like strings |

### Examples

#### Button label (`button-label`)

```json
{
  "text": "Save changes"
}
```

#### Badge word (`badge-word`)

```json
{
  "text": "Shipped"
}
```

### Related

- [`button`](button.md)
- [`label`](label.md)
- [`badge`](badge.md)
- [`kbd`](kbd.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
