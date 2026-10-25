/** Stable per-node error codes (player design §7). Each one paints a visible placeholder. */
export type PlayerNodeErrorCode = 'unknown-id' | 'tier-denied' | 'no-loader' | 'node-error';

/** Stable list of the per-node error codes, for hosts that map them to their own copy. */
export const PLAYER_NODE_ERROR_CODES: readonly PlayerNodeErrorCode[] = Object.freeze([
  'unknown-id',
  'tier-denied',
  'no-loader',
  'node-error',
]);

/** What failed for a `node-error`: the lazy load, the mount, or a loader that returned no component. */
export type PlayerNodeErrorPhase = 'load' | 'render' | 'invalid-component';

/** Reported to the host's `onNodeError`; never rendered. */
export interface PlayerNodeError {
  code: PlayerNodeErrorCode;
  id: string;
  path: string;
  phase?: PlayerNodeErrorPhase;
  /** The thrown value for a `render` failure. Hosts may log it; the player never shows it. */
  error?: unknown;
}

/** Fixed, content-free explanation shown under each placeholder label. */
export function placeholderMessage(code: PlayerNodeErrorCode): string {
  switch (code) {
    case 'unknown-id':
      return 'The blueprint names a component this catalog does not have.';
    case 'tier-denied':
      return 'This component is not allowed for content at this trust level.';
    case 'no-loader':
      return 'This player has no painter for this component yet.';
    case 'node-error':
      return 'This part could not be loaded or shown. The rest of the content is unaffected.';
  }
}
