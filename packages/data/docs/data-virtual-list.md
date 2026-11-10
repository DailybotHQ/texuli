# Virtual list view

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/virtual-list`  
**Engine:** `packages/data/src/virtual-list/virtual-list.ts` (`createVirtualList`)  
**View:** `packages/data/src/virtual-list/VirtualListView.svelte`  
**Catalog id:** `data-virtual-list` (axes `size` and `density`; not agent-emittable)  
**Tests:** `packages/data/tests/virtual-list-component.test.ts`, `packages/data/tests/virtual-list-feed.test.ts`, `packages/data/tests/virtual-list-contract.test.ts`  
**Example:** `data-virtual-list-view` (the engine on its own: `data-virtual-list`)

`VirtualListView` renders a list of any length as a window: only the rows in
view, plus a few before and after, are in the page. It is new in `0.16.0` (ADR-032), built for locked design systems: a page uses it with no inline
style of its own.

## Usage

```svelte
<script lang="ts">
  import { VirtualListView } from '@texuli/data/virtual-list';

  const items = Array.from({ length: 10_000 }, (_, index) => ({
    id: `update-${index + 1}`,
    label: `Update ${index + 1}`,
  }));
  let selected = $state<string | number | undefined>();
</script>

<VirtualListView {items} label="Team feed" bind:selected estimateSize={56}>
  {#snippet row({ item, index, active, selected })}
    <strong>{item.label}</strong>
  {/snippet}
</VirtualListView>
```

Without a `row` snippet each row shows `item.label` (and `item.description`
when present) as text.

### A feed whose rows hold controls (`mode="feed"`, new in `0.16.1`)

When each row is a card with its own buttons, links or inputs, use the feed
mode. Rows are articles, nothing is selected, and the row snippet brings its
own chrome:

```svelte
<VirtualListView {items} label="Team feed" mode="feed" surface="plain" estimateSize={120}>
  {#snippet row({ item, labelId })}
    <h3 id={labelId}>{item.label}</h3>
    <button type="button">Reply</button>
  {/snippet}
</VirtualListView>
```

Put the `labelId` the snippet receives on the card's heading: it names the
article (below). `surface="plain"` drops the viewport's border, radius and
surface, so the cards sit on the page (new in `0.17.0`).

In a listbox you only want to activate rows, not select them. In that case,
`selectable={false}` keeps the listbox pattern: no row is selected or painted
as selected, but `onSelect` still fires on click, Enter and Space.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `readonly T[]` | required | Any length; only a window renders. |
| `label` | `string` | required | The listbox's or feed's accessible name. |
| `mode` | `'listbox' \| 'feed'` | `'listbox'` | `feed`: the APG feed pattern for rows with their own controls (below). |
| `selectable` | `boolean` | `true` | Listbox only. `false`: no selection is written or painted; `onSelect` still fires. |
| `row` | `Snippet<[{ item, index, active, selected, labelId }]>` | label text | Renders one row. In a feed, `labelId` is the id that names the article. |
| `getRowLabelId` | `(item, index) => string \| undefined` | the `labelId` | Feed with a `row` snippet: the id of your own element that names the article. |
| `surface` | `'box' \| 'plain'` | `'box'` | `plain`: no viewport border, radius or surface (for a feed of cards). |
| `getKey` | `(item, index) => string \| number` | `item.id`, else the index | What `selected` holds. |
| `getLabel` | `(item, index) => string` | `item.label` | The text when there is no `row` snippet. |
| `estimateSize` | `number` | `40` | Row height in px until the row is measured. |
| `overscan` | `number` | `3` | Rows rendered before and after the viewport (at most 50). |
| `size` | `'sm' \| 'md' \| 'lg' \| 'fill'` | `'md'` | Viewport height 16, 24 or 36 rem, or the parent's height. |
| `density` | `'compact' \| 'default' \| 'comfortable'` | `'default'` | Row padding (option rows only; plain rows have none). |
| `selected` | `string \| number` | — | Bindable. |
| `emptyLabel` | `string` | `'No items'` | Shown when `items` is empty. |
| `onSelect` | `(item, index) => void` | — | Listbox: click, Enter or Space. A feed never calls it. |
| `onRangeChange` | `({ start, end }) => void` | — | The rendered range; feed it to `createInfiniteLoader`. |
| `ref` | `HTMLElement \| null` | — | Bindable: the root element. |

The component also exports `scrollToIndex(index)` (`bind:this`).

### Component API contract

`VirtualListView` follows the uniform contract
([STANDARDS](../../../docs/STANDARDS.md#component-api-contract)) in the split
shape of a form control:

- `bind:ref` is the root element, which also takes `class`, `style` and
  `hidden`.
- `id`, `aria-*`, `data-*` and event handlers go to the scroller (the listbox
  or the feed), the element that holds focus and scrolls. A caller `id`
  replaces the generated one, and row ids derive from it
  (`<id>-option-<index>`). A caller `aria-describedby` is kept, with the empty
  message's id added when the list is empty.
- A caller `onkeydown` runs first. If it calls `preventDefault()`, the
  listbox skips its own keys for that event. A caller `onscroll` or `onfocus`
  runs too, and the scroll and focus bookkeeping always runs after it. Row
  clicks are handled on the row, before a caller `onclick` on the scroller
  sees them.

## Accessibility: the APG listbox pattern (default)

- The list is a WAI-ARIA **listbox** with one tab stop. Focus stays on the
  listbox and `aria-activedescendant` names the active option, so rows can
  leave and enter the window without moving DOM focus. While the active row is
  scrolled out of the window, `aria-activedescendant` is removed; the next key
  brings the row back into view.
- Every option carries `aria-setsize` (the whole count) and `aria-posinset`
  (its 1-based position), so a screen reader announces "Update 12, 12 of
  10,000" although only a window is in the DOM.
- Keys: Down and Up move one row, Page Down and Page Up move one viewport,
  Home and End go to the first and last row, Enter and Space select. On focus,
  the selected row (or the first row in view) becomes active.
- Keys act only when the listbox itself has focus (`event.target` is the
  listbox). A key pressed in a row's own input or on a row's button belongs to
  that control: Space types a space, Enter presses the button, arrows move the
  caret.
- An option holds no controls (listbox options are not containers for
  buttons or links, and axe reports `nested-interactive`). For rows with their
  own actions, use `mode="feed"`, or `data-grid` for rows with columns.
- Forced colors keep the selected row as `Highlight`.

## Accessibility: the APG feed pattern (`mode="feed"`)

- The scroller is `role="feed"` with the `label` as its name. Each row is an
  `<article>` with `aria-setsize` and `aria-posinset`.
- Every article has a name. Without a `row` snippet, `aria-labelledby` points
  at its label. With one, `aria-labelledby` points at, in order:
  - the element with the snippet's `labelId` (or the id `getRowLabelId`
    returns);
  - else the card's first heading that has an id.

  With neither, the article gets `aria-label` with the row's label text
  (`getLabel`, else `item.label`), so it never points at a missing id. The
  name is checked when the row mounts or its item changes. A heading the
  snippet adds later is not picked up, so render it from the start.
- Articles are focusable without selection. One article is the tab stop: the
  one that last held focus, or the first one in view. The others have
  `tabindex="-1"`. Focus inside an article (a click in its input, say) makes
  that article the tab stop.
- Page Down and Page Up on a focused article move focus to the next or
  previous article, scrolling it into the window first. Keys pressed inside
  an article's own controls are left to them.
- Rows use a plain style: no option padding, border, hover or cursor, only a
  focus ring on the focused article. The same plain row is used for
  `selectable={false}` lists.
- `surface="plain"` drops the viewport's border, radius and surface (the
  focus ring stays). It works in either mode.
- Not done yet: `aria-busy` while more rows load, and Control+Home and
  Control+End to leave the feed. Arrows inside a feed scroll the viewport as
  usual. If the focused article is scrolled out of the window, it unmounts
  and focus is lost.

## Windowing and measurement

- The space before and after the window is two `aria-hidden` spacer elements
  inside the component. Their height is a custom property the component sets
  (`--tx-virtual-list-spacer`) through a Svelte `style:` directive; the page
  never writes inline style.
- Rows are in normal flow and measured as they mount and whenever they resize
  (`ResizeObserver`), through the engine's O(log n) `measure`. When a row
  above the viewport changes height, the component moves the scroll position
  by the difference, so the content in view stays still
  (`overflow-anchor: none` leaves that correction to the component).
- Measurements are kept per index. When rows are inserted or reordered, the
  measured heights stay with their positions until the rows are measured
  again.
- Before the viewport is measured, and on the server, the component assumes
  the viewport height of its size (256, 384 or 576 px, 480 for `fill`), so
  server HTML already holds the first window.

## Catalog

`data-virtual-list` is a catalog id, so a locked design system's `allow` set
governs it (`size` and `density` are its axes; from spec `0.15.0`, `mode`,
`selectable` and `surface` are plain props) and `texuli ds validate
--locked --prototype` checks its use. It is `agentEmittable: false`: the
player has no painter for it yet, so blueprints do not emit it.

`mode` and `selectable` are component props since `0.16.1`. The catalog entry
lists them, and `surface`, from blueprint spec `0.15.0` (new in `0.17.0`).
