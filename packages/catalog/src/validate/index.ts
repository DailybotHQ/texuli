/**
 * `@texuli/catalog/validate` — the single validation entry for untrusted
 * blueprint JSON, shared by the playground, the golden set, the edit history
 * and the planned player and agent service. Runtime-neutral: no DOM, no
 * Node APIs.
 */

export {
  CANVAS_ID,
  type CanvasFinding,
  canvasNodes,
  checkCanvases,
  type DraftCanvasCheck,
  type DraftCanvasIssue,
  MAX_CANVAS_FINDINGS,
} from './canvas.ts';
export {
  checkDashboards,
  DASHBOARD_ID,
  DASHBOARD_WIDGET_ID,
  type DashboardFinding,
  MAX_DASHBOARD_FINDINGS,
  MAX_DASHBOARD_WIDGETS,
} from './dashboard.ts';
export {
  DECK_ROOT_CATALOG_ID,
  DECK_SLIDE_CATALOG_ID,
  type DeckDraftDiagnostic,
  type DeckDraftIssue,
  type DeckDraftIssueCode,
  type DeckDraftResult,
  type DeckV2Plain,
  deckV2ToLayoutTree,
  layoutDeckToV2,
  type ValidateDeckDraftOptions,
  validateDeckDraft,
} from './deck-draft.ts';
export {
  checkDraftDesignSystem,
  DESIGN_SYSTEM_REF,
  type DraftDesignSystemCheck,
  type DraftDesignSystemIssue,
} from './design-system.ts';
export {
  checkDocuments,
  DOCUMENT_ID,
  type DocumentCheckOptions,
  type DocumentFinding,
  type DraftDocumentCheck,
  type DraftDocumentIssue,
  documentNodes,
  MAX_DOCUMENT_FINDINGS,
} from './document.ts';
export {
  DRAFT_CHECKS,
  DRAFT_FRAME_IDS,
  DRAFT_TEXT_ALLOWANCE,
  type DraftBlockCheck,
  type DraftCheck,
  type DraftCheckStatus,
  type DraftDiagnostic,
  type DraftStatus,
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from './draft.ts';
export {
  checkForms,
  type DraftFormCheck,
  type DraftFormIssue,
  type FormCheckOptions,
  type FormFinding,
  MAX_FORM_FINDINGS,
  SCHEMA_FORM_ID,
  schemaFormNodes,
} from './form.ts';
export { draftCommitGate } from './gate.ts';
export {
  checkSheets,
  type DraftSheetCheck,
  type DraftSheetIssue,
  MAX_SHEET_FINDINGS,
  type SheetFinding,
  SPREADSHEET_ID,
  sheetNodes,
} from './sheet.ts';
export { type SinkFinding, type SinkUrlTier, scanSinks } from './sinks.ts';
export {
  checkStreamTotals,
  STREAM_WHOLE_TREE_CHECKS,
  type StreamNodeInput,
  type StreamNodeValidation,
  streamNodeChain,
  validateStreamChain,
  validateStreamNode,
} from './stream.ts';
