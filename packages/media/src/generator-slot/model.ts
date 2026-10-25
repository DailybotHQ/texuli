import {
  type HrefTrust,
  type SafeMediaSrcOptions,
  safeImageSrc,
  safeMediaSrc,
} from '@texuli/core/url-policy';
import { normalizeMediaGenerationOptions, parseMediaProvenance } from '../provenance.ts';
import type {
  GeneratorFailureReason,
  GeneratorKind,
  GeneratorRequest,
  GeneratorResult,
  GeneratorSlotLabels,
  GeneratorSlotStatus,
  MediaGenerationOptions,
  MediaGenerator,
  SafeGeneratorOutput,
} from './types.ts';

export const GENERATOR_SLOT_LIMITS = {
  /** Default max characters of a prompt. */
  maxPromptLength: 2000,
  /** Hard ceiling even if a caller passes a higher max. */
  absoluteMaxPromptLength: 8000,
  /** Intrinsic dimensions are metadata only; they never allocate a canvas. */
  maxIntrinsicDimension: 16_384,
} as const;

export const DEFAULT_GENERATOR_SLOT_LABELS: GeneratorSlotLabels = {
  prompt: 'Prompt',
  promptPlaceholder: 'Describe the image or clip to generate…',
  generate: 'Generate',
  cancel: 'Cancel',
  kindImage: 'Image',
  kindVideo: 'Video',
  idle: 'Enter a prompt and generate. No model runs inside Texuli.',
  loading: 'Generating…',
  cancelled: 'Generation cancelled.',
  emptyPrompt: 'Enter a prompt before generating.',
  noGenerator: 'No host generator is configured.',
  failed: 'Generation failed.',
  blocked: 'Result blocked by the media URL policy.',
  result: 'Generated result',
  provenance: 'Asset provenance',
  provenanceSource: 'Source',
  provenanceProvider: 'Provider',
  provenanceKind: 'Generator kind',
  provenancePromptHash: 'Prompt digest',
  provenanceOptions: 'Options',
  provenanceCreatedAt: 'Created',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseIntrinsicSize(
  value: Record<string, unknown>
): { ok: true; width?: number; height?: number } | { ok: false } {
  const { width, height } = value;
  if (width === undefined && height === undefined) return { ok: true };
  if (
    typeof width !== 'number' ||
    !Number.isInteger(width) ||
    width < 1 ||
    width > GENERATOR_SLOT_LIMITS.maxIntrinsicDimension ||
    typeof height !== 'number' ||
    !Number.isInteger(height) ||
    height < 1 ||
    height > GENERATOR_SLOT_LIMITS.maxIntrinsicDimension
  ) {
    return { ok: false };
  }
  return { ok: true, width, height };
}

export function resolveGeneratorSlotLabels(
  overrides?: Partial<GeneratorSlotLabels>
): GeneratorSlotLabels {
  return { ...DEFAULT_GENERATOR_SLOT_LABELS, ...overrides };
}

export function normalizeKind(value: unknown): GeneratorKind | undefined {
  return value === 'image' || value === 'video' ? value : undefined;
}

export function normalizePrompt(
  value: unknown,
  maxLength: number = GENERATOR_SLOT_LIMITS.maxPromptLength
): string {
  if (typeof value !== 'string') return '';
  const capped = Math.min(
    Math.max(1, Math.floor(maxLength) || GENERATOR_SLOT_LIMITS.maxPromptLength),
    GENERATOR_SLOT_LIMITS.absoluteMaxPromptLength
  );
  return value.replace(/\s+/g, ' ').trim().slice(0, capped);
}

export function buildRequest(
  prompt: unknown,
  kind: unknown,
  maxPromptLength?: number,
  generationOptions?: unknown
):
  | { ok: true; request: GeneratorRequest }
  | { ok: false; reason: 'empty-prompt' | 'invalid-kind' | 'invalid-options' } {
  const normalized = normalizePrompt(prompt, maxPromptLength);
  if (!normalized) return { ok: false, reason: 'empty-prompt' };
  const normalizedKind = normalizeKind(kind);
  if (!normalizedKind) return { ok: false, reason: 'invalid-kind' };
  const options = normalizeMediaGenerationOptions(generationOptions);
  if (!options) return { ok: false, reason: 'invalid-options' };
  return {
    ok: true,
    request: {
      prompt: normalized,
      kind: normalizedKind,
      ...(Object.keys(options).length > 0 ? { options } : {}),
    },
  };
}

/**
 * Apply the image/video URL policy to a host result. Unsafe sources become
 * `blocked-src`; malformed payloads become `invalid-result`.
 */
export function sanitizeGeneratorResult(
  result: unknown,
  trust: HrefTrust = 'untrusted',
  options: SafeMediaSrcOptions = {}
):
  | { ok: true; output: SafeGeneratorOutput }
  | { ok: false; reason: Extract<GeneratorFailureReason, 'invalid-result' | 'blocked-src'> } {
  if (!isRecord(result)) return { ok: false, reason: 'invalid-result' };
  const record = result;
  if (record.kind !== 'image' && record.kind !== 'video') {
    return { ok: false, reason: 'invalid-result' };
  }
  const kind = record.kind;
  const provenance = parseMediaProvenance(record.provenance);
  const size = parseIntrinsicSize(record);
  if (!provenance || !size.ok) return { ok: false, reason: 'invalid-result' };
  const audit = { provenance };
  const intrinsicSize =
    size.width !== undefined && size.height !== undefined
      ? { width: size.width, height: size.height }
      : {};

  if (kind === 'image') {
    const src = safeImageSrc(record.src, trust);
    if (typeof record.src === 'string' && record.src.trim() && !src) {
      return { ok: false, reason: 'blocked-src' };
    }
    if (!src) return { ok: false, reason: 'invalid-result' };
    const alt =
      typeof record.alt === 'string' && record.alt.trim()
        ? record.alt.trim()
        : DEFAULT_GENERATOR_SLOT_LABELS.result;
    return { ok: true, output: { kind: 'image', src, alt, ...intrinsicSize, ...audit } };
  }

  const src = safeMediaSrc(record.src, trust, options);
  if (typeof record.src === 'string' && record.src.trim() && !src) {
    return { ok: false, reason: 'blocked-src' };
  }
  if (!src) return { ok: false, reason: 'invalid-result' };

  let poster: string | undefined;
  if (record.poster !== undefined && record.poster !== null && record.poster !== '') {
    poster = safeImageSrc(record.poster, trust);
    if (!poster) return { ok: false, reason: 'blocked-src' };
  }

  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim()
      : DEFAULT_GENERATOR_SLOT_LABELS.result;

  return { ok: true, output: { kind: 'video', src, poster, title, ...intrinsicSize, ...audit } };
}

export type RunGeneratorOutcome =
  | { status: 'ready'; output: SafeGeneratorOutput }
  | { status: 'error' | 'cancelled' | 'blocked'; reason: GeneratorFailureReason; message?: string };

/**
 * Run a host generator once: validate the prompt, await the host, then
 * sanitize the result. Aborts map to `cancelled`.
 */
export async function runGenerator(
  generate: MediaGenerator | undefined,
  prompt: unknown,
  kind: unknown,
  options: {
    signal: AbortSignal;
    trust?: HrefTrust;
    allowedOrigins?: readonly string[];
    maxPromptLength?: number;
    providerLabel?: string;
    generationOptions?: MediaGenerationOptions;
  }
): Promise<RunGeneratorOutcome> {
  if (!generate) {
    return { status: 'error', reason: 'no-generator' };
  }
  const built = buildRequest(prompt, kind, options.maxPromptLength, options.generationOptions);
  if (!built.ok) {
    return { status: 'error', reason: built.reason };
  }
  if (options.signal.aborted) {
    return { status: 'cancelled', reason: 'aborted' };
  }

  let raw: GeneratorResult;
  try {
    raw = await generate(built.request, options.signal);
  } catch (error) {
    if (options.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return { status: 'cancelled', reason: 'aborted' };
    }
    const message = error instanceof Error && error.message.trim() ? error.message : undefined;
    return { status: 'error', reason: 'host-error', message };
  }

  if (options.signal.aborted) {
    return { status: 'cancelled', reason: 'aborted' };
  }
  if (!isRecord(raw) || raw.kind !== built.request.kind) {
    return { status: 'error', reason: 'invalid-result' };
  }

  let promptHash: string;
  try {
    promptHash = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(built.request.prompt))
      ),
    ]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return { status: 'error', reason: 'invalid-result' };
  }
  const incomingProvenance: Record<string, unknown> = isRecord(raw.provenance)
    ? raw.provenance
    : {};
  const generatedResult = {
    ...raw,
    provenance: {
      source: 'model',
      createdAt: new Date().toISOString(),
      generatorKind: built.request.kind,
      providerLabel: options.providerLabel ?? 'host:provided',
      promptHash,
      options: built.request.options ?? {},
      ...(incomingProvenance.parentAssetId === undefined
        ? {}
        : { parentAssetId: incomingProvenance.parentAssetId }),
      ...(incomingProvenance.contentSha256 === undefined
        ? {}
        : { contentSha256: incomingProvenance.contentSha256 }),
    },
  };
  const safe = sanitizeGeneratorResult(generatedResult, options.trust ?? 'untrusted', {
    allowedOrigins: options.allowedOrigins,
  });
  if (!safe.ok) {
    return {
      status: safe.reason === 'blocked-src' ? 'blocked' : 'error',
      reason: safe.reason,
    };
  }
  return { status: 'ready', output: safe.output };
}

export function statusMessage(
  status: GeneratorSlotStatus,
  labels: GeneratorSlotLabels,
  failure?: GeneratorFailureReason,
  hostMessage?: string
): string {
  switch (status) {
    case 'idle':
      return labels.idle;
    case 'loading':
      return labels.loading;
    case 'cancelled':
      return labels.cancelled;
    case 'ready':
      return labels.result;
    case 'blocked':
      return labels.blocked;
    case 'error':
      if (failure === 'empty-prompt') return labels.emptyPrompt;
      if (failure === 'no-generator') return labels.noGenerator;
      if (hostMessage) return hostMessage;
      return labels.failed;
    default:
      return labels.idle;
  }
}
