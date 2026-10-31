# Email from blueprints

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/email` ·
**Path:** `src/email/`

> **Status: new in `0.8.0`** (ADR-016); the `0.7.0` release predates it.

`renderEmail(draft, options)` turns a blueprint draft (an envelope, a
catalog node, an array of nodes, or their JSON text) into an
`EmailResult`: `{ ok, html, text, diagnostics }`, where `html` is a
complete email document and `text` its plain-text alternative. It never
throws.

```ts
import { renderEmail } from '@texuli/tools/email';

const { ok, html, text, diagnostics } = renderEmail(agentDraft, {
  preheader: 'Your week in numbers',
  baseUrl: 'https://example.com/assets/',
  theme, // a @texuli/tokens Theme, optional
});
```

## Safety

- **Validation first.** The draft goes through `validateDraft` at the
  `untrusted` tier, with the deep block schemas and the sink scan, against
  `emailRenderCatalog()` (the content families, the content layouts and
  the composition layouts) or `options.catalog`. A refused draft returns
  `ok: false` with an empty `html` and `text` and the validation
  diagnostics; only the sink-free render tree is ever mapped.
- **Escaped by construction.** Output is built with `@texuli/core/markup`:
  every text and attribute value is escaped, element and attribute names
  are allowlisted, and there is no raw-markup API. There are no scripts,
  `<style>` elements, forms, frames, event handlers or remote fonts.
- **URL policy.** `emailLink(raw, { base })` passes `safeHref` and
  `emailImage(raw, { base })` passes `safeImageSrc` at the `untrusted`
  tier; links must end up absolute `https:` or `mailto:`, images absolute
  `https:`. A relative value resolves only against `baseUrl` (itself an
  absolute `https` URL, else `email-base-refused`); protocol-relative and
  fragment values are refused. A refused link keeps its text
  (`email-link-refused`); a refused image keeps its alt text
  (`email-image-refused`). Links inside Markdown text must be absolute
  already (the block parser refuses relative ones).

## The email subset

`EMAIL_COMPONENT_IDS` lists the ids that paint: the content and
composition layouts (`layout-page`, `layout-doc`, `layout-card`,
`layout-grid`, `layout-deck`, `deck-slide`, `layout-stack`, `layout-row`,
`layout-split`, `layout-tile`), the `blocks-text`, `blocks-structure`,
`blocks-data`, `blocks-media` and `blocks-code` families, and
`media-image`. `EMAIL_BLOCK_TYPES` lists the block types inside them:
headings, Markdown text, lists, quotes, callouts, dividers, code, calls to
action (button links), columns, cards, images, figures, galleries, tables,
stats and KPIs.

Anything else (charts, diagrams, maps, interactive blocks, other ids)
falls back to its text (title, label, description) or is dropped, with an
`email-unsupported` warning. Layout is tables: at most two columns, one
level deep (`layout-row`, `layout-split` and `layout-grid` with two
children, `columns` blocks with two columns); more columns stack with
`email-columns-stacked`. Images scale to the content width
(`width - 48`, default 552 pixels) keeping their ratio.

`EmailDiagnostic` is `{ code, severity, path, message, id? }`.

## Options (`EmailOptions`)

| Option | Default | What it does |
| --- | --- | --- |
| `catalog` | `emailRenderCatalog()` | The catalog the draft is validated against |
| `title` | first heading, else `Message` | The `<title>` |
| `preheader` | none | Hidden preview text, also the first line of `text` |
| `lang`, `dir` | `en`, `ltr` | Document language and direction; text alignment and quote borders follow `dir` (mail clients lack logical properties, so the physical side is chosen from it) |
| `baseUrl` | none | Absolute `https` base for relative links and images |
| `theme`, `mode` | default palette, `light` | The theme whose colors and font resolve to inline styles; `mode` also picks the design-system mode to inline |
| `designSystem` | none | A compiled design system (see below): colors, fonts, radius and spacing, plus the dark head rule |
| `width` | 600 | Content width, 320 to 800 pixels |

## Styles and colors

Every style is an `EmailStyle`: a typed object over the closed
`EMAIL_STYLE_PROPERTIES` (`EmailStyleProperty`), serialized by
`serializeEmailStyle`, which checks each value against its property's
grammar (colors are `#rrggbb`, lengths bounded pixels or percents,
keywords from closed sets, font stacks of plain names) and throws on
anything else. There is no CSS parser.

`resolveEmailPalette(theme, mode)` resolves the theme's `--tx-*` roles to
an `EmailPalette` of concrete sRGB hex colors with `toSrgbHex` (`#rgb`,
`#rrggbb`, `rgb()` and `oklch()`, gamut-mapped with `oklchToHex`), because
mail clients support neither OKLCH nor custom properties; a role it cannot
resolve keeps `DEFAULT_EMAIL_PALETTE`. `emailFontFamily(theme)` keeps only
plain font names from the theme and appends a system stack.

`emailFontStack(stack, fallback)` is the same filter for any CSS stack;
`EMAIL_SYSTEM_FONT` and `EMAIL_MONO_FONT` are the fallbacks.

## Design systems

`designSystem` takes a compiled design system (`compileDesignSystem(…)`
from `@texuli/tokens/design-system/compile` with `ok: true`, or anything
with its `vars`; the type is `DesignVarsSource`). `designValues(source,
mode)` resolves one mode to plain `DesignValues` (`mode`, `colors` as
`#rrggbb` per `DesignColorRole` from `DESIGN_COLOR_ROLES`, `fonts.sans`,
`fonts.heading` and `fonts.mono` as stacks, `radius` and `space` in
pixels); it is shared with `@texuli/tools/print` and never throws.

- **Colors:** `designEmailPalette(colors, base)` overlays the resolved
  roles on the palette (`EMAIL_PALETTE_DESIGN_ROLES` names the role each
  key reads). The design wins over `theme`.
- **Fonts:** body text uses `fonts.sans`, headings `fonts.heading` and
  code `fonts.mono`, each filtered by `emailFontStack`.
- **Radius and spacing:** the card radius is `--tx-radius` (0 to 32 px);
  buttons and code blocks use three quarters of it. Paddings, gaps and
  indents are multiples of `--tx-space-1` (2 to 8 px). The defaults are
  8 px and 4 px, so the default output is unchanged.
- **Dark mode:** when `mode` is `light` and the dark mode was compiled,
  the head declares `color-scheme: light dark` (and
  `supported-color-schemes`) and carries one typed rule set,
  `@media (prefers-color-scheme: dark){…}`. `emailDarkMode(tree, light,
  dark)` gives every element whose inline style paints a palette color a
  generated class (`tx-bg-<hex>`, `tx-fg-<hex>`, `tx-bd-<hex>`) and maps
  each class to the compiled dark value with `!important`. Selectors are a
  fixed prefix and a hex, declarations a fixed property and a hex, and the
  rule is checked against that grammar before it is written; nothing from
  content reaches it. Two roles that share a light color share one dark
  value, in role priority order. Clients that ignore the media query (many
  do) keep the light inline styles.

Without `designSystem`, the output is byte-for-byte what it was before
(a test pins its SHA-256). Planned: an `email` envelope profile in a
later spec minor.

## Limits

Input size, depth and node counts are the `validateDraft` tree limits
(256 KiB, 512 nodes, 64 children per node); Markdown is the block parser's
closed subset (4,000 characters per text). Rendering is linear in the tree:
the tests time a 5 MB input (refused) and a 60-block draft of pathological
Markdown.
