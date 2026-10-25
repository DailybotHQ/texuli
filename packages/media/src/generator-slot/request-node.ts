import { GENERATOR_SLOT_LIMITS, normalizePrompt } from './model.ts';
import type { GeneratorKind } from './types.ts';

export const MEDIA_GENERATE_REQUEST_ID = 'media.generate-request' as const;

export const MEDIA_GENERATION_REQUEST_ASPECT_RATIOS = [
  '1:1',
  '4:3',
  '3:2',
  '16:9',
  '9:16',
] as const;

const RESOLUTION_ONLY_FIELDS = ['src', 'poster', 'status', 'resolved', 'provenance'] as const;

export type MediaGenerationAspectRatio = (typeof MEDIA_GENERATION_REQUEST_ASPECT_RATIOS)[number];

export interface MediaGenerationRequestNode {
  id: typeof MEDIA_GENERATE_REQUEST_ID;
  props: {
    kind: GeneratorKind;
    prompt: string;
    aspectRatio?: MediaGenerationAspectRatio;
    placeholder?: { kind: 'color'; color: string };
  };
}

export type MediaGenerationRequestParseResult =
  | { success: true; node: MediaGenerationRequestNode }
  | {
      success: false;
      reason: 'invalid-node' | 'empty-prompt' | 'invalid-aspect-ratio' | 'invalid-placeholder';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse an inert request node. This validates data only; it never calls a generator. */
export function parseMediaGenerationRequest(value: unknown): MediaGenerationRequestParseResult {
  if (!isRecord(value) || value.id !== MEDIA_GENERATE_REQUEST_ID || !isRecord(value.props)) {
    return { success: false, reason: 'invalid-node' };
  }
  const props = value.props;
  // A request node is data to be resolved by its host, never a partially
  // resolved media node. Reject resolution fields instead of silently
  // treating them as ignored extension data.
  if (RESOLUTION_ONLY_FIELDS.some((key) => Object.hasOwn(props, key))) {
    return { success: false, reason: 'invalid-node' };
  }
  if (props.kind !== 'image' && props.kind !== 'video') {
    return { success: false, reason: 'invalid-node' };
  }
  const prompt = normalizePrompt(props.prompt, GENERATOR_SLOT_LIMITS.maxPromptLength);
  if (!prompt) return { success: false, reason: 'empty-prompt' };

  let aspectRatio: MediaGenerationAspectRatio | undefined;
  if (props.aspectRatio !== undefined) {
    if (
      typeof props.aspectRatio !== 'string' ||
      !(MEDIA_GENERATION_REQUEST_ASPECT_RATIOS as readonly string[]).includes(props.aspectRatio)
    ) {
      return { success: false, reason: 'invalid-aspect-ratio' };
    }
    aspectRatio = props.aspectRatio as MediaGenerationAspectRatio;
  }

  let placeholder: MediaGenerationRequestNode['props']['placeholder'];
  if (props.placeholder !== undefined) {
    if (
      !isRecord(props.placeholder) ||
      props.placeholder.kind !== 'color' ||
      typeof props.placeholder.color !== 'string' ||
      !/^#[\da-f]{3}(?:[\da-f](?:[\da-f]{2}(?:[\da-f]{2})?)?)?$/i.test(props.placeholder.color)
    ) {
      return { success: false, reason: 'invalid-placeholder' };
    }
    placeholder = { kind: 'color', color: props.placeholder.color };
  }

  return {
    success: true,
    node: {
      id: MEDIA_GENERATE_REQUEST_ID,
      props: {
        kind: props.kind,
        prompt,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(placeholder ? { placeholder } : {}),
      },
    },
  };
}
