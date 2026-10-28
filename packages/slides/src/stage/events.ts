/**
 * Typed DOM events the stage root dispatches (they bubble, and stay inside
 * the shadow root when there is one). Hosts listen with the map:
 *
 * ```ts
 * root.addEventListener('tx-deck:change', (event: DeckStageEvent<'tx-deck:change'>) => …);
 * ```
 */
import type {
  DeckAction,
  DeckActionSource,
  DeckState,
  ResolvedTransition,
} from '@texuli/deck/engine';
import type { DeckDiagnostic } from '@texuli/deck/schema';
import type { DeckFullscreenState } from './fullscreen.ts';
import type { DeckTransitionMode } from './transition.ts';

export interface DeckStageEventMap {
  'tx-deck:ready': { state: DeckState };
  'tx-deck:change': { state: DeckState; previous: DeckState; source: DeckActionSource };
  'tx-deck:step': { state: DeckState; previous: DeckState; source: DeckActionSource };
  'tx-deck:transition-start': {
    from: string;
    to: string;
    transition: ResolvedTransition;
    mode: DeckTransitionMode;
  };
  'tx-deck:transition-end': {
    from: string;
    to: string;
    transition: ResolvedTransition;
    mode: DeckTransitionMode;
  };
  'tx-deck:overview': { open: boolean };
  'tx-deck:presenter': { open: boolean };
  'tx-deck:fullscreen': { state: DeckFullscreenState };
  'tx-deck:blackout': { active: boolean };
  /** A stage-owned control the core does not handle yet (help, laser, copy link, …). */
  'tx-deck:action': { action: DeckAction; source: DeckActionSource };
  'tx-deck:error': { issues: readonly DeckDiagnostic[] };
}

export type DeckStageEventName = keyof DeckStageEventMap;
export type DeckStageEvent<K extends DeckStageEventName> = CustomEvent<DeckStageEventMap[K]>;

export const DECK_STAGE_EVENTS = Object.freeze([
  'tx-deck:ready',
  'tx-deck:change',
  'tx-deck:step',
  'tx-deck:transition-start',
  'tx-deck:transition-end',
  'tx-deck:overview',
  'tx-deck:presenter',
  'tx-deck:fullscreen',
  'tx-deck:blackout',
  'tx-deck:action',
  'tx-deck:error',
] as const satisfies readonly DeckStageEventName[]);

/** Dispatch one typed stage event on `target` (a no-op without a target or `CustomEvent`). */
export function dispatchDeckEvent<K extends DeckStageEventName>(
  target: EventTarget | null | undefined,
  name: K,
  detail: DeckStageEventMap[K]
): void {
  if (!target || typeof CustomEvent !== 'function') return;
  target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}
