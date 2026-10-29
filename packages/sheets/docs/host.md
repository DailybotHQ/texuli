# Player host (`@texuli/sheets/host`)

The sheet half of a host seam for `@texuli/player`, shaped like the
`canvasHost` seam of `@texuli/canvas/host`. **The player-side `sheetHost`
seam is planned**: today the player does not paint `spreadsheet` nodes, and
a host validates them through `validateDraft` with `checkSheet`.

```ts
import { createSheetPlayerHost } from '@texuli/sheets/host';

const sheetHost = createSheetPlayerHost({ now: () => Date.now() });
// validateDraft(draft, { catalog, checkSheet: sheetHost.checkSheet });
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
