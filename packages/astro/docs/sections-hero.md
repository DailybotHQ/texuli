# `Hero`

Import the static hero section from `@texuli/astro/sections/Hero`:

```astro
---
import Hero from '@texuli/astro/sections/Hero';
---

<Hero
  eyebrow="A short label"
  title="A clear page heading"
  description="One sentence that explains this page."
  align="center"
>
  <a href="https://example.com/start">Get started</a>
</Hero>
```

## Props and slots

| Prop | Required | Default | Behavior |
| --- | --- | --- | --- |
| `title` | Yes | — | Renders the hero's `<h1>`. |
| `eyebrow` | No | — | Renders a short paragraph before the heading. |
| `description` | No | — | Renders descriptive text after the heading. |
| `align` | No | `start` | Accepts `start` or `center`; center alignment centers the text and actions. |
| `size` | No | `lede` | Accepts `lede` (page tops) or `compact` (sub-pages and nested views); compact reduces the vertical padding and heading scale through responsive clamps. |

The default slot is for action or other host-authored content. The component
renders server-side HTML with responsive type sizing, spacing, and logical
layout properties. It has no client script or hydration requirement. Link
props are not part of this component API; links placed in the slot remain
host-authored markup and should follow the host's URL policy.

The source is [`Hero.astro`](../src/sections/Hero.astro). The packed
`astro-plain` fixture renders a centered hero and checks its heading.
