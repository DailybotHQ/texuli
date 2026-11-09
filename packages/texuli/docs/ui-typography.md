# Heading, Text, Prose and Box

**Package:** `texuli` · **Import:** `texuli/typography` or `texuli` · **Status:** built for
blueprint spec `0.13.0`, new in `0.15.0`

Typography and surfaces from the design system, driven by `--tx-*` tokens only. A locked
prototype ([DESIGN_SYSTEMS](../../../docs/DESIGN_SYSTEMS.md#locked-design-systems)) refuses
typography and visual utilities, so these four catalog components are how it keeps titles,
section headings, muted and small text, long-form text and bordered panels.

| Component | Catalog id | Role | Axes (catalog) |
| --- | --- | --- | --- |
| `Heading` | `heading` | A semantic `<h1>`…`<h6>` with a size independent of the level | `size`, `tone` |
| `Text` | `text` | Body copy, labels, captions, small print, eyebrows and large figures; never a heading | `size`, `tone` |
| `Prose` | `prose` | Long-form markup with the design system's reading rhythm | `size` |
| `Box` | `box` | A panel or region: padding, radius, border, elevation and surface | `variant` (the `surface` prop) |

None of them has an observable state (no hover, focus or disabled styling), so the catalog
lists no `states` for them. Each root carries `data-tx-component` and its axis attributes
(`data-tx-size`, `data-tx-tone`, and `data-tx-variant` for Box), so a checker maps any
rendered element back to its component, and an `allow` section enables or narrows them like
any other catalog component:

```json
{ "allow": { "heading": { "sizes": ["xl", "lg", "md"] }, "text": { "tones": ["default", "muted"] }, "box": {}, "prose": {} } }
```

## Usage

```svelte
<script lang="ts">
  import { Box, Heading, Prose, Text } from 'texuli/typography';
</script>

<Box as="header" radius="none" border="block-end" surface="default">
  <Text size="xs" tone="muted" transform="uppercase" tracking="wide">Workspace</Text>
  <Heading level={1} size="xl">Quarterly report</Heading>
</Box>

<Box padding="lg" border="default" surface="default" radius="lg">
  <Text size="xs" tone="muted" transform="uppercase" tracking="wide">Revenue</Text>
  <Text size="figure" tabular weight="semibold">$1,284,300</Text>
  <Text size="sm" tone="success">Up 12% on the last quarter</Text>
</Box>

<Heading level={2} size="md" tone="muted">Details</Heading>
<Prose as="article">
  <p>Example Co. closed the quarter ahead of plan.</p>
  <ul><li>Reports load from a cached query.</li></ul>
</Prose>
```

Heading and Text also take `label`: plain text rendered as escaped text that replaces
`children` when non-empty.

## Heading

| Prop | Values | Default |
| --- | --- | --- |
| `level` | `1`–`6`: the element (`<h1>`…`<h6>`) | `2` |
| `size` | `display` (the display role), `4xl`, `3xl`, `2xl` (hero and section titles), `xl` (title role), `lg` (heading role), `md`, `sm` | from the level: 1 `xl`, 2 `lg`, 3 `md`, 4–6 `sm` |
| `responsive` | scale the size down on narrow screens | `false` |
| `tracking` | `default` (the role's), `tight` (`--tx-letter-spacing-tight`, -0.02em when the design system does not set it) | `default` |
| `tone` | `default`, `muted` | `default` |
| `truncate` | one line with an ellipsis | `false` |

`size` changes only the look; assistive technology hears the level. Pick levels in document
order and use `size` for the visual hierarchy.

`2xl`, `3xl` and `4xl` take `--tx-font-size-2xl`, `-3xl` and `-4xl` from the type scale with
the display role's family, weight, line height and tracking, so a hero title follows the
design system's display weight. With `responsive`, the size is fluid:
`clamp(min, min + 2.5vw, size)`, where `min` is about two scale steps below the size (for
`4xl` and `display`, `--tx-font-size-2xl`). It never grows past the size or shrinks below the
smaller step.

```svelte
<Heading level={1} size="4xl" responsive tracking="tight" label="Plan the quarter" />
```

## Text

| Prop | Values | Default |
| --- | --- | --- |
| `as` | `p`, `span`, `div`, `label`, `small`, `strong` (never a heading) | `p` |
| `size` | `figure` (a large number outside Stat: the title size), `lg`, `md` (body), `sm`, `xs` (caption), `inherit` (the parent's size and line height) | `md` |
| `tone` | `default`, `muted`, `subtle`, `primary`, `success`, `warning`, `destructive`, `info`, `inherit` (the parent's color) | `default` |
| `weight` | `regular`, `medium`, `semibold` | `regular` |
| `transform` | `none`, `uppercase`, `lowercase`, `capitalize` | `none` |
| `tracking` | `normal`, `wide` (`--tx-letter-spacing-wide`, 0.08em when the design system does not set it) | `normal` |
| `tabular` | tabular figures (`font-variant-numeric: tabular-nums`) | `false` |
| `mono` | the code family | `false` |
| `align` | `start`, `center`, `end` (logical) | `start` |
| `truncate` | one line with an ellipsis | `false` |
| `lineClamp` | 1–10 lines with an ellipsis (other values are ignored) | — |
| `for` | with `as="label"`: the labelled control's id | — |

**Nested text** inside a heading or a label is `size="inherit" tone="inherit"`: it keeps the
parent's size, line height and color and changes only what it sets (a weight, a transform).

An **eyebrow** (overline) is `size="xs" tone="muted" transform="uppercase" tracking="wide"`.
A **large figure** is `size="figure" tabular`. The tones are role inks that hold the text
target on the page: `muted` and `subtle` read `--tx-muted-foreground` and
`--tx-subtle-foreground`; `primary`, `success`, `warning`, `destructive` and `info` read
`--tx-<role>-soft-foreground`, the darker ink of each role (a plain `--tx-warning` on white
would fail AA). A tone never carries meaning alone: the words say it.

## Prose

| Prop | Values | Default |
| --- | --- | --- |
| `as` | `div`, `article`, `section` | `div` |
| `size` | `md` (body), `lg` | `md` |

A 65ch measure, the body role, block spacing from the space scale (`--tx-space-4`, more before
headings), heading sizes from the title and heading roles, list indent, quote and inline code
styles. The content is the host's markup (children); Prose never renders HTML from a string.

## Box

| Prop | Values | Default |
| --- | --- | --- |
| `as` | `div`, `section`, `article`, `aside`, `header`, `footer` | `div` |
| `padding` | `none`, `sm`, `md`, `lg`, `xl` (space scale) | `md` |
| `radius` | `none`, `sm`, `md`, `lg`, `xl`, `full` (shape radius) | `md` |
| `border` | `none`, `default`, `strong`, or one logical side: `block-start`, `block-end` | `none` |
| `elevation` | `none`, `sm`, `md`, `lg` (elevation levels 1, 2, 4) | `none` |
| `surface` | `transparent`, `default`, `muted`, `subtle`, `elevated`, `primary`, `brand`, `translucent` | `transparent` |

An app header or footer without card chrome is `radius="none"` with one border side
(`border="block-end"`). Box is not interactive; use Card with `href` for a clickable surface.
In forced colors a filled Box without a border keeps a 1px outline.

- `primary` is the solid primary fill with its on-color (`--tx-primary`,
  `--tx-primary-foreground`): a logo tile or a brand mark.
- `brand` is the soft primary tint with its ink (`--tx-primary-soft`,
  `--tx-primary-soft-foreground`).
- `translucent` is the page background at the glass opacity (`--tx-surface-glass-alpha`) with
  the glass blur behind (`--tx-surface-glass-blur`): a sticky header over scrolling content.
  Without `backdrop-filter`, with `prefers-reduced-transparency: reduce` and in forced colors
  it is opaque.

```svelte
<Box as="header" padding="md" radius="none" border="block-end" surface="translucent">…</Box>
<Box padding="md" radius="lg" surface="primary">…</Box>
```

## Tokens

Styles live in `@layer tx.components` (`typography.css`). System tokens are read plain
(`--tx-type-*`, `--tx-space-*`, `--tx-shape-radius-*`, `--tx-elevation-*`,
`--tx-border-width-*`); role colors, the `--tx-font-size-*` scale and
`--tx-letter-spacing-wide` and `-tight` keep a fallback (the glass tokens are read plain). No literal color. The family has no component
tokens of its own.

## A11y

- Heading renders the semantic element for its level; Text never renders a heading.
- Hostile or stale prop values fall back to the defaults: a level outside 1–6 is `<h2>`, an
  element outside the list is `<p>`.
- Logical properties throughout (`text-align: start`, `border-block-end`), so right-to-left
  layouts mirror.

## Tests

`packages/texuli/tests/typography.test.ts` (elements, classes and attributes, hostile values,
eyebrow and figure, line clamp, labels, Box border sides, token reads, catalog axes against the
component constants, root attributes and the allow set) and
`packages/texuli/tests/typography-2.test.ts` (the `primary`, `brand` and `translucent`
surfaces, the `2xl`–`4xl` sizes, `responsive`, `tight` tracking, Text `inherit`, the catalog
and the allow set). The `texuli-typography` example has
visual baselines in light and dark, desktop and mobile.
