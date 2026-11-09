## Sheet view

`SheetView` from `@texuli/sheets/view` is the accessible spreadsheet with tabs and a formula bar. It sits on the `@texuli/data` grid editing layer. Bind the document with `bind:sheet` and pass `now` so `TODAY` and `NOW` have a clock.

The cell editor loads lazily on the first Enter or F2.

## Player host

`createSheetPlayerHost` from `@texuli/sheets/host` is the sheet half of the player's `sheetHost` seam. Pass it as `sheetHost` on `Player`. Agents emit sheets as data through the catalog `spreadsheet` id; `checkSheetDraft` from `@texuli/sheets/model` is the draft check the catalog injects as `checkSheet`.
