import type {
  RenderCatalog,
  RenderDiagnostic,
  RenderNode,
  RenderOptions,
  RenderResult,
  RenderTier,
} from '../renderer/types.ts';

/**
 * Kinds of actions the artifact may propose. The frame never executes them —
 * the host confirms and applies.
 */
export type ArtifactIntentKind = 'navigate' | 'activate' | 'copy' | 'dismiss' | 'custom';

/** Lifecycle of one intent waiting on the host. */
export type ArtifactIntentStatus = 'pending' | 'confirmed' | 'rejected';

/**
 * A host-confirmable action originating from framed untrusted output.
 * Payload is plain JSON-like data only (no functions, no HTML strings).
 */
export interface ArtifactIntent {
  /** Stable id within the frame (`intent-<n>`). */
  id: string;
  kind: ArtifactIntentKind;
  /** Render-tree path that proposed the action (e.g. `0.children.1`). */
  path: string;
  /** Catalog component id when known. */
  componentId?: string;
  /** Sanitized plain data for the host. */
  payload: Readonly<Record<string, unknown>>;
  /** Short human summary for a confirm UI. */
  summary: string;
  status: ArtifactIntentStatus;
}

export type ArtifactFrameIssueCode =
  | 'missing-label'
  | 'html-label'
  | 'invalid-intent'
  | 'unknown-intent'
  | 'intent-not-pending'
  | 'intent-kind-denied'
  /** URL-bearing payload field failed the core URL policy. */
  | 'unsafe-url'
  | RenderDiagnostic['code'];

export interface ArtifactFrameDiagnostic {
  code: ArtifactFrameIssueCode;
  path: string;
  message: string;
  id?: string;
}

/**
 * Host-owned chrome around untrusted catalog output.
 * `requiresVisibleChrome` is always true — the host must show {@link label}
 * and {@link badge} so users can tell agent output from app chrome.
 */
export interface ArtifactFrame {
  /** Frame instance id. */
  id: string;
  /** Required visible title / landmark name. */
  label: string;
  /** Optional source line (model name, session id — plain text). */
  source?: string;
  /** Always-visible trust badge (default "Untrusted content"). */
  badge: string;
  /** Contract flag: chrome must stay visible. */
  requiresVisibleChrome: true;
  /** Sink-free roots from the renderer. */
  roots: readonly RenderNode[];
  /** Render + frame diagnostics. */
  diagnostics: readonly ArtifactFrameDiagnostic[];
  /** Intents awaiting host confirm/reject (includes settled ones). */
  intents: readonly ArtifactIntent[];
}

export interface CreateArtifactFrameOptions {
  /** Optional stable id (generated when omitted). */
  id?: string;
  /**
   * Required visible label. Empty / HTML-like labels fail the frame
   * (no roots; diagnostics explain why).
   */
  label: string;
  source?: string;
  /** Override badge copy. Default "Untrusted content". */
  badge?: string;
  /** Untrusted catalog tree (preferred input). */
  tree?: unknown;
  /** Already-rendered result (skips re-render when both set, uses this). */
  result?: RenderResult;
  catalog: RenderCatalog;
  /**
   * Emit tier for the inner renderer. Default **`untrusted`**.
   * Developer tier requires `allowDeveloperTier: true`.
   */
  tier?: RenderTier;
  /** Permit `tier: 'developer'` inside a frame (default false). */
  allowDeveloperTier?: boolean;
  /** Intent kinds the host will accept (default: all kinds). */
  allowIntentKinds?: readonly ArtifactIntentKind[];
  /** Forwarded to {@link renderCatalogTree} (maxChildren, …). */
  render?: Omit<RenderOptions, 'catalog' | 'tier'>;
}

export interface ProposeIntentInput {
  kind: ArtifactIntentKind;
  path: string;
  componentId?: string;
  payload?: Readonly<Record<string, unknown>>;
  summary?: string;
}

export type ProposeIntentResult =
  | { ok: true; intent: ArtifactIntent; frame: ArtifactFrame }
  | { ok: false; reason: ArtifactFrameIssueCode; message: string; frame: ArtifactFrame };

export type SettleIntentResult =
  | { ok: true; intent: ArtifactIntent; frame: ArtifactFrame }
  | { ok: false; reason: ArtifactFrameIssueCode; message: string; frame: ArtifactFrame };
