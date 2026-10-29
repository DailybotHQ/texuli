# Player host (`@texuli/sheets/host`)

The sheet half of the `sheetHost` seam of `@texuli/player`, shaped like the
`canvasHost` seam of `@texuli/canvas/host`. Pass it as `sheetHost` on
`Player`: the player runs its `checkSheet` inside validation (every formula
is parsed at draft time) and paints each valid `spreadsheet` node in place
through `present`. Without a sheet host the player refuses `spreadsheet`
nodes (`sheet-unchecked`). Outside the player, a host can pass the same
check to `validateDraft`. Both sides are on this branch and not yet
published.

```svelte
<script lang="ts">
  import { Player } from '@texuli/player';
  import { createSheetPlayerHost } from '@texuli/sheets/host';
  let { draft } = $props();
  const sheetHost = createSheetPlayerHost({ now: () => Date.now() });
</script>

<Player blueprint={draft} label="Agent sheet" {sheetHost} />
```

```ts
// Without the player: validateDraft(draft, { catalog, checkSheet: sheetHost.checkSheet });
```

`createSheetPlayerHost(options)` returns a `SheetHost`:

- `checkSheet` (a `SheetDraftCheck`): `validateSheet` as a draft check;
  every error refuses the node, and each `SheetDraftIssue` carries a
  `code`, a JSON `path`, a `message` and a `severity`. Sheets are data at
  every `SheetHostTier` (`developer` or `untrusted`), so the tier loosens
  nothing.
- `present(request)` (a `SheetHostRequest`: the `sheet`, the node's
  `sheetLabel` and `key`, the `tier`, the player region's `label`, `active`
  and the `target` element) validates the sheet again and mounts a
  `SheetView` into the target, loaded on first use; it returns a cleanup
  that unmounts the view or cancels a mount still loading. A sheet that
  does not validate paints nothing.

`SheetHostOptions`: `now` (the clock for `TODAY` and `NOW`), `labels` (the
view's labels) and `editable` (default `false`: agent sheets paint
read-only).
