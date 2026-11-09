# List and ListItem

**Package:** `texuli`  
**Import:** `import { List, ListItem } from 'texuli/list-item'` (also from `texuli`)  
**Catalog ids:** `list`, `list-item`  
**Tests:** `packages/texuli/tests/display.test.ts` (`ListItem (UG-42)`),
`packages/texuli/tests/protoyard-round3.test.ts`,
`packages/texuli/tests/contract.test.ts`  
**Example:** `texuli-list-item`  
**Status:** ListItem since `0.14.3`; List and `divided` for locked prototypes (spec `0.13.0`)

One row of a list: leading media or an icon, a title and a description,
trailing meta text, and trailing controls. The row is a link (`href`), a
button (`onSelect`) or plain text. `List` is the `<ul>` that holds the rows;
`divided` draws a token hairline (`--tx-border`) between them.

## Markup

`ListItem` renders an `li`, so it goes inside a list. `List` renders
`<ul role="list" class="tx-list">`: `role="list"` keeps the list semantics
that some browsers drop once `list-style: none` applies, and `tx-list`
resets the list margin, padding and bullets.

```svelte
<script lang="ts">
  import { List, ListItem } from 'texuli/list-item';
  import { Avatar } from 'texuli/avatar';
  import { IconButton } from 'texuli/button';
</script>

<List divided aria-label="Recent activity">
  <ListItem
    title="Ada Example"
    description="Shared the launch checklist"
    meta="09:41"
    href="https://example.com/activity/1"
  >
    {#snippet leading()}<Avatar name="Ada Example" size="sm" />{/snippet}
    {#snippet trailing()}<IconButton label="More for Ada Example" size="sm">⋯</IconButton>{/snippet}
  </ListItem>
  <ListItem title="Mentions only" icon="check" onSelect={() => choose('mentions')} />
</List>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | — | The primary line, escaped text. `children` replaces it. |
| `description` | `string` | — | A secondary line under the title. |
| `meta` | `string` | — | Short trailing text inside the row (a time, a count). |
| `icon` | `IconRef` | — | A decorative leading icon: a built-in or registered name (`texuli/icons`) or a Svelte SVG component. `leading` replaces it. |
| `leading` | `Snippet` | — | Leading media (an avatar, a thumbnail). Give decorative images `alt=""`. |
| `trailing` | `Snippet` | — | Controls after the row, rendered outside the link or button so they are never nested in another control. |
| `children` | `Snippet` | — | Rich title content. |
| `href` | `string` | — | Makes the row one link. Filtered by `safeHref` at `hrefTrust`; a rejected value renders no link (the row falls back to `onSelect`, or plain text). |
| `hrefTrust` | `HrefTrust` | `developer` | Use `untrusted` for agent or user content. |
| `target` | `string` | — | Link target; `_blank` adds `rel="noopener noreferrer"`. |
| `current` | `boolean` | `false` | `aria-current="page"` on the link, with the hover fill. |
| `onSelect` | `() => void` | — | Makes the row one `button type="button"` when there is no safe `href`. |
| `disabled` | `boolean` | `false` | Disables the `onSelect` button. |
| `divided` | `boolean` | `false` | Hairline under this row when it is not inside a divided `List`. |
| `class`, `ref` | | | `ref` is the root `li` (bindable). |

`List` takes `divided` (hairline between items; spacing still scales with
`--tx-density`), `class`, `ref` (the `ul`) and `children` (the `ListItem`
rows). Other attributes land on the `ul`.

Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the
root `li`, as the component API contract requires.

## Accessibility

- The `li` keeps the `listitem` role inside `ul role="list"`; name the list
  with `aria-label` or `aria-labelledby` when the page has several.
- A link or button row is named by its content (title, description and
  meta), so keep them short. The leading icon is `aria-hidden`.
- Only the row control and the trailing controls take focus, in DOM order,
  which matches the visual order in left-to-right and right-to-left layouts
  (the layout uses logical properties).

Not yet: no component tokens (`--tx-list-item-*`; planned with the next
design-system spec minor). Catalog ids `list` and `list-item` are in the
0.13.0 catalog (`agentEmittable: false`).
