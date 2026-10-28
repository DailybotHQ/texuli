# Tree data view

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/tree-view`  
**Engine:** `packages/data/src/engines/tree/`  
**View:** `packages/data/src/tree-view/`  
**Tests:** `packages/data/tests/tree-view.test.ts`  
**Example:** `data-tree-view`

## Goal

An outline / file-tree data view over flat `{ id, parentId, rank }` rows with:

- Expand and collapse, keyboard roving focus (APG tree pattern)
- Lazy children via `loadChildren` + host merge through `onChildrenLoaded`
- Multi-select checkboxes (`selected` bindable)
- Drag reorder and keyboard outline edits (Alt+Up/Down reorder, Alt+Right indent,
  Alt+Left outdent — flipped under RTL; Tab stays free for focus movement)
- RTL via `dir="rtl"` and logical CSS
- Live region announcements for moves and load errors; drag announcements come
  from `DragMessages` templates (`@texuli/drag/messages`), overridable per locale
  with the `messages` prop (unreleased: not in `0.3.0`)

## Usage

```svelte
<script lang="ts">
  import { TreeDataView, type TreeMove } from '@texuli/data/tree-view';

  let rows = $state([
    { id: 'docs', title: 'Docs', parentId: null, rank: 'a0' },
    { id: 'intro', title: 'Intro', parentId: 'docs', rank: 'a0' },
  ]);
  let selected = $state<string[]>([]);
  let expanded = $state<string[]>(['docs']);

  function onMove(move: TreeMove): void {
    rows = rows.map((row) =>
      row.id === move.id ? { ...row, parentId: move.parentId, rank: move.rank } : row
    );
  }
</script>

<TreeDataView
  items={rows}
  bind:selected
  bind:expanded
  getId={(row) => row.id}
  getParentId={(row) => row.parentId}
  getRank={(row) => row.rank}
  getLabel={(row) => row.title}
  {onMove}
/>
```

### Lazy children

```svelte
<TreeDataView
  items={rows}
  hasChildren={(row) => row.lazy === true}
  loadChildren={async (parent) => fetchChildren(parent.id)}
  onChildrenLoaded={(parent, children) => {
    rows = [...rows.filter((row) => row.parentId !== parent.id), ...children];
  }}
  {/* accessors + onMove as above */}
/>
```

## Engine vs view

| Layer | Import | Role |
| --- | --- | --- |
| Engine | `@texuli/data/tree` or re-export from `tree-view` | `buildTree`, `flatten`, `moveNode`, `indent`, `outdent` |
| View | `TreeDataView` | rendering, lazy load, drag, checkboxes, keyboard |

## Tokens

Uses `--tx-border`, `--tx-foreground`, `--tx-surface`, `--tx-primary`,
`--tx-primary-foreground`, `--tx-ring`, `--tx-muted-foreground`, `--tx-danger`
and the `--tx-radius-*` scale, with system-color fallbacks for forced colors.
