import type { HrefTrust } from '@texuli/core/url-policy';
import type { MediaGenerationOptions, MediaProvenance } from '../provenance.ts';

export type {
  MediaGenerationOptions,
  MediaGenerationOptionValue,
  MediaProvenance,
  MediaProvenanceSource,
} from '../provenance.ts';

/** What the host generator is asked to produce. */
export type GeneratorKind = 'image' | 'video';

/** Lifecycle of one slot request. */
export type GeneratorSlotStatus = 'idle' | 'loading' | 'ready' | 'error' | 'cancelled' | 'blocked';

/**
 * Host-provided generator. Texuli never ships a model or opens the network.
 * Honor `signal` (abort on cancel / new prompt). Return a result whose `src`
 * will be checked by the media URL policy before display.
 */
export type MediaGenerator = (
  request: GeneratorRequest,
  signal: AbortSignal
) => Promise<GeneratorResult>;

export type GeneratorRequest = {
  /** User prompt (trimmed; empty prompts are refused before the host is called). */
  prompt: string;
  kind: GeneratorKind;
  /** Bounded, plain-data generation settings; prompt and credentials are not options. */
  options?: MediaGenerationOptions;
};

/** Successful host payload before policy checks. */
export type GeneratorResult =
  | {
      kind: 'image';
      /** Image URL; validated with `safeImageSrc`. */
      src: string;
      alt?: string;
      width?: number;
      height?: number;
      provenance?: MediaProvenance;
    }
  | {
      kind: 'video';
      /** Video URL; validated with `safeMediaSrc`. */
      src: string;
      /** Optional poster; validated with `safeImageSrc`. */
      poster?: string;
      title?: string;
      width?: number;
      height?: number;
      provenance?: MediaProvenance;
    };

/** Policy-checked result ready for the UI. */
export type SafeGeneratorOutput =
  | {
      kind: 'image';
      src: string;
      alt: string;
      width?: number;
      height?: number;
      provenance: MediaProvenance;
    }
  | {
      kind: 'video';
      src: string;
      poster?: string;
      title: string;
      width?: number;
      height?: number;
      provenance: MediaProvenance;
    };

export type GeneratorTrust = HrefTrust;

export type GeneratorSlotLabels = {
  prompt: string;
  promptPlaceholder: string;
  generate: string;
  cancel: string;
  kindImage: string;
  kindVideo: string;
  idle: string;
  loading: string;
  cancelled: string;
  emptyPrompt: string;
  noGenerator: string;
  failed: string;
  blocked: string;
  result: string;
  provenance: string;
  provenanceSource: string;
  provenanceProvider: string;
  provenanceKind: string;
  provenancePromptHash: string;
  provenanceOptions: string;
  provenanceCreatedAt: string;
};

export type GeneratorSlotProps = {
  /** Host callback. Required for generation; without it the control stays idle. */
  generate?: MediaGenerator;
  /** Default kind when the user has not chosen. */
  kind?: GeneratorKind;
  /** Initial prompt text. */
  prompt?: string;
  trust?: GeneratorTrust;
  /** Exact HTTPS origins allowed for untrusted media results. */
  allowedOrigins?: readonly string[];
  /** Model-free label recorded with generated output; defaults to `host:provided`. */
  providerLabel?: string;
  /** Plain-data options forwarded to the host and retained in provenance. */
  generationOptions?: MediaGenerationOptions;
  /** Max prompt length (characters). Default 2000. */
  maxPromptLength?: number;
  labels?: Partial<GeneratorSlotLabels>;
  /** Fires whenever status changes. */
  onstatus?: (status: GeneratorSlotStatus) => void;
  /** Fires with the safe output after a successful run. */
  onresult?: (result: SafeGeneratorOutput) => void;
  /** Fires with a machine reason when a run fails or is blocked. */
  onerror?: (reason: GeneratorFailureReason) => void;
};

export type GeneratorFailureReason =
  | 'empty-prompt'
  | 'invalid-kind'
  | 'invalid-options'
  | 'no-generator'
  | 'aborted'
  | 'host-error'
  | 'invalid-result'
  | 'blocked-src';
