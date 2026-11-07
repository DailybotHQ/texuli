# ListItem

**Package:** `texuli`  
**Import:** `import { ListItem } from 'texuli/list-item'` (subpath only: the
`texuli` root does not export it)  
**Tests:** `packages/texuli/tests/display.test.ts` (`ListItem (UG-42)`),
`packages/texuli/tests/contract.test.ts`  
**Example:** `texuli-list-item`  
**Status:** new in `0.14.3`

One row of a list: leading media or an icon, a title and a description,
trailing meta text, and trailing controls. The row is a link (`href`), a
button (`onSelect`) or plain text.

## Markup

`ListItem` renders an `li`, so it goes inside a list. Use
`<ul role="list" class="tx-list">`: `role="list"` keeps the list semantics
that some browsers drop once `list-style: none` applies, and `tx-list`
resets the list margin, padding and bullets (the class ships with the
ListItem stylesheet).

```svelte
<script lang="ts">
  import { ListItem } from 'texuli/list-item';
  import { Avatar } from 'texuli/avatar';
  import { IconButton } from 'texuli/button';
</script>

<ul role="list" class="tx-list" aria-label="Recent activity">
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
</ul>
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
| `class`, `ref` | | | `ref` is the root `li` (bindable). |

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
design-system spec minor) and no catalog manifest (planned; it waits for a
spec minor because a catalog id changes the spec contract).
