# Structure blocks

**Package:** `@texuli/blocks` · **Import:** `@texuli/blocks/structure` (lazy) or `@texuli/blocks/structure/renderers` (eager)

The structure family renders **columns**, **grid**, **tabs**, **accordion**, **cards**, **divider** and **cta** from **untrusted data**. Every block passes `safeParseBlock` / `checkStructureBlock` before anything paints. Rejected blocks become an inert, translatable notice.

## Entry points

| Import | What it gives you |
| --- | --- |
| `@texuli/blocks` | `loadStructureFamily()`, `checkStructureBlock`, `isStructureFamilyBlock`, `STRUCTURE_BLOCK_TYPES` |
| `@texuli/blocks/structure` | the above plus labels and owned parsers |
| `@texuli/blocks/structure/renderers` | `StructureFamily` (eager) |

```svelte
<script lang="ts">
  import { loadStructureFamily } from '@texuli/blocks';
  let { block }: { block: unknown } = $props();
</script>

{#await loadStructureFamily() then { default: StructureFamily }}
  <StructureFamily {block} />
{/await}
```

## Blocks

| Type | Notes |
| --- | --- |
| `columns` | 2–4 columns of nested blocks; nesting depth ≤ 3; reflows to one column on narrow viewports |
| `grid` | 1–12 cells with optional title/body markdown; `columns` 2–4 |
| `tabs` | Stable `id`, accessible `label`, 2–6 panels of nested blocks; optional `defaultPanel` |
| `accordion` | 1–6 items with title + optional markdown body; `mode` single\|multiple |
| `cards` | 1–12 cards with title, optional icon/eyebrow/body/href/tone; `columns` 2–4; hrefs use the untrusted URL policy; `icon` is a kebab-case icon name drawn decoratively above the title |
| `divider` | Thematic break (`hr`). `label` (plain text) centers on the rule and makes it a separator named by the label; `variant: "space"` is blank space hidden from screen readers (no label) |
| `cta` | 1–3 actions; each href must pass `safeHref(..., 'untrusted')` |

Nested children inside **columns** and **tabs** panels are validated as full blocks. The renderer lazy-loads the text and structure families for nested leaves; other families show the invalid notice until a host mounts them.

`StructureFamily` props: `block`, `labels?`, `oninvalid?(issues)`, and the
host resolvers `resolveIcon?(name)` (card icons; built-in Texuli icon names
draw without it, other names draw nothing) and `resolveAvatar?(id)`. Both
resolvers also reach the nested text and structure blocks (quote avatars,
list and callout icons). See [text](text.md) for the icon and avatar rules.

## UI dependencies

- Tabs and accordion mount `texuli/tabs-accordion` (owned primitives underneath).
- Cards mount `texuli/card` with `hrefTrust="untrusted"`.
- Markdown bodies go through the owned closed subset (`RichText`); never `{@html}`.

## Styles

Component-scoped CSS in `@layer tx.components`, logical properties, forced-colors borders. No static `style=` on chrome. Column and grid counts use `data-cols` attributes so consumer classes can override through the layer order.
