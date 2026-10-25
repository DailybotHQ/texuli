import { safeHref, safeMediaSrc } from '@texuli/core/url-policy';
import { looksLikeHtmlString } from '../renderer/props.ts';
import { renderCatalogTree } from '../renderer/render.ts';
import { resolveTier } from '../renderer/tier.ts';
import type { RenderDiagnostic, RenderResult } from '../renderer/types.ts';
import type {
  ArtifactFrame,
  ArtifactFrameDiagnostic,
  ArtifactFrameIssueCode,
  ArtifactIntent,
  ArtifactIntentKind,
  CreateArtifactFrameOptions,
  ProposeIntentInput,
  ProposeIntentResult,
  SettleIntentResult,
} from './types.ts';

const DEFAULT_BADGE = 'Untrusted content';
const INTENT_KINDS = new Set<ArtifactIntentKind>([
  'navigate',
  'activate',
  'copy',
  'dismiss',
  'custom',
]);

/** Max characters kept in intent summaries after scrubbing. */
export const MAX_INTENT_SUMMARY_LENGTH = 200;
/** Max characters kept in any single string payload field. */
export const MAX_INTENT_STRING_LENGTH = 2048;

/**
 * Keys treated as navigation hrefs (safeHref, untrusted).
 * `href` on navigate is required.
 */
const HREF_URL_KEYS = new Set(['href']);
/**
 * Keys treated as media/resource URLs (safeMediaSrc, untrusted).
 * Also checked with safeHref when media policy rejects relative developer paths.
 */
const MEDIA_URL_KEYS = new Set(['src', 'url', 'poster', 'srcUrl', 'mediaSrc', 'mediaUrl']);

/**
 * Controls, zero-width, and bidi overrides that must not reach the host UI.
 * biome-ignore lint/suspicious/noControlCharactersInRegex: deliberate scrub of controls
 */
const BIDI_AND_CONTROLS = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

const INTENT_KINDS_LIST = INTENT_KINDS;

let frameSeq = 0;
let intentSeq = 0;

function nextFrameId(explicit?: string): string {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  frameSeq += 1;
  return `artifact-frame-${frameSeq}`;
}

function nextIntentId(): string {
  intentSeq += 1;
  return `intent-${intentSeq}`;
}

/** Reset id counters (tests only). */
export function resetArtifactFrameIds(): void {
  frameSeq = 0;
  intentSeq = 0;
}

function freezeFrame(frame: ArtifactFrame): ArtifactFrame {
  return Object.freeze({
    ...frame,
    roots: Object.freeze([...frame.roots]),
    diagnostics: Object.freeze([...frame.diagnostics]),
    intents: Object.freeze(frame.intents.map((intent) => Object.freeze({ ...intent }))),
  });
}

/**
 * Strip bidi/control characters, collapse whitespace, and cap length.
 * Used for labels, badges, sources, and intent summaries.
 */
export function scrubDisplayText(value: string, maxLength: number): string {
  return value
    .replace(BIDI_AND_CONTROLS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(0, maxLength));
}

function normalizePlainText(
  value: unknown,
  field: string,
  maxLength: number = MAX_INTENT_SUMMARY_LENGTH
):
  | { ok: true; text: string }
  | { ok: false; code: 'missing-label' | 'html-label'; message: string } {
  if (typeof value !== 'string') {
    return {
      ok: false,
      code: 'missing-label',
      message: `Artifact frame "${field}" must be a non-empty plain string.`,
    };
  }
  const text = scrubDisplayText(value, maxLength);
  if (!text) {
    return {
      ok: false,
      code: 'missing-label',
      message: `Artifact frame "${field}" must be a non-empty plain string.`,
    };
  }
  if (looksLikeHtmlString(text)) {
    return {
      ok: false,
      code: 'html-label',
      message: `Artifact frame "${field}" must not contain HTML markup.`,
    };
  }
  return { ok: true, text };
}

function mapRenderDiagnostics(list: readonly RenderDiagnostic[]): ArtifactFrameDiagnostic[] {
  return list.map((d) => ({
    code: d.code,
    path: d.path,
    message: d.message,
    ...(d.id ? { id: d.id } : {}),
  }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function capString(value: string): string {
  return value.length <= MAX_INTENT_STRING_LENGTH
    ? value
    : value.slice(0, MAX_INTENT_STRING_LENGTH);
}

/**
 * Apply the core URL policy to a single string. Href-like keys use `safeHref`;
 * media keys use `safeMediaSrc` then `safeHref` as a fallback for https links.
 * Never returns the original unsafe value. Over-long URLs are refused (never
 * truncated — a truncated URL is a different destination).
 */
export function policyCheckUrl(
  key: string,
  value: string
): { ok: true; url: string } | { ok: false } {
  // Scrub bidi/controls before policy (mirrors browser scheme parsing tricks).
  const cleaned = value.replace(BIDI_AND_CONTROLS, '').trim();
  if (!cleaned) return { ok: false };
  // Length check on the scrubbed value before and after policy: refuse, do not slice.
  if (cleaned.length > MAX_INTENT_STRING_LENGTH) return { ok: false };

  const lowerKey = key.toLowerCase();
  let url: string | undefined;
  if (HREF_URL_KEYS.has(lowerKey) || lowerKey === 'href') {
    url = safeHref(cleaned, 'untrusted');
  } else if (MEDIA_URL_KEYS.has(lowerKey) || lowerKey.endsWith('src') || lowerKey.endsWith('url')) {
    url = safeMediaSrc(cleaned, 'untrusted');
    // Allow https/mailto via href policy when media policy is stricter on blobs.
    if (!url) url = safeHref(cleaned, 'untrusted');
  } else {
    url = cleaned;
  }
  if (!url) return { ok: false };
  if (url.length > MAX_INTENT_STRING_LENGTH) return { ok: false };
  return { ok: true, url };
}

function isUrlBearingKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    HREF_URL_KEYS.has(lower) ||
    MEDIA_URL_KEYS.has(lower) ||
    lower === 'href' ||
    lower.endsWith('href') ||
    lower.endsWith('src') ||
    lower.endsWith('url')
  );
}

/**
 * Sanitize intent payload: plain JSON-like values only, no HTML strings,
 * no functions, no forbidden style/class keys. URL-bearing fields must pass
 * the core URL policy (`untrusted`); failures yield `unsafe-url` without
 * echoing the raw value.
 */
export function sanitizeIntentPayload(
  raw: Readonly<Record<string, unknown>> | undefined,
  kind: ArtifactIntentKind = 'custom'
):
  | { ok: true; payload: Readonly<Record<string, unknown>> }
  | { ok: false; reason: ArtifactFrameIssueCode; message: string } {
  if (raw === undefined) {
    if (kind === 'navigate') {
      return {
        ok: false,
        reason: 'invalid-intent',
        message: 'Navigate intents require a payload.href string.',
      };
    }
    return { ok: true, payload: Object.freeze({}) };
  }
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: 'invalid-intent',
      message: 'Intent payload must be a plain object.',
    };
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'class' || key === 'className' || key === 'style' || key === 'styles') {
      return {
        ok: false,
        reason: 'invalid-intent',
        message: `Intent payload key "${key}" is forbidden.`,
      };
    }
    if (typeof value === 'function') {
      return {
        ok: false,
        reason: 'invalid-intent',
        message: 'Intent payload must not contain functions.',
      };
    }
    if (typeof value === 'string') {
      // URL fields: policy first so javascript:/data: become `unsafe-url`,
      // not a generic HTML rejection that might echo context.
      if (isUrlBearingKey(key)) {
        const checked = policyCheckUrl(key, value);
        if (!checked.ok) {
          return {
            ok: false,
            reason: 'unsafe-url',
            // Do not echo the unsafe URL into diagnostics or summaries.
            message: 'Intent URL was refused by the URL policy.',
          };
        }
        // Store the full policy-checked URL; never truncate URL fields.
        out[key] = checked.url;
        continue;
      }
      if (looksLikeHtmlString(value)) {
        return {
          ok: false,
          reason: 'invalid-intent',
          message: `Intent payload "${key}" looks like HTML.`,
        };
      }
      out[key] = capString(value.replace(BIDI_AND_CONTROLS, ''));
      continue;
    }
    if (
      value === null ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      if (
        !value.every(
          (item) =>
            item === null ||
            typeof item === 'string' ||
            (typeof item === 'number' && Number.isFinite(item)) ||
            typeof item === 'boolean'
        )
      ) {
        return {
          ok: false,
          reason: 'invalid-intent',
          message: `Intent payload "${key}" array must be scalar-only.`,
        };
      }
      if (value.some((item) => typeof item === 'string' && looksLikeHtmlString(item))) {
        return {
          ok: false,
          reason: 'invalid-intent',
          message: `Intent payload "${key}" contains HTML-like strings.`,
        };
      }
      const items = value.map((item) =>
        typeof item === 'string' ? capString(item.replace(BIDI_AND_CONTROLS, '')) : item
      );
      out[key] = Object.freeze(items);
      continue;
    }
    if (isPlainObject(value)) {
      const nested: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(value)) {
        if (
          nv !== null &&
          typeof nv !== 'string' &&
          typeof nv !== 'number' &&
          typeof nv !== 'boolean'
        ) {
          return {
            ok: false,
            reason: 'invalid-intent',
            message: `Intent payload "${key}.${nk}" must be a scalar.`,
          };
        }
        if (typeof nv === 'string' && looksLikeHtmlString(nv)) {
          return {
            ok: false,
            reason: 'invalid-intent',
            message: `Intent payload "${key}.${nk}" looks like HTML.`,
          };
        }
        if (typeof nv === 'number' && !Number.isFinite(nv)) {
          return {
            ok: false,
            reason: 'invalid-intent',
            message: `Intent payload "${key}.${nk}" must be finite.`,
          };
        }
        if (typeof nv === 'string' && isUrlBearingKey(nk)) {
          const checked = policyCheckUrl(nk, nv);
          if (!checked.ok) {
            return {
              ok: false,
              reason: 'unsafe-url',
              message: 'Intent URL was refused by the URL policy.',
            };
          }
          nested[nk] = checked.url;
          continue;
        }
        nested[nk] = typeof nv === 'string' ? capString(nv.replace(BIDI_AND_CONTROLS, '')) : nv;
      }
      out[key] = Object.freeze(nested);
      continue;
    }
    return {
      ok: false,
      reason: 'invalid-intent',
      message: `Intent payload "${key}" has an unsupported type.`,
    };
  }

  if (kind === 'navigate') {
    if (typeof out.href !== 'string' || !out.href) {
      return {
        ok: false,
        reason: 'invalid-intent',
        message: 'Navigate intents require a payload.href string.',
      };
    }
  }

  return { ok: true, payload: Object.freeze(out) };
}

function defaultSummary(
  kind: ArtifactIntentKind,
  payload: Readonly<Record<string, unknown>>
): string {
  switch (kind) {
    case 'navigate': {
      // Only echo policy-checked href already in the payload.
      const href = typeof payload.href === 'string' ? payload.href : 'link';
      return scrubDisplayText(`Open ${href}`, MAX_INTENT_SUMMARY_LENGTH);
    }
    case 'activate':
      return 'Activate control';
    case 'copy':
      return 'Copy text';
    case 'dismiss':
      return 'Dismiss';
    case 'custom':
      return typeof payload.name === 'string'
        ? scrubDisplayText(`Action: ${payload.name}`, MAX_INTENT_SUMMARY_LENGTH)
        : 'Custom action';
    default:
      return 'Action';
  }
}

/**
 * Build a host-owned artifact frame around untrusted catalog output.
 *
 * Rules:
 * 1. `label` is required, plain text, non-empty (no HTML).
 * 2. A visible `badge` is always set (default "Untrusted content").
 * 3. Inner render defaults to **untrusted** tier; developer tier needs opt-in.
 * 4. Actions are never executed here — only proposed as {@link ArtifactIntent}.
 * 5. `requiresVisibleChrome` is always `true`.
 */
export function createArtifactFrame(options: CreateArtifactFrameOptions): ArtifactFrame {
  const diagnostics: ArtifactFrameDiagnostic[] = [];
  const id = nextFrameId(options.id);

  const labelResult = normalizePlainText(options.label, 'label');
  if (!labelResult.ok) {
    diagnostics.push({
      code: labelResult.code,
      path: 'frame.label',
      message: labelResult.message,
      id,
    });
    return freezeFrame({
      id,
      label: '',
      badge: DEFAULT_BADGE,
      requiresVisibleChrome: true,
      roots: [],
      diagnostics,
      intents: [],
    });
  }

  let source: string | undefined;
  if (options.source !== undefined) {
    const sourceResult = normalizePlainText(options.source, 'source');
    if (!sourceResult.ok) {
      diagnostics.push({
        code: sourceResult.code,
        path: 'frame.source',
        message: sourceResult.message,
        id,
      });
    } else {
      source = sourceResult.text;
    }
  }

  let badge = DEFAULT_BADGE;
  if (options.badge !== undefined) {
    const badgeResult = normalizePlainText(options.badge, 'badge');
    if (!badgeResult.ok) {
      diagnostics.push({
        code: badgeResult.code,
        path: 'frame.badge',
        message: badgeResult.message,
        id,
      });
    } else {
      badge = badgeResult.text;
    }
  }

  let tier = resolveTier(options.tier);
  if (tier === 'developer' && options.allowDeveloperTier !== true) {
    diagnostics.push({
      code: 'invalid-intent',
      path: 'frame.tier',
      message:
        'Artifact frames default to untrusted tier; set allowDeveloperTier to use developer tier.',
      id,
    });
    tier = 'untrusted';
  }

  let result: RenderResult;
  if (options.result) {
    result = options.result;
  } else {
    result = renderCatalogTree(options.tree ?? [], {
      catalog: options.catalog,
      tier,
      ...options.render,
    });
  }
  diagnostics.push(...mapRenderDiagnostics(result.diagnostics));

  return freezeFrame({
    id,
    label: labelResult.text,
    ...(source ? { source } : {}),
    badge,
    requiresVisibleChrome: true,
    roots: result.roots,
    diagnostics,
    intents: [],
  });
}

/**
 * Propose an action from framed content. The host must {@link confirmIntent}
 * or {@link rejectIntent} — the frame never runs the action.
 *
 * URL-bearing payload fields are checked with the core URL policy before the
 * intent is queued. Unsafe URLs yield `unsafe-url` and never appear in the
 * summary or `pendingIntents`.
 */
export function proposeIntent(
  frame: ArtifactFrame,
  input: ProposeIntentInput,
  options?: { allowIntentKinds?: readonly ArtifactIntentKind[] }
): ProposeIntentResult {
  if (!INTENT_KINDS_LIST.has(input.kind)) {
    return {
      ok: false,
      reason: 'invalid-intent',
      message: `Unknown intent kind "${String(input.kind)}".`,
      frame,
    };
  }

  const allowed = options?.allowIntentKinds;
  if (allowed && !allowed.includes(input.kind)) {
    return {
      ok: false,
      reason: 'intent-kind-denied',
      message: `Intent kind "${input.kind}" is not allowed by the host.`,
      frame,
    };
  }

  if (typeof input.path !== 'string' || !input.path.trim()) {
    return {
      ok: false,
      reason: 'invalid-intent',
      message: 'Intent path must be a non-empty string.',
      frame,
    };
  }

  const payloadResult = sanitizeIntentPayload(input.payload, input.kind);
  if (!payloadResult.ok) {
    return {
      ok: false,
      reason: payloadResult.reason,
      message: payloadResult.message,
      frame,
    };
  }

  let summary: string;
  if (input.summary !== undefined) {
    const summaryResult = normalizePlainText(input.summary, 'summary', MAX_INTENT_SUMMARY_LENGTH);
    if (!summaryResult.ok) {
      return {
        ok: false,
        reason: summaryResult.code === 'html-label' ? 'html-label' : 'invalid-intent',
        message: summaryResult.message,
        frame,
      };
    }
    summary = summaryResult.text;
  } else {
    summary = defaultSummary(input.kind, payloadResult.payload);
  }

  const intent: ArtifactIntent = Object.freeze({
    id: nextIntentId(),
    kind: input.kind,
    path: input.path.trim(),
    ...(typeof input.componentId === 'string' && input.componentId.trim()
      ? { componentId: input.componentId.trim() }
      : {}),
    payload: payloadResult.payload,
    summary,
    status: 'pending' as const,
  });

  const next = freezeFrame({
    ...frame,
    intents: [...frame.intents, intent],
  });

  return { ok: true, intent, frame: next };
}

function settleIntent(
  frame: ArtifactFrame,
  intentId: string,
  status: 'confirmed' | 'rejected'
): SettleIntentResult {
  const index = frame.intents.findIndex((intent) => intent.id === intentId);
  if (index < 0) {
    return {
      ok: false,
      reason: 'unknown-intent',
      message: `No intent "${intentId}" on this frame.`,
      frame,
    };
  }
  const current = frame.intents[index];
  if (!current) {
    return {
      ok: false,
      reason: 'unknown-intent',
      message: `No intent "${intentId}" on this frame.`,
      frame,
    };
  }
  if (current.status !== 'pending') {
    return {
      ok: false,
      reason: 'intent-not-pending',
      message: `Intent "${intentId}" is already ${current.status}.`,
      frame,
    };
  }
  const settled: ArtifactIntent = Object.freeze({ ...current, status });
  const intents = frame.intents.map((intent, i) => (i === index ? settled : intent));
  const next = freezeFrame({ ...frame, intents });
  return { ok: true, intent: settled, frame: next };
}

/** Host accepts the intent (still must apply side effects itself). */
export function confirmIntent(frame: ArtifactFrame, intentId: string): SettleIntentResult {
  return settleIntent(frame, intentId, 'confirmed');
}

/** Host declines the intent. */
export function rejectIntent(frame: ArtifactFrame, intentId: string): SettleIntentResult {
  return settleIntent(frame, intentId, 'rejected');
}

/** Pending intents only. */
export function pendingIntents(frame: ArtifactFrame): readonly ArtifactIntent[] {
  return Object.freeze(frame.intents.filter((intent) => intent.status === 'pending'));
}

/**
 * Host chrome checklist: every field the UI must show.
 * Returns false when the frame failed label validation (empty roots + diagnostics).
 */
export function artifactChrome(frame: ArtifactFrame): {
  ok: boolean;
  label: string;
  badge: string;
  source?: string;
  requiresVisibleChrome: true;
} {
  const ok = frame.label.length > 0 && frame.requiresVisibleChrome === true;
  return {
    ok,
    label: frame.label,
    badge: frame.badge,
    ...(frame.source ? { source: frame.source } : {}),
    requiresVisibleChrome: true,
  };
}
