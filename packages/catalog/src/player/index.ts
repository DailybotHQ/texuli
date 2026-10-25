/**
 * `@texuli/catalog/player` — the framework-free document player core
 * (player design §3–6). It validates a blueprint or envelope with
 * `validateDraft`, plans the paint with the URL policy applied again at
 * paint time, loads components lazily, isolates failures per node, and
 * holds the closed intent model. The Svelte paint is a later package.
 */

export {
  checkIntent,
  type IntentCheck,
  MAX_COPY_TEXT,
  MAX_PENDING_INTENTS_PER_NODE,
  PLAYER_EXPORT_FORMATS,
  PLAYER_INTENT_KINDS,
  type PlayerIntent,
  type PlayerIntentKind,
  type PlayerIntentPayload,
} from './intents.ts';
export { type PaintUrlIssue, paintProps } from './paint-props.ts';
export {
  createPlayer,
  type PaintAdapter,
  type PaintNode,
  type PlayerErrorCode,
  type PlayerHandle,
  type PlayerLoader,
  type PlayerOptions,
  type PlayerState,
  type PlayerStatus,
  type ProposeResult,
  type ValidationReceipt,
} from './player.ts';
