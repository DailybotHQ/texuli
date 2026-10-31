/** `@texuli/player` — Svelte paint for the framework-free catalog player. */

export type {
  PlayerStatus,
  ValidationReceipt,
} from '@texuli/catalog/player';
export { createActionAccess } from './action-access.ts';
export {
  ACTION_GRAMMAR_ROLES,
  ACTION_MANIFESTS,
  actionFormManifest,
  formFieldManifest,
  formSubmitManifest,
} from './action-manifests.ts';
export {
  ACTION_NAME,
  type ActionHandler,
  type ActionIntent,
  type ActionResult,
  type ActionStatus,
  AUTOCOMPLETE_ALLOWLIST,
  actionValues,
  checkActionNodes,
  FIELD_KINDS,
  FIELD_PATTERNS,
  type FieldKind,
  type FieldRules,
  MAX_ACTION_FIELDS,
  MAX_ACTION_VALUE_LENGTH,
  runAction,
  validateFieldValue,
} from './actions.ts';
export {
  type Announcement,
  type AnnouncementLabels,
  createAnnouncer,
  formatAnnouncement,
  type PaintSummary,
  type Politeness,
  paintAnnouncement,
  selectionAnnouncement,
} from './announcements.ts';
export {
  CANVAS_HOST_PACKAGE,
  type CanvasPlayerHost,
  type CanvasPlayerHostRequest,
  canvasRoot,
  type DraftCanvasCheck,
  isCanvasTree,
} from './canvas-host.ts';
export { createPlayerCatalog } from './catalog.ts';
export {
  CHAT_DISPLAY_MANIFESTS,
  CHAT_MESSAGE_ROLES,
  chatMessageManifest,
  chatThreadManifest,
} from './chat-manifests.ts';
export {
  CONTROL_GRAMMAR_ROLES,
  CONTROL_MANIFESTS,
  CONTROL_STATE_TYPES,
  choiceControlManifest,
  filterControlManifest,
  isControlId,
  sliderControlManifest,
  toggleControlManifest,
} from './control-manifests.ts';
export {
  DECK_STAGE_HOST_PACKAGE,
  type DeckPlayerHost,
  type DeckPlayerHostRequest,
  isLayoutDeckTree,
} from './deck-host.ts';
export type {
  PlayerDesignSystemEvent,
  PlayerDesignSystemSource,
  PlayerDesignSystems,
} from './design-system-types.ts';
export {
  DOCUMENT_HOST_PACKAGE,
  type DocumentPlayerHost,
  type DocumentPlayerHostRequest,
  type DraftDocumentCheck,
  documentRoot,
  isDocumentTree,
} from './document-host.ts';
export {
  createPlayerFrameClient,
  normalizeParentOrigin,
  type PlayerFrameClient,
  type PlayerFrameClientOptions,
} from './embed/client.ts';
export {
  createPlayerFrameHost,
  type PlayerFrameHost,
  type PlayerFrameHostOptions,
} from './embed/host.ts';
export {
  frameDiagnostics,
  PLAYER_FRAME_MAX_SIZE,
  PLAYER_FRAME_PROTOCOL,
  PLAYER_FRAME_REFERRER_POLICY,
  PLAYER_FRAME_SANDBOX,
  type PlayerFrameDiagnostics,
  type PlayerFrameFlowChange,
  type PlayerFrameHostMessage,
  type PlayerFrameMessage,
  type PlayerFrameOptions,
  parseFrameMessage,
  parseHostMessage,
  sanitizeFrameOptions,
} from './embed/protocol.ts';
export type { PlayerDiagnosticsEvent, PlayerSize } from './embed/types.ts';
export {
  PLAYER_NODE_ERROR_CODES,
  type PlayerNodeError,
  type PlayerNodeErrorCode,
  type PlayerNodeErrorPhase,
  placeholderMessage,
} from './errors.ts';
export {
  FLOW_GRAMMAR_ROLES,
  FLOW_MANIFESTS,
  flowActionManifest,
  flowViewManifest,
} from './flow-manifests.ts';
export {
  type DraftFormCheck,
  FORM_HOST_PACKAGE,
  type FormPlayerHost,
  type FormPlayerHostRequest,
  type FormPlayerSubmitResult,
} from './form-host.ts';
export { formActionValues } from './form-values.ts';
export {
  HOST_CHROME_IDS,
  isHostChromeId,
  withoutHostChrome,
  withoutHostChromeLoaders,
} from './host-chrome.ts';
export {
  applyHostData,
  checkHostBoundWriters,
  type DataSources,
  hostBoundNames,
  MAX_DATA_SOURCES,
  sanitizeDataSources,
} from './host-data.ts';
export {
  FRAME_ATTRIBUTE,
  frameStops,
  handleSurfaceKeydown,
  navigableFrames,
  normalizeTabOrder,
  parentFrame,
  type SurfaceKeyContext,
} from './keyboard.ts';
export {
  DEFAULT_PLAYER_LABELS,
  type PlayerLabelOverrides,
  type PlayerLabels,
  type PlayerShownStatus,
  resolvePlayerLabels,
  safeLang,
} from './labels.ts';
export {
  G20_GRAMMAR_ROLES,
  G20_LAYOUT_MANIFESTS,
  LAYOUT_ALIGNS,
  LAYOUT_GAPS,
  PLAYER_GRAMMAR_ROLES,
  rowLayoutManifest,
  SPLIT_RATIOS,
  splitLayoutManifest,
  stackLayoutManifest,
  tileLayoutManifest,
} from './layout-manifests.ts';
export {
  CONTENT_LAYOUT_IDS,
  type ContentLayoutId,
  type FrameInfo,
  isContentLayoutId,
  planFrames,
  type TocEntry,
} from './layouts/outline.ts';
export { PLAYER_LOADERS } from './loaders.ts';
export {
  applyMediaPolicy,
  type MediaPolicyLabels,
  TRUST_PINNED_IDS,
} from './media-policy.ts';
export {
  type MountedPlayer,
  type MountedPlayerFrame,
  type MountPlayerFrameOptions,
  mountPlayer,
  mountPlayerFrame,
  type PlayerProps,
} from './mount.ts';
export { default as Player } from './Player.svelte';
export { default as PlayerFrame } from './PlayerFrame.svelte';
export { INTERACTIVE_PAINTER_IDS } from './painters/interactive.ts';
export {
  HOST_REGION_ID,
  HOST_REGION_NAME,
  hostRegionManifest,
  isHostRegionName,
  REGION_GRAMMAR_ROLES,
  REGION_MANIFESTS,
} from './region-manifests.ts';
export {
  applySelection,
  EMPTY_SELECTION,
  pruneSelection,
  SELECTED_ATTRIBUTE,
  type SelectionMode,
  type SelectionState,
} from './selection.ts';
export {
  type DraftSheetCheck,
  SHEET_HOST_PACKAGE,
  type SheetPlayerHost,
  type SheetPlayerHostRequest,
} from './sheet-host.ts';
export {
  DEFAULT_LOAD_TIMEOUT_MS,
  type PlayerSkeletonFamily,
  skeletonFamily,
  withLoadTimeout,
} from './skeletons.ts';
export {
  LOCAL_STATE_FORMAT,
  LOCAL_STATE_VERSION,
  liftLocalState,
  type NodeInteraction,
  type ResolveOptions,
  resolveStateBindings,
  STATE_BINDING_KEY,
  type StatefulSplit,
  splitStatefulBlueprint,
} from './state/bind.ts';
export { checkControlBindings } from './state/controls.ts';
export {
  checkFlowNodes,
  FLOW_NAME,
  type FlowDeclaration,
  type FlowParse,
  type FlowTransition,
  MAX_FLOW_TRANSITIONS,
  MAX_FLOW_VIEWS,
  nextFlowView,
  parseFlowDeclaration,
} from './state/flow.ts';
export {
  type ActionEffect,
  type ActionsResult,
  type EventDetail,
  MAX_EMIT_VALUE_LENGTH,
  MAX_EMIT_VALUES,
  type MoveOptions,
  type MoveResult,
  moveListItem,
  runActions,
} from './state/reducers.ts';
export {
  coerceList,
  coerceStateValue,
  coerceWorkflow,
  DATA_SOURCE_NAME,
  DEFAULT_STRING_LENGTH,
  ITEM_KEY,
  initialSnapshot,
  type ListItem,
  MAX_ENUM_VALUE_LENGTH,
  MAX_ENUM_VALUES,
  MAX_ITEM_FIELDS,
  MAX_LIST_ITEMS,
  MAX_STATE_VARS,
  MAX_STRING_LENGTH,
  parseStateDeclarations,
  type StateDeclaration,
  type StateDeclarations,
  type StateIssue,
  type StateParse,
  type StateSnapshot,
  type StateValue,
  type WorkflowValue,
} from './state/schema.ts';
export {
  type BlueprintStreamSource,
  type PlayerStreamProgress,
  STREAM_ANNOUNCE_INTERVAL_MS,
  STREAM_PAINT_INTERVAL_MS,
  STREAM_PENDING_ID,
  type StreamNodeState,
} from './stream/marker.ts';
export type { PlayerPaintNode } from './types.ts';
