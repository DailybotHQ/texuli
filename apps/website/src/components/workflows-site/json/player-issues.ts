/**
 * The player's own report (`onDiagnostics`, `onNodeError`) as preview
 * diagnostics, so the list shows what the paint found too. Type-only
 * imports: this stays out of the player chunk's way.
 */
import type { PlayerDiagnosticsEvent, PlayerNodeError } from '@texuli/player';
import { type DraftRootKind, diagnosticKey, type PreviewDiagnostic, toJsonPath } from './model.ts';

const NODE_ERROR_COPY: Readonly<Record<PlayerNodeError['code'], string>> = Object.freeze({
  'unknown-id': 'This component is not in the player catalog, so it shows a placeholder.',
  'tier-denied': 'This component is not allowed at the untrusted tier.',
  'no-loader': 'The player has no painter for this component yet.',
  'node-error': 'This component failed to load or render.',
});

export function playerDiagnostics(
  event: PlayerDiagnosticsEvent | null,
  nodeErrors: readonly PlayerNodeError[],
  root: DraftRootKind
): PreviewDiagnostic[] {
  const out: PreviewDiagnostic[] = [];
  const push = (
    severity: PreviewDiagnostic['severity'],
    code: string,
    rawPath: string,
    message: string
  ) => {
    const path = toJsonPath(rawPath, root);
    out.push({
      key: diagnosticKey('player', code, path),
      source: 'player',
      severity,
      code,
      message,
      path,
    });
  };
  for (const d of event?.diagnostics ?? []) push(d.severity, d.code, d.path, d.message);
  for (const issue of event?.stateIssues ?? [])
    push('error', issue.code, issue.path, issue.message);
  for (const error of nodeErrors)
    push('error', error.code, error.path, NODE_ERROR_COPY[error.code]);
  return out;
}

/** True when the player refused the blueprint (it shows its notice, not the tree). */
export function playerRefused(event: PlayerDiagnosticsEvent | null): boolean {
  return event?.surface === 'notice';
}
