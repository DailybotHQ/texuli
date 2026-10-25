import type {
  PlayerErrorCode,
  PlayerState,
  PlayerStatus,
  ValidationReceipt,
} from '@texuli/catalog/player';
import type { StateIssue } from '../state/schema.ts';

/** The player root's border-box size, in CSS pixels (rounded up). */
export interface PlayerSize {
  blockSize: number;
  inlineSize: number;
}

/** What the player reports after each validation (player design §7, `onDiagnostics`). */
export interface PlayerDiagnosticsEvent {
  status: PlayerStatus;
  surface: PlayerState['surface'];
  error?: PlayerErrorCode;
  diagnostics: PlayerState['validation']['diagnostics'];
  /** `null` when the local-state wrapper was refused before validation ran. */
  receipt: ValidationReceipt | null;
  /** Problems with declared state or bindings (G01); non-empty means refused. */
  stateIssues: readonly StateIssue[];
}
