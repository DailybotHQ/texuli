import type { PlayerDiagnosticsEvent, PlayerNodeError } from '@texuli/player';

/** One row in the preview's issues list. `path` is the builder path of the node, when known. */
export interface PreviewIssue {
  key: string;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path: number[] | null;
}

/** How long a preview painter may load before its node shows the error placeholder. */
export const PREVIEW_LOAD_TIMEOUT_MS = 8_000;

const NODE_ERROR_COPY: Record<PlayerNodeError['code'], string> = {
  'unknown-id': 'This component is not in the player catalog, so the preview shows a placeholder.',
  'tier-denied': 'This component is not allowed in an untrusted draft.',
  'no-loader': 'The preview has no painter for this component yet.',
  'node-error': 'This component failed to load or render in the preview.',
};

/**
 * A player node path (`0.children.1.children.0`, possibly followed by a JSON
 * path into its props) as a builder path (`[1, 0]`). `null` when the path does
 * not start at the root node.
 */
export function builderPathOf(playerPath: string): number[] | null {
  const parts = playerPath.split('.');
  if (parts[0] !== '0') return null;
  const path: number[] = [];
  for (let index = 1; index + 1 < parts.length; index += 2) {
    if (parts[index] !== 'children' || !/^\d+$/.test(parts[index + 1] ?? '')) break;
    path.push(Number(parts[index + 1]));
  }
  return path;
}

/**
 * The issues the preview lists: validation diagnostics from the last
 * `onDiagnostics`, state issues, then painter errors reported since. Every
 * message is shown as text; duplicates (same code and path) collapse.
 */
export function previewIssues(
  event: PlayerDiagnosticsEvent | null,
  nodeErrors: readonly PlayerNodeError[] = []
): PreviewIssue[] {
  const out: PreviewIssue[] = [];
  const seen = new Set<string>();
  const push = (issue: Omit<PreviewIssue, 'key'>, rawPath: string) => {
    const key = `${issue.code}@${rawPath}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...issue, key });
  };
  for (const diagnostic of event?.diagnostics ?? []) {
    push(
      {
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
        path: builderPathOf(diagnostic.path),
      },
      diagnostic.path
    );
  }
  for (const issue of event?.stateIssues ?? []) {
    push({ severity: 'error', code: issue.code, message: issue.message, path: null }, issue.path);
  }
  for (const error of nodeErrors) {
    push(
      {
        severity: 'error',
        code: error.code,
        message: NODE_ERROR_COPY[error.code],
        path: builderPathOf(error.path),
      },
      error.path
    );
  }
  return out;
}

/** The one-line preview summary next to the issues list. */
export function previewSummary(event: PlayerDiagnosticsEvent | null, issues: number): string {
  if (!event) return 'Preparing the preview…';
  const count = issues === 1 ? '1 issue' : `${issues} issues`;
  if (event.surface === 'notice') return `The draft cannot be previewed: ${count}.`;
  if (event.status === 'invalid') {
    return `The draft has ${count}; the preview paints the rest with placeholders.`;
  }
  if (issues === 0) return 'No issues: the draft passes validation.';
  return `${count} in the draft.`;
}
