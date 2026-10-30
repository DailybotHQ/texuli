# Data grid editing

**Package:** `@texuli/data` · **Import:** `import { EditableDataGrid, createUndoStack, validateCell } from '@texuli/data/grid-editing'`

Inline cell editing on top of the grid core: typed drafts, validation, undo/redo and TSV clipboard. The engine is framework-free TypeScript; the Svelte view is a lazy subpath so read-only grids never download the editor.

```svelte
<script lang="ts">
  import {
    applyRowValue,
    EditableDataGrid,
    type EditableColumn,
  } from '@texuli/data/grid-editing';

  let rows = $state([
    { id: 'd1', name: 'Harbor Notes', stage: 'Open', amount: 120 },
  ]);
  const columns: EditableColumn<(typeof rows)[0]>[] = [
    { key: 'name', header: 'Deal', type: 'text', editable: true },
    { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won'], editable: true },
    { key: 'amount', header: 'Amount', type: 'number', editable: true },
  ];

  function commit(row, key, value) {
    rows = rows.map((r) => (r.id === row.id ? applyRowValue(r, key, value) : r));
  }
  function apply(rowId, key, value) {
    rows = rows.map((r) => (r.id === rowId ? applyRowValue(r, key, value) : r));
  }
</script>

<EditableDataGrid
  {rows}
  {columns}
  getRowId={(r) => r.id}
  caption="Deals"
  onCommit={commit}
  onApply={apply}
/>
```

## Engine (no Svelte)

| API | Role |
| --- | --- |
| `parseEditorValue` / `draftFromValue` | Draft ↔ stored `GridValue` by column type |
| `validateCell` | Number/enum/date checks + optional `column.validate` |
| `createUndoStack` | Push / undo / redo cell ops (default depth 50) |
| `serializeClipboard` / `parseClipboard` / `pastePlan` | TSV round-trip for copy/paste |
| `applyRowValue` | Immutable row patch helper |

## View behavior

- **Enter** or **F2** on a focused editable cell opens the editor (lazy-loaded).
- **Escape** cancels; **Enter** in the editor saves.
- **Double-click** starts an edit.
- **Moving focus away** (Tab, a click elsewhere, blur) **saves the edit for every editor type** — text, select and switch alike — and closes the editor.
- **Ctrl/Cmd+Z** undo, **Ctrl/Cmd+Shift+Z** or **Y** redo (needs `onApply` + `onCommit`).
- **Ctrl/Cmd+C** copies the cell as TSV; **V** pastes a block from the anchor cell over editable targets, and the live region announces how many cells the paste wrote.
- Failed commits keep the previous value and show `role="alert"` under the cell; reopening the editor exposes `aria-invalid` and describes the error through `aria-describedby`.
- Toolbar exposes Undo / Redo with the same stack.
- **`onFocusCell`** (new in 0.8.0) is called with `{ rowId, columnKey }` each time focus moves to another body cell, by keyboard or pointer (not again for the cell that already has focus), so a host can follow the focused cell in a formula bar or a status line, as `@texuli/sheets`' `SheetView` does.

## Labels

Every string is overridable through `labels` (`resolveGridEditingLabels`). English defaults ship in the package.

## Limits

- Paste uses the host `clipboard` API (may be denied without a secure context or permission).
- Undo re-invokes `onCommit` with the previous value; hosts should treat that as a normal write.
- The editor is native inputs only (text, number, date, select, switch) — no rich overlays inside cells.
