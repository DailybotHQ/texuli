# Host region

> Reserves a named place where the host app mounts its own component.

- **id:** `host-region`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- A step that needs sensitive input the agent must never emit (payment, sign-in)
- A place for host chrome that lives inside the document flow

### Don't use when

- Content the agent can describe itself: use a content block
- Card numbers, passwords or one-time codes as props: those never appear in a blueprint

### Accessibility

- The host component sits in a labelled group named by the label
- A region the host does not provide shows the label as visible text, not an empty box

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | string | yes | — | — | The region the host provides, such as "payment" (lowercase, digits, hyphens). |
| `label` | string | yes | untrusted | — | What the region is for; its accessible name and its placeholder text. |

### Examples

#### Payment step (`payment`)

```json
{
  "name": "payment",
  "label": "Payment details"
}
```

### Related

- [`layout-stack`](layout-stack.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
