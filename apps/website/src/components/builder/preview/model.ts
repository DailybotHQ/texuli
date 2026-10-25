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

/** Preview stage widths: a phone, a tablet, or the pane's full width. */
export const PREVIEW_WIDTHS = ['mobile', 'tablet', 'desktop'] as const;
export type PreviewWidth = (typeof PREVIEW_WIDTHS)[number];
export const PREVIEW_MODES = ['light', 'dark'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

/** How the preview is shown. It travels with the draft in a share link, never inside the blueprint. */
export interface PreviewView {
  width: PreviewWidth;
  mode: PreviewMode;
}

export const DEFAULT_PREVIEW_VIEW: PreviewView = Object.freeze({ width: 'desktop', mode: 'light' });

/**
 * The stage's real width in CSS pixels (`null`: the pane's width). The
 * stage is a container of exactly this inline size, scrolled when the pane
 * is narrower, never scaled: what fits at 390px is what a 390px container
 * shows.
 */
export const PREVIEW_WIDTH_PX: Readonly<Record<PreviewWidth, number | null>> = Object.freeze({
  mobile: 390,
  tablet: 768,
  desktop: null,
});

export const PREVIEW_WIDTH_LABELS: Readonly<Record<PreviewWidth, string>> = Object.freeze({
  mobile: 'Mobile (390px)',
  tablet: 'Tablet (768px)',
  desktop: 'Desktop (full width)',
});

/** Classes for the stage: one per width and mode, so tests and styles read the same state. */
export function stageClass(view: PreviewView): string {
  return `builder-preview__stage builder-preview__stage--${view.width} builder-preview__stage--${view.mode}`;
}

/** The stage's inline size: a fixed width, or the whole pane. */
export function stageInlineSize(width: PreviewWidth): string {
  const px = PREVIEW_WIDTH_PX[width];
  return px === null ? '100%' : `${px}px`;
}

/** `light desktop`: the view as share-link text. */
export function viewText(view: PreviewView): string {
  return `${view.mode} ${view.width}`;
}

/** Share-link text → a view, or `null` for anything but exactly a known mode and width. */
export function parseView(text: string): PreviewView | null {
  const parts = text.split(' ');
  if (parts.length !== 2) return null;
  const [mode, width] = parts;
  if (!PREVIEW_MODES.includes(mode as PreviewMode)) return null;
  if (!PREVIEW_WIDTHS.includes(width as PreviewWidth)) return null;
  return { mode: mode as PreviewMode, width: width as PreviewWidth };
}
