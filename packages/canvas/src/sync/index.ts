/**
 * @texuli/canvas/sync: canvases on the `@texuli/document/sync` CRDT core
 * (ADR-010). Shapes are tree nodes (frames, groups and z-order merge with
 * the move-safe tree), fields are last-writer-wins registers, text is a
 * sequence; the projection is always a valid canvas; presence carries
 * pointers and selections. Framework-free; loads only in collaborative
 * sessions.
 */
export {
  CANVAS_NODE_TYPES,
  CONNECTORS_NODE,
  commitCanvas,
  projectCanvas,
} from './binding.ts';
export {
  type CanvasPresenceEntry,
  type CanvasPresenceState,
  type CanvasPresenceStore,
  checkCanvasPresence,
  createCanvasPresenceStore,
  PRESENCE_SELECTION_LIMIT,
} from './presence.ts';
export {
  type CanvasConnection,
  CanvasSync,
  type CanvasSyncListener,
  type CanvasSyncOptions,
  canvasSeedOperations,
  createCanvasSync,
  EMPTY_CANVAS,
} from './session.ts';
