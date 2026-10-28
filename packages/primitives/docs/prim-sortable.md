# Sortable primitive

`@texuli/primitives/sortable` binds the framework-free
[`@texuli/drag`](../../drag/README.md) sortable engine to Svelte 5:
reorderable lists in every axis, lists that exchange items in a group,
clone on pull, swap, multi-item drags and locked items, with keyboard,
pointer and touch input and localized announcements. New in `0.4.0`: it is
not in `0.3.0`.

```svelte
<script lang="ts">
  import { Sortable, type SortableContainer } from '@texuli/primitives/sortable';

  const labels: Record<string, string> = {
    copy: 'Write launch copy',
    review: 'Review pull request',
    ship: 'Ship the beta',
  };

  let containers = $state<SortableContainer[]>([
    { id: 'todo', items: ['copy', 'review'], group: 'tasks' },
    { id: 'done', items: ['ship'], group: 'tasks' },
  ]);
</script>

<Sortable.Root bind:containers crossContainers>
  {#each containers as list (list.id)}
    <Sortable.List id={list.id} label={list.id === 'todo' ? 'To do' : 'Done'}>
      {#snippet children({ items })}
        {#each items as id (id)}
          <Sortable.Item {id} label={labels[id]}>
            <Sortable.Handle>⠿</Sortable.Handle>
            {labels[id]}
          </Sortable.Item>
        {/each}
      {/snippet}
    </Sortable.List>
  {/each}
</Sortable.Root>
```

## Parts

| Part | Renders | Key props |
| --- | --- | --- |
| `Sortable.Root` | a `div` that owns the drag session | `containers` (bindable: every list in order), `onMove(move)` (return `false` to apply the move yourself), `canDrop`, `mode` (`insert` or `swap`), `selection` (multi-drag), `filter`, `isLocked`, `crossContainers`, `modifiers`, `collision`, `preview` (`in-place` or `overlay`), `autoScroll`, `longPress`, `messages`, `announce` |
| `Sortable.List` | `ul` (or `as`) | `id` (a container id), `label`; its `children` snippet receives the live `items` order |
| `Sortable.Item` | `li` (or `as`) | `id`, `label` (the spoken name); its snippet receives `dragging`, `selected`, `locked` |
| `Sortable.Handle` | a `button` | `label` (defaults to the item's) |

Containers take the engine's rules: `group` (a name, or `pull` / `put`
rules, with `pull: 'clone'`), `orientation` (`vertical`, `horizontal`,
`grid`), `locked`, `maxItems`, `sort: false`, `disabled` and `parentId`
for nested lists and trees.

## Keyboard and announcements

Space or Enter on a handle picks the item up; arrow keys move it (inline
arrows flip in right-to-left text, and with `crossContainers` a move past a
list's edge continues in the neighbouring list); Space or Enter drops;
Escape cancels and restores the origin; Tab cancels. The handle is a button
with `aria-roledescription` and `aria-describedby` instructions; locked
items set `aria-disabled`. No `aria-grabbed`. Every step is announced
through `@texuli/core/announcer` from `DragMessages` templates that any
locale can override.

## Pointer, motion and state

Pointer Events with capture and a 4 px threshold; `touch-action: none` on
handles only; optional long-press on touch; auto-scroll of the nearest
scrollable ancestors. Reorders animate with FLIP unless the user prefers
reduced motion. List and item state is exposed as data attributes
(`data-drop-target`, `data-refused`, `data-dragging`, `data-locked`,
`data-drop-indicator`) for styling.

The engine plans and validates every move; the host applies it (by
binding `containers`, or in `onMove`) and owns history and persistence. The
full contract is
[`@texuli/drag`'s interaction, accessibility and i18n contract](../../drag/docs/contract.md);
the browser behavior suite (`tests/behavior/scenarios/sortable.spec.ts`)
checks it on Chromium and WebKit.
