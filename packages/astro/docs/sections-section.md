# `Section`

Import the static section wrapper from `@texuli/astro/sections/Section`:

```astro
---
import Section from '@texuli/astro/sections/Section';
---

<Section id="details" label="Details" width="wide">
  <h2>Details</h2>
  <p>Host-authored section content.</p>
</Section>
```

## Props and slots

| Prop | Required | Default | Behavior |
| --- | --- | --- | --- |
| `id` | No | — | Sets the section element's `id`. |
| `label` | No | — | Sets its `aria-label`; omit it when a visible heading labels the section. |
| `width` | No | `reading` | Accepts `reading`, `wide`, or `full` to select the maximum inline size. |
| `tone` | No | `default` | Accepts `default` or `surface`; `surface` paints the theme's `--tx-surface` color behind the section. |
| `padding` | No | `normal` | Accepts `normal` or `none`; `none` removes the responsive inline padding for nested sections. |

The default slot contains the section's content. `reading` is constrained to
`72rem`, `wide` to `88rem`, and `full` has no maximum inline size. All variants
use full width, centered margins, and responsive inline padding. The component
renders static HTML and does not hydrate.

The source is [`Section.astro`](../src/sections/Section.astro). The packed
`astro-plain` fixture checks the labeled wide section content.
