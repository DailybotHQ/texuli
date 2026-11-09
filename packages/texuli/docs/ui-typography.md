# Heading, Text, Prose, Box, Mark, Link and ColorSwatch

**Package:** `texuli` · **Import:** `texuli/typography` or `texuli` · **Status:** `Heading`, `Text`, `Prose` and
`Box` are new in `0.15.0` (blueprint spec `0.13.0`); `Mark`, `Link`, `ColorSwatch` and the round-2 to round-5 options are
in development for `0.16.0`

Typography and surfaces from the design system, driven by `--tx-*` tokens only. A locked
prototype ([DESIGN_SYSTEMS](../../../docs/DESIGN_SYSTEMS.md#locked-design-systems)) refuses
typography and visual utilities, so these catalog components are how it keeps titles,
section headings, muted and small text, long-form text, bordered panels, search highlights,
inline links and named color chips.

| Component | Catalog id | Role | Axes (catalog) |
| --- | --- | --- | --- |
| `Heading` | `heading` | A semantic `<h1>`…`<h6>` with a size independent of the level | `size`, `tone` |
| `Text` | `text` | Body copy, labels, captions, small print, eyebrows and large figures; never a heading | `size`, `tone` |
| `Prose` | `prose` | Long-form markup with the design system's reading rhythm | `size` |
| `Box` | `box` | A panel or region: padding, radius, border, elevation and surface | `variant` (the `surface` prop) |
| `Mark` | `mark` | An inline search highlight from a role's soft tokens | `tone` |
| `Link` | `link` | An inline sentence link; `href` through `safeHref` | hover, focus-visible |
| `ColorSwatch` | `color-swatch` | A closed palette, role or data-viz color chip with contrast ink | `variant` (the `color` prop), `size` |

Heading, Text, Prose and Box have no observable state. Link lists hover and focus-visible.
Each root carries `data-tx-component` and its axis attributes
(`data-tx-size`, `data-tx-tone`, and `data-tx-variant` for Box and ColorSwatch), so a checker maps any
rendered element back to its component, and an `allow` section enables or narrows them like
any other catalog component:

```json
{ "allow": { "heading": { "sizes": ["xl", "lg", "md"] }, "text": { "tones": ["default", "muted"] }, "box": {}, "prose": {}, "mark": {}, "link": {}, "color-swatch": {} } }
```

## Usage

```svelte
<script lang="ts">
  import { Box, ColorSwatch, Heading, Link, Mark, Prose, Text } from 'texuli/typography';
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
  <p>Example Co. closed the quarter ahead of plan. See <Link href="https://example.com/guide" label="the harbor guide" />.</p>
  <ul><li>Reports load from a cached query.</li></ul>
  <ol><li>Review the north pier.</li></ol>
</Prose>
<ColorSwatch color="chart-1" label="North" />
<Box padding="md" border="dashed" surface="default">Dashed panel</Box>
```

Heading and Text also take `label`: plain text rendered as escaped text that replaces
`children` when non-empty.

## Heading

| Prop | Values | Default |
| --- | --- | --- |
| `level` | `1`–`6`: the element (`<h1>`…`<h6>`) | `2` |
| `size` | `display` (the display role), `4xl`, `3xl`, `2xl` (hero and section titles), `xl` (title role), `lg` (heading role), `md`, `sm`, `xs` (`--tx-font-size-sm`, 0.875rem: a small card title) | from the level: 1 `xl`, 2 `lg`, 3 `md`, 4–6 `sm` |
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
| `italic` | italic | `false` |
| `strikethrough` | `text-decoration-line: line-through` | `false` |
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
styles. Unordered lists use `disc` markers and ordered lists use `decimal`, with
`--tx-muted-foreground` marker ink, so bullets and numbers show under every theme. The content
is the host's markup (children); Prose never renders HTML from a string.

## Box

| Prop | Values | Default |
| --- | --- | --- |
| `as` | `div`, `section`, `article`, `aside`, `header`, `footer` | `div` |
| `padding` | `none`, `sm`, `md`, `lg`, `xl` (space scale) | `md` |
| `radius` | `none`, `sm`, `md`, `lg`, `xl`, `full` (shape radius) | `md` |
| `border` | `none`, `default`, `strong`, one logical side (`block-start`, `block-end`, `inline-start`, `inline-end`), or `dashed` | `none` |
| `elevation` | `none`, `sm`, `md`, `lg` (elevation levels 1, 2, 4) | `none` |
| `surface` | `transparent`, `default`, `muted`, `subtle`, `elevated`, `canvas` (page background, `--tx-background`), `primary`, `brand`, `translucent` | `transparent` |

An app header or footer without card chrome is `radius="none"` with one border side
(`border="block-end"`). A rail uses `border="inline-start"` or `inline-end`. Box is not
interactive; use Card with `href` for a clickable surface. In forced colors a filled Box
without a border keeps a 1px outline.

- `canvas` is the page background (`--tx-background` with `--tx-foreground`): the area
  behind cards, not the card surface.
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
<Box padding="lg" radius="none" surface="canvas">…</Box>
<Box padding="md" border="dashed">…</Box>
```

`border="dashed"` is `--tx-border-width-thin` dashed `--tx-border`.

## Link

| Prop | Values | Default |
| --- | --- | --- |
| `href` | destination, filtered by `safeHref` | required |
| `hrefTrust` | `developer` (app-authored props), `untrusted` | `developer` |
| `external` | add `rel="noopener noreferrer"` | `false` |
| `target` | link target; `_blank` also adds `noopener noreferrer` | — |
| `label` | plain text, escaped | — |

The link is `display: inline` so it wraps inside a sentence. Color and underline come from
`--tx-link` and `--tx-border-width-thin`. An http(s) href, `external`, or `target="_blank"`
adds `rel="noopener noreferrer"`. A refused href (`javascript:`, a blocked scheme) renders as
text with `data-href-blocked`, never a dead link.

```svelte
See <Link href="https://example.com/guide" label="the harbor guide" />.
```

## ColorSwatch

| Prop | Values | Default |
| --- | --- | --- |
| `color` | `chart-1`…`chart-8`, or `primary`, `secondary`, `success`, `warning`, `destructive`, `info`, `neutral` | `primary` in the catalog; invalid values drop the fill |
| `size` | `sm`, `md`, `lg` | `md` |
| `label` | plain text, escaped | — |

Fill and contrast ink come from the same closed color-reference type as the Box data fill and
the label palette (`colorRefVar` / `colorRefInk`). A value that is not a registered name
(`#fff`, `red`, a CSS function) never becomes a declaration.

```svelte
<ColorSwatch color="chart-1" label="North" />
```

## Mark

| Prop | Values | Default |
| --- | --- | --- |
| `tone` | `warning` (search hit), `primary`, `success`, `info` | `warning` |
| `label` | plain text, escaped | — |

Renders a real `<mark>`. Each tone reads that role's soft fill and ink
(`--tx-warning-soft` / `--tx-warning-soft-foreground`, and the same for primary, success
and info). Forced colors use `Highlight` / `HighlightText`. Struck text stays on Text
(`strikethrough`); a status chip stays on Badge.

```svelte
<Text as="span">Results for <Mark label="quarter" /> reports</Text>
```

A compact bar in a card is `charts-sparkline` with `variant="bar"` (`@texuli/charts`), not
a new catalog id.

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
component constants, root attributes and the allow set),
`packages/texuli/tests/typography-2.test.ts` (the `primary`, `brand` and `translucent`
surfaces, the `2xl`–`4xl` sizes, `responsive`, `tight` tracking, Text `inherit`, the catalog
and the allow set), `packages/texuli/tests/protoyard-round3.test.ts` (Box `canvas` and
inline borders, Heading `xs`, Text italic and strikethrough, Mark tones, density-independent
layout widths) and `packages/texuli/tests/protoyard-round5.test.ts` (Prose list markers,
inline `Link` with `safeHref`, `ColorSwatch` token colors, dashed Box borders). The
`texuli-typography` example has visual baselines in light and dark, desktop and mobile.
