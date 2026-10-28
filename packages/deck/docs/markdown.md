# Markdown dialect (`@texuli/deck/markdown`)

The deck Markdown dialect: a plain-text way to write a deck that reads into
the same validated deck model v2 as JSON (ADR-009). The syntax takes
inspiration from reveal.js Markdown (`---` slides, `--` vertical stacks,
`Note:`, `<!-- .slide: -->` and `<!-- .element: -->` comments), but it is its
own closed dialect: reveal.js documents are not a compatibility target, some
reveal.js attributes are mapped and the rest are reported and dropped, and
there is no HTML at all.

> **Status:** in the repository as `@texuli/deck` `0.4.0`, not on npm.

```ts
import { deckToMarkdown, parseDeckMarkdown } from '@texuli/deck/markdown';

const result = parseDeckMarkdown(text);
if (result.ok) {
  const markdown = deckToMarkdown(result.deck); // canonical form
} else {
  for (const issue of result.issues) {
    console.log(`${issue.source?.line}:${issue.source?.column} ${issue.code} ${issue.message}`);
  }
}
```

The reader is an owned linear parser: one pass over the lines, every loop
advances, and every bound in `DECK_MARKDOWN_LIMITS` stops hostile input with
a diagnostic.

## Reading and writing

- `parseDeckMarkdown(text, options?)` returns a `DeckMarkdownResult`: the
  same fields as `parseDeck` (`ok`, `deck`, `issues`, `steps`, `truncated`)
  plus the `draft` (the deck object before model validation, for editors) and
  the `sourceMap` (JSON path such as `$.slides[2].props.title` → line and
  column). `ParseDeckMarkdownOptions` are the `parseDeck` options, so the
  host hooks (`validateBlock`, `validateComponent`, `knownComponents`) and
  `maxIssues` work here too. It never throws.
- Every issue has a `source` line and column (1-based; columns count UTF-16
  units). The dialect's own issues are located while reading; model issues
  (JSON paths) are mapped back through the source map to the nearest
  recorded position.
- `readDeckDraft(text)` reads without validating and returns a `DeckDraft`
  (`draft`, the issue sink and the map).
- `deckToMarkdown(deck)` writes canonical Markdown;
  `writeDeckMarkdown(deck)` returns a `DeckMarkdownWriteResult` with the
  `markdown` and `md-unrepresentable` warnings. See
  [Round trip](#round-trip).
- `deriveSlideId(slide, index, used)` is the id rule the reader and writer
  share (below).

## A complete document

```markdown
---
title: Quarterly review
description: Fictional numbers for a demo deck.
author: Ada Example
locale: en
theme: nord
transition: slide
---

<!-- .slide: layout=title-hero -->

# Quarterly review

What shipped and what is next

*Ada Example · Example Conf · 2026*

Note: Welcome everyone and set the agenda.

---

<!-- .slide: section=priorities section-title="Priorities" -->

## Priorities

- Ship smaller changes <!-- .element: fragment -->
- Measure every release <!-- .element: fragment -->

--

## Ship smaller changes

Every merged change ships the same day.

---

<!-- .slide: id=adoption layout=big-stat background=gradient-dusk -->

**87%** of releases shipped on the day they merged

*Source: a fictional team, twelve months*
```

## Frontmatter

An optional block between `---` lines at the top (at most 64 lines). It is
not YAML: a closed key set (`FRONTMATTER_KEYS`), one scalar per line, no
lists, maps, anchors, tags or multi-line values. Values are bare, or quoted
with `"…"` (escapes `\"` and `\\`) or `'…'` (`''` for a quote). `#` lines are
comments. Kebab-case spellings (`font-pair`, `slide-numbers`, `code-theme`,
`auto-slide`, `theme-mode`, `theme-seed`, `outline-title`) are accepted on
input; the writer uses camelCase.

| Key | Goes to | Type |
| --- | --- | --- |
| `title` | `meta.title` | string (a missing title is derived from the first slide, with `md-title-missing`) |
| `description`, `author`, `date`, `locale`, `dir` | `meta.*` | string |
| `theme` | `style.theme` | catalog theme id |
| `themeMode` | `style.theme.mode` | `light`, `dark`, `high-contrast`, `system` (needs `theme` or `themeSeed`) |
| `themeSeed` | `style.theme` as `{ kind: 'seed' }` | whole number (excludes `theme`) |
| `fontPair`, `aspect`, `density`, `radius`, `motion`, `transition`, `logo`, `footer`, `progress`, `codeTheme` | `style.*` | string |
| `background` | `style.background` | a preset id, a palette token or `#rgb`/`#rrggbb` |
| `slideNumbers`, `math` | `style.*` | `true` or `false` |
| `start` | `navigation.start` | slide id |
| `loop` | `navigation.loop` | `true` or `false` |
| `autoSlide` | `navigation.autoSlideMs` | whole number of milliseconds |
| `outlineTitle` | `outline.title` | string (needs at least one section) |

## Slides, stacks and sections

- A line of three or more dashes (`---`) starts a new horizontal slide; a
  line of exactly `--` starts a vertical slide stacked under the previous
  one. Separators inside code and math fences do not count. Empty slides are
  dropped. A `--` with no slide before it is `md-stack-start`.
- A horizontal slide followed by `--` slides becomes an outline section with
  `stack: true`. Its id is `stack-<first slide id>` unless the first
  (horizontal) slide sets `section=<id>`, and `section-title="…"` on that
  slide names it.
- `section=<id>` on a horizontal slide opens a named section that collects
  the following horizontal slides until the next `section=` or a
  `section-end` flag. `section-title` without `section` is
  `md-attr-conflict`.
- **Slide ids** come from `id=` on the slide; otherwise they are derived
  from the slide title (the `title` attribute, the layout's title prop, or a
  free slide's first heading) as a lowercase ASCII slug of at most 48
  characters, made unique with `-2`, `-3`…; a slide with no title becomes
  `slide-<n>`.

## Slide attributes

`<!-- .slide: … -->` at the top level of a slide sets slide fields. It must
open and close on one line. Values are bare tokens or quoted (`"…"` or
`'…'`, no escapes); at most 32 attributes per comment, 512 characters per
value; a bare name is a flag.

```markdown
<!-- .slide: id=pricing layout=comparison-table title="Plans" transition=zoom background=pattern-grid steps="Columns|Rows" -->
```

| Attribute | Sets |
| --- | --- |
| `id` | The slide id. |
| `layout` | A catalog layout id, `free` (default), `component` or `custom`. |
| `master` | A free slide's master (`title`, `section`, `content`, `two-column`, `media-left`, `media-right`, `quote`, `closing`); a conflict on other kinds. |
| `title` | The slide title. |
| `theme` | A catalog theme id for this slide. |
| `transition` | `none`, `fade`, `fade-up`, `slide`, `zoom`, `morph`. |
| `auto-animate` | Flag: the `morph` transition. |
| `hidden` | Flag (or `true`/`false`). |
| `steps` | Step labels separated by `\|`: `steps="Problem\|Fix\|Result"`. |
| `background` | A background preset id. |
| `background-color` | A palette token (`background`, `surface`, `primary`, `accent`, `muted`, `inverse`) or `#rgb`/`#rrggbb`. |
| `background-gradient` | A gradient preset name with an optional angle: `"dusk, 135deg"`. |
| `background-pattern` | `dots` or `grid`. |
| `background-image`, `background-video` | A media source (an image or video background). |
| `background-full`, `background-alt`, `background-poster`, `background-fit`, `background-position`, `background-overlay`, `tone` | Image and video background options (`fit`: `cover`, `contain`; `position`: `center`, `top`, `bottom`, `left`, `right`; `overlay`: 0 to 0.9; `tone`: `dark`, `light`). |
| `section`, `section-title`, `section-end` | Outline sections (above). |

A slide has one background: setting two kinds is `md-attr-conflict`, and the
media options without an image or video are too.

**reveal.js aliases** are mapped: `data-background-color`, `-image`,
`-video`, `-size` (to `background-fit`), `-position`, `-gradient` (preset
names only), `data-transition` (`convex` and `concave` play as `slide`;
`-in`/`-out` suffixes are dropped, with a warning), `data-auto-animate`,
`data-visibility="hidden"`, and `data-background-opacity` (turned into an
overlay). The classes `has-dark-background`, `has-light-background`,
`slide-bg-overlay--dark` and `slide-bg-overlay--light` set the media tone and
overlay. `data-background-video-loop` and `-muted` are accepted and implied
(background video always loops, muted). Other `data-*` attributes
(`data-transition-speed`, `data-autoslide`, `data-state`, `data-timing`…)
are `md-attr-unsupported` warnings and dropped; anything else is
`md-attr-unknown`.

## Free-slide content

A slide without a `layout` (or with `layout=free`) turns each Markdown block
into a content block, in order:

| Markdown | Block |
| --- | --- |
| `# Heading` to `###### Heading` | `{ type: 'heading', level, text }` (plain text: inline Markdown shows literally, `md-heading-inline`) |
| A paragraph | `{ type: 'text', markdown }`; inline Markdown stays as the string `@texuli/blocks` paints |
| `- item` or `1. item` | `{ type: 'list', items, ordered? }` (indented continuation lines and nested lists stay in the item text) |
| `> quote` with a last line `— Name` (or `--`, `-`) | `{ type: 'quote', quote, cite? }` |
| A pipe table | `{ type: 'table', columns: [{ id: 'c1', label }], rows }` (empty cells are `null`) |
| `![alt](src "caption")` alone on a line | `{ type: 'image', src, alt, caption? }` |
| `***` or `___` | `{ type: 'divider' }` |
| A code fence | `{ type: 'code', code, lang?, highlights?, filename?, caption?, lineNumbers? }` |
| `$$ … $$` | `{ type: 'math', tex }` |
| `::: component <id>` | A component item |
| `::: block <type>` | Any block, as JSON |

```markdown
## Release checklist

1. Open a small pull request
2. Wait for the checks

> Make the next step obvious, then make it small.
>
> — Marco Example

| Stage | Owner |
| --- | --- |
| Review | Ada |
| Release | Marco |

![A placeholder diagram](https://example.com/media/diagram.webp "The pipeline")
<!-- .element: width=640 height=480 -->

***

::: block callout
{ "tone": "info", "title": "Tip", "body": "Every block type can be written as JSON." }
:::
```

`::: block <type>` takes one JSON object (its `type` is filled from the
argument and must match it). Use it for any `@texuli/blocks` block without a
Markdown form; the host's block validator checks the body.

## Element attributes and fragments

`<!-- .element: … -->` sets attributes on the element before it: at the end
of the element's line, or on the next line. Code fences, `:::` directives
and regions take the same attributes in a brace list, `{#id key=value flag}`,
where `#slug` is the `id`.

| Attribute | Meaning |
| --- | --- |
| `fragment` | Reveal the element on its own step; `fragment=<effect>` picks the effect. |
| `class="fragment <effect>"` | The same, reveal.js style; any other class is `md-class-refused`. |
| `step=<n>` (or `data-fragment-index`) | An explicit step number (0 to 1,000). |
| `reveal=<name>` | The earlier block reveal vocabulary (`fade`, `fade-up`, `grow`, `highlight`, `strike`). |
| `tone=<tone>` | `neutral`, `accent`, `info`, `success`, `warning`, `danger`. |
| `id=<slug>` | The block id. |

Effects are the model's eight (`in`, `fade-up`, `out`, `in-then-out`,
`grow`, `shrink`, `highlight`, `strike`). reveal.js names map onto them
(`mapEffect`): `fade-in` and `fade` → `in`, `fade-out` → `out`,
`fade-in-then-out` → `in-then-out`, `highlight-red`/`-blue`/`-green` →
`highlight` with the `danger`/`info`/`success` tone. Approximate mappings
warn with `md-effect-approximated`: `highlight-current-*` → `highlight`,
`fade-down`, `fade-left`, `fade-right` and `fade-in-then-semi-out` →
`fade-up`, `semi-fade-out` → `out`, `zoom-in` → `grow`, `current-visible` →
`in-then-out`.

**Numbering follows document order.** A fragment without `step` takes the
next number; an explicit `step` is kept. Marked list items reveal one after
another from the first marked item; when their effects differ, the whole
list steps from its first fragment with `md-fragment-approximated`. A
fragment where the layout reveals nothing is dropped with
`md-fragment-not-steppable`.

```markdown
## Plan

First this paragraph. <!-- .element: fragment=fade-up -->

- Then this item <!-- .element: fragment -->
- And this one <!-- .element: fragment -->

This one is highlighted last. <!-- .element: fragment=highlight-red -->
```

Allowed extras depend on the target: `width`, `height` (whole pixels, 1 to
4,096) and `decorative` on images; `filename`, `caption` and `numbers` on
code fences; `height` on component fences; `avatar` on team members;
`overlay` on a full-bleed image.

## Code fences

````markdown
```ts [1-2|4] {filename="total.ts" numbers}
export function total(items: number[]) {
  return items.reduce((a, b) => a + b, 0);
}
console.log(total([1, 2, 3]));
```
````

The info string is a lowercase language id, optional highlight steps in
brackets (line ranges such as `1-2,4` separated by `|`, at most 16; each
range is one step), and an optional brace list. A reveal.js `[n: …]` line
offset is dropped with `md-code-offset-unsupported`; unread text after the
language is `md-code-info`. Fences open with three or more backticks or
tildes.

## Math

```markdown
$$ E = mc^2 $$

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$
```

`$$ … $$` on one line or a `$$` block becomes `{ type: 'math', tex }`. The TeX
is checked against the owned [math](math.md) subset while reading;
unsupported commands are `md-tex-unsupported` and oversize formulas
`md-tex-limit` (the formula then shows as source text). Inline `$…$` inside a
paragraph stays in the text string as written; rendering it is a follow-up in
`@texuli/blocks`.

## Layouts and regions

`<!-- .slide: layout=<id> -->` maps the slide's Markdown onto the layout's
props. Content the layout has no field for is `md-layout-extra`; a missing
required part is `md-layout-missing`. `:::` regions hold Markdown, close with
a bare `:::`, and may hold a JSON fence but not another region
(`md-directive-depth`).

| Layout | Markdown |
| --- | --- |
| `title-hero` | A heading → `title`; a paragraph → `subtitle`; an `*italic*` paragraph → `meta`. |
| `section-divider` | An `*italic*` paragraph → `eyebrow`; a heading → `title`. |
| `two-column-split` | `#`/`##` → `title`; `::: left` and `::: right` regions, each with a `###` heading → `heading` and a paragraph → `body`. |
| `three-column-cards` | `#`/`##` → `title`; three `::: card {icon=<name>}` regions, each with `###` → `heading` and a paragraph → `body`. |
| `image-left`, `image-right` | `#`/`##` → `title`; an image line → `image`; `###` → `heading`; a paragraph → `body`. |
| `image-centered` | `#`/`##` → `title`; an image line → `image`; `*italic*` → `caption`. |
| `image-full-bleed` | An image line (`overlay=` on its element comment) → `image`; `*italic*` → `caption`; `*Credit: …*` → `credit`. |
| `quote` | `> quote` with a `— Name` last line → `quote` and `cite`. |
| `code-with-callout` | `#`/`##` → `title`; a code fence with a language → `code` (its `[…]` steps → `highlights`); `###` → `heading`; a list → `bullets`. |
| `big-stat` | A `**number** label` paragraph; `*Source: …*` → `source`; a paragraph → `context`. |
| `comparison-table` | `#`/`##` → `title`; a pipe table: the header after the first cell → `columns`, each row's first cell → `label`, `Yes`/`No` → `true`/`false`, empty → `null`. |
| `process-steps` | `#`/`##` → `title`; a numbered list of `**Title** body` items. |
| `timeline` | `#`/`##` → `title`; a bullet list of `**time** text` items. |
| `team-avatars` | `#`/`##` → `title`; a bullet list of `**Name** — Role` items, `avatar=av-001` on each item's element comment. |
| `closing-cta` | A heading → `title`; a `[Label](href)` paragraph → `cta`; `*italic*` → `footnote`; a paragraph → `text`. |
| `video-centered` | `#`/`##` → `title`; a `::: video {src=… label="…" width=… height=… autoplay loop muted}` region → `video`; `*italic*` → `caption`. |
| `video-left`, `video-right` | `#`/`##` → `title`; a `::: video {…}` region; `###` → `heading`; a paragraph → `body`. |
| `chart` | `#`/`##` → `title`; a `::: chart {height=md table}` fence whose JSON body is the chart `spec` (put step fields inside the JSON). |

Any catalog layout may instead take its props as one JSON object in a
`::: props` fence.

```markdown
<!-- .slide: layout=two-column-split -->

## Before and after

::: left
### Before
Releases waited for a weekly window.
:::

::: right {fragment}
### After
Every merged change ships the same day.
:::
```

```markdown
<!-- .slide: layout=quote -->

> Make the next step obvious, then make it small.
>
> — Marco Example
```

```markdown
<!-- .slide: layout=closing-cta -->

# Questions?

Thank you for listening.

[Read the guide](https://example.com/guide)

*All names and numbers are fictional.*
```

## Component, custom and JSON fences

`:::` fences whose body is JSON: `component`, `block`, `custom`, `props`,
`slide` and `chart`. The body is one strict JSON object (RFC 8259, no
duplicate or prototype keys, finite numbers), read by the owned bounded
reader `readJson` (`JsonReadOptions`, `JsonReadResult`) within the
`jsonBody`, `jsonDepth` and document-wide `jsonNodes` bounds. Every value's
position is recorded, so a model issue inside component props points at its
exact line and column.

```markdown
<!-- .slide: layout=component title="Signups" -->

::: component chart
{ "title": "Signups per week" }
:::

---

## Live poll

::: component poll {height=md}
{ "question": "Ship on Fridays?" }
:::

---

<!-- .slide: layout=custom -->

::: custom roadmap-board
{ "quarter": "Q3" }
:::

---

::: slide
{ "layout": "quote", "props": { "quote": "Small steps." } }
:::
```

- `::: component <id>` on a free slide is a component item; on a
  `layout=component` slide it is the whole slide. An empty body is `{}`.
  Props are validated later by the host registry at its trust tier.
- `::: custom <component>` on a `layout=custom` slide, with optional JSON
  `data`.
- `::: slide` is the whole slide as JSON (notes still come from `Note:`).
- A document cannot choose its trust tier: a `tier` attribute is
  `md-tier-ignored`.

## Notes

A line starting with `Note:` or `Notes:` (any case of the first letter)
starts the speaker notes; everything after it, to the end of the slide, is
the notes text. The writer escapes notes lines that would read as separators
or fence openers with a leading `\`.

## Refused: HTML, iframes, classes, styles and handlers

There is no HTML sink anywhere in the dialect:

- A line that starts with an HTML tag is `md-html-refused` and renders
  nothing; an `<iframe>` is `md-iframe-refused` (use `::: component <id>`).
- Inline tags inside text are `md-html-refused` and stay literal text
  (escaped). Autolinks (`<https://…>`) are links, not tags.
- `style` attributes (`md-style-refused`), `on*` handlers
  (`md-handler-refused`), any attribute naming an iframe, and classes that
  map to nothing (`md-class-refused`) are refused.
- CSS values (a CSS gradient, `url(…)`) in background attributes are
  `md-css-refused`; name a preset instead.
- Links must be `https:`, `mailto:`, a `#fragment` or a relative path, and
  media an `https:` URL, a relative path (no `..` or `.svg`, in any letter
  case and also percent-encoded), a base64
  `data:` raster or video, or an `avatar:` id. Anything else
  (`javascript:`, `data:text/html`, protocol-relative URLs) is
  `md-url-refused`. An image inside text renders as its alt text
  (`md-inline-image`).
- Control, bidi and invisible formatting characters are removed before
  parsing and reported (`md-invisible-char`).

These are syntax checks; the stage still applies the URL policy at the
host's tier when it paints.

## Limits

`DECK_MARKDOWN_LIMITS`:

| Key | Value |
| --- | --- |
| `bytes` | 1,048,576 UTF-8 bytes |
| `lines` | 100,000 |
| `lineLength` | 20,000 UTF-16 units |
| `frontmatterLines` | 64 |
| `slides` | 200 |
| `attributes` | 32 per comment or brace list |
| `attributeValue` | 512 UTF-16 units |
| `directiveDepth` | 2 (a region holding a fence) |
| `jsonBody` | 65,536 UTF-16 units per fence |
| `jsonDepth` | 32 |
| `jsonNodes` | 20,000 JSON values per document |
| `codeSteps` | 16 highlight steps per fence |
| `issues` | 200 |

An unclosed code fence, math block or region runs to the end of its slide
(never past the next separator) and is reported.

## Diagnostics

The dialect's codes are `DECK_MARKDOWN_CODES` (type `DeckMarkdownCode`, one
`DeckMarkdownCodeInfo` row each); model codes are in
[model](model.md#diagnostics).

| Code | Severity | Meaning |
| --- | --- | --- |
| `md-too-large` | error | The document is over the byte, line or line-length bound. |
| `md-invisible-char` | error | A control, bidi or invisible formatting character (removed before parsing). |
| `md-frontmatter-key` | error | The frontmatter key is not in the closed key set. |
| `md-frontmatter-value` | error | The frontmatter value is not a scalar of the right type (no lists, maps or YAML tags). |
| `md-frontmatter-unclosed` | error | The frontmatter has no closing `---`. |
| `md-title-missing` | warning | No `title` in the frontmatter; one was derived. |
| `md-html-refused` | error | Raw HTML is refused; it renders nothing (inline tags stay text). |
| `md-iframe-refused` | error | iframes (tags and backgrounds) are refused. |
| `md-css-refused` | error | A CSS value (gradient, url()) is refused; use a preset. |
| `md-class-refused` | error | A `class` that maps to nothing is refused. |
| `md-style-refused` | error | A `style` attribute is refused. |
| `md-handler-refused` | error | An `on*` event handler attribute is refused. |
| `md-attr-unknown` | error | The attribute is not in the closed attribute set. |
| `md-attr-unsupported` | warning | A reveal.js attribute with no deck equivalent; dropped. |
| `md-attr-value` | error | The attribute value is invalid, or the comment is malformed. |
| `md-attr-duplicate` | error | The attribute is set twice for the same target. |
| `md-attr-conflict` | error | Two attributes contradict each other. |
| `md-comment-unclosed` | error | An HTML comment never closes before the end of the slide. |
| `md-element-orphan` | error | An `.element` comment has no element before it. |
| `md-effect-approximated` | warning | A reveal.js fragment effect with no exact equivalent was mapped to the nearest one. |
| `md-fragment-approximated` | warning | Per-item fragments that differ were folded into one list-level step. |
| `md-fragment-not-steppable` | warning | This layout does not reveal that element; the fragment was dropped. |
| `md-layout-unknown` | error | The `layout` is not one of the 20 layouts or a slide kind. |
| `md-layout-extra` | error | Content the layout has no field for. |
| `md-layout-missing` | error | A field the layout needs is missing from the slide. |
| `md-region-unknown` | error | The `:::` directive is unknown, or not allowed here. |
| `md-region-unclosed` | error | A `:::` directive never closes before the end of the slide. |
| `md-directive-depth` | error | Directives nest deeper than a region holding a fence. |
| `md-json` | error | A `:::` JSON body is not one valid JSON object. |
| `md-json-limit` | error | A `:::` JSON body is over a size, depth or node bound. |
| `md-tier-ignored` | warning | The document cannot choose a trust tier; the host does. |
| `md-code-unclosed` | error | A code fence never closes before the end of the slide. |
| `md-code-steps` | error | A `[1-2\|4-6]` highlight step list is malformed or too long. |
| `md-code-offset-unsupported` | warning | A `[n: …]` line offset is not supported; dropped. |
| `md-code-info` | warning | Unread text after a code fence language; dropped. |
| `md-math-unclosed` | error | A `$$` block never closes before the end of the slide. |
| `md-tex-unsupported` | error | The formula uses TeX outside the supported subset. |
| `md-tex-limit` | error | The formula is over a size, nesting or node bound. |
| `md-url-refused` | error | A link or media URL fails the deck URL syntax. |
| `md-inline-image` | warning | An image inside text renders as its alt text only. |
| `md-heading-inline` | warning | Headings are plain text; inline Markdown shows literally. |
| `md-too-many-slides` | error | More than 200 slides; the rest were not read. |
| `md-stack-start` | error | A `--` vertical slide with no horizontal slide before it. |
| `md-unrepresentable` | warning | A deck field the Markdown dialect cannot express. |

For example, `<div>` at the start of line 9 gives
`{ code: 'md-html-refused', severity: 'error', source: { line: 9, column: 1 }, … }`.

## Round trip

`deckToMarkdown(deck)` writes canonical Markdown so that JSON → Markdown →
JSON gives the same deck:

- The writer prefers readable Markdown and proves it: every free block and
  every slide is read back and compared. Whatever would not survive falls
  back to an exact JSON fence: `::: block` for one block, `::: props` for a
  layout's props, `::: slide` for the whole slide. Slides and blocks always
  round-trip.
- Frontmatter keys are written in canonical order, camelCase, bare when
  unambiguous and double-quoted otherwise.
- An `id=` attribute is written only when the slide id differs from the id
  the reader would derive.
- Free-slide fragments omit `step=` when the step is the next number in
  document order; layout fragments always carry an explicit `step=`.
- Deck-level fields the dialect cannot hold (a field with a line break, a
  part of `meta`, `style`, `navigation` or `outline` that does not read back)
  are reported by `writeDeckMarkdown` as `md-unrepresentable` warnings,
  never silently dropped.

The tests check this on every starter deck in `packages/deck/decks/` and on
migrated Protoyard fixtures (`tests/markdown-roundtrip.test.ts`,
`tests/authoring.test.ts`).

## Text twins

One-way plain-text views, pure and deterministic; nothing an author typed
becomes HTML or a link target in them:

- `deckToText(deck, options?)`: a readable Markdown document for
  accessibility, artifact descriptions and LLM context. `DeckTextOptions`:
  `title` (when the deck has none), `includeHidden` (default `false`),
  `notes` (default `true`). Math becomes its plain text.
- `deckOutline(deck, options?)`: one compact row per slide
  (`DeckOutlineText` with a `title` and `DeckOutlineSlide` rows: `number`,
  `id`, `layout`, `title`, `section`, `hidden`), hidden slides included by
  default. `formatDeckOutline(outline)` prints it as
  `1. opening · title-hero · Quarterly review`.
- `slideTitle(slide)`: a slide's title, or its first heading, or `null`.

## Lower-level exports

For editors and tools built on the dialect: `readAttributes` (the attribute
lexer, returning `Attr` entries), `writeAttribute` and `attributeWritable`
(how the writer quotes values), `mapEffect` (the effect table above),
`FRONTMATTER_KEYS` and `readJson`.
