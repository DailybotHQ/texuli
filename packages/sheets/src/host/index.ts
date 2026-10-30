/**
 * @texuli/sheets/host: the sheet half of the player's `sheetHost` seam
 * (pass `createSheetPlayerHost()` as `sheetHost` on `Player`) and the draft
 * check it carries.
 */
export {
  createSheetPlayerHost,
  type SheetDraftCheck,
  type SheetDraftIssue,
  type SheetHost,
  type SheetHostOptions,
  type SheetHostRequest,
  type SheetHostTier,
} from './sheet-host.ts';
