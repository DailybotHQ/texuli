# Content layouts

**Package:** `texuli` · **Import:** `texuli/layouts/content`

Reading layouts for documentation, blog posts and long-form editorial pages:
a header with the brand and primary navigation, an article with a title,
summary and byline, a docs section list, and an "On this page" table of
contents that tracks the heading in view.

## Imports

| Subpath | Export |
| --- | --- |
| `texuli/layouts/content` | `ContentLayout` (direct use) and the TOC helpers `buildToc`, `headingSlug`, `resolveTocLevels`, `normalizeTocEntries`, `tocSelector`, `DEFAULT_TOC_LEVELS`, with the `TocEntry`, `TocItem`, `TocHeading`, `TocLevel` and `BuildTocOptions` types |
| `texuli/layouts/content/docs` | `loadDocsLayout`; registers `docs` with LayoutHost |
| `texuli/layouts/content/blog` | `loadBlogLayout`; registers `blog` with LayoutHost |
| `texuli/layouts/content/editorial` | `loadEditorialLayout`; registers `editorial` with LayoutHost |

The `docs`, `blog` and `editorial` subpaths keep the layout component out of
the initial chunk (LayoutHost loads it lazily). Import `texuli/layouts/content`
to render `ContentLayout` yourself.

## Direct use with declarative content

```svelte
<script lang="ts">
import { ContentLayout, type TocEntry } from 'texuli/layouts/content';

const toc: TocEntry[] = [
  { id: 'install', label: 'Install', level: 2 },
  { id: 'configure', label: 'Configure', level: 3 },
];
</script>

<ContentLayout kind="docs" options={{ title: 'Getting started' }} {toc}>
  <h2 id="install">Install</h2>
  <p>…</p>
  <h3 id="configure">Configure</h3>
  <p>…</p>
</ContentLayout>
```

## Props

| Prop | Default | Behavior |
| --- | --- | --- |
| `kind` | — (required) | `docs`, `blog` or `editorial`. |
| `children` | — | Declarative article content, rendered inside the content region. |
| `mountScreen` | — | Imperative mount, called once with the content element (the LayoutHost contract). Optional; works next to `children`. |
| `toc` | — | Host-supplied entries `{ id, label, level }`. When set, the layout lists exactly these (blank ids or labels and repeated ids dropped, an unknown level becomes 2) and never scans, renames or marks a heading. Each `id` names an element already on the page; the active entry follows those elements. |
| `tocLevels` | `[2, 3]` | Heading levels (2–6) the scanned TOC lists. Also read from `options.tocLevels` as a comma list (`"2,3,4"`); the prop wins. |
| `preserveHeadingIds` | `false` | Keep authored heading ids exactly as written: no id is assigned or changed, and headings without an id (or repeating an id already listed) stay out of the TOC. Also read from `options.preserveHeadingIds`; the prop wins. |
| `nav`, `path`, `options`, `storageKey`, `aside`, `class` | — | As in the [layout contract](layout-host.md). `options` keys `title`, `summary`, `eyebrow`, `author`, `date`, `readingTime` fill the article header. |

## Table of contents

Without `toc`, the layout scans the content for the chosen heading levels,
skipping any heading inside `[data-toc-ignore]`, and rescans when the content
changes. By default it keeps authored ids and gives an id-less heading a slug
of its text (`headingSlug`), suffixed (`-2`, `-3`) when an id is already
taken; a repeated authored id is suffixed too. Listed headings get
`tabindex="-1"` (unless they have a tabindex) and `data-tx-content-heading`.
`preserveHeadingIds` turns off every id write; `toc` turns off the scan and
every heading write. Every TOC link is a fragment (`#id`, URL-encoded) checked
by `safeHref`.

Compatibility: the scanned behavior with no new props is unchanged, except
that a heading's own `tabindex` is no longer overwritten. `TocItem.level` and
`TocHeading.level` widen from `2 | 3` to `TocLevel` (`2 | 3 | 4 | 5 | 6`).
Nothing is deprecated.

## Notes

- Logical CSS; pass `dir="rtl"` on a parent for RTL.
- Navigation links go through `safeHref` at the `developer` tier.
- When nested inside another `<main>`, the frame renders as a `div`.
