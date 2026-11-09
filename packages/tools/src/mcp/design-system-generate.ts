import type { GenerateDesignSystemInput } from '@texuli/tokens/design-system/compile-core';
import type { Operation } from '../ops/types.ts';

const issue = {
  type: 'object' as const,
  properties: {
    code: { type: 'string' as const },
    path: { type: 'string' as const },
    message: { type: 'string' as const },
  },
  required: ['code', 'path', 'message'],
  additionalProperties: true,
};

const report = {
  type: 'object' as const,
  properties: {
    losses: {
      type: 'array' as const,
      items: { type: 'object' as const, additionalProperties: true },
    },
    repairs: {
      type: 'array' as const,
      items: { type: 'object' as const, additionalProperties: true },
    },
    guarantees: { type: 'object' as const, additionalProperties: true },
  },
  required: ['losses', 'repairs', 'guarantees'],
  additionalProperties: false,
};

/** Draft-only MCP adapter for the deterministic tokens generator. */
export const designSystemGenerate: Operation = {
  name: 'design_system.generate',
  title: 'Generate a design-system draft',
  summary:
    'Combine a brand brief, token JSON, site CSS, logo pixels and/or a Texuli theme into a validated design-system draft. Returns the document, every reported loss, automatic AA repairs and guarantee results; it never saves or approves the draft.',
  input: {
    type: 'object',
    properties: {
      brief: { type: 'string', maxLength: 32_768 },
      tokens: { type: ['string', 'object'], maxLength: 262_144 },
      css: { type: 'string', maxLength: 262_144 },
      logoPixels: {
        type: 'object',
        properties: { data: { type: 'array', items: { type: 'number' }, maxItems: 65_536 } },
        required: ['data'],
        additionalProperties: false,
      },
      theme: { type: ['string', 'object'], maxLength: 262_144 },
    },
    required: [],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      document: { type: 'object', additionalProperties: true },
      errors: { type: 'array', items: issue },
      report,
    },
    required: ['ok', 'report'],
    additionalProperties: false,
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: 1_048_576, timeMs: 10_000 },
  examples: [
    {
      title: 'A brand brief with CSS tokens',
      input: {
        brief: 'A calm fictional studio with teal, rounded cards and compact spacing',
        css: ':root { --brand: #0e7490; --radius: 10px; --space: 4px; }',
      },
    },
  ],
  async handler(input) {
    const { generateDesignSystem } = await import('@texuli/tokens/design-system/compile-core');
    const generationInput = {
      ...(input.brief === undefined ? {} : { brief: input.brief }),
      ...(input.tokens === undefined ? {} : { tokens: input.tokens }),
      ...(input.css === undefined ? {} : { css: input.css }),
      ...(input.logoPixels === undefined ? {} : { logoPixels: input.logoPixels }),
      ...(input.theme === undefined ? {} : { theme: input.theme }),
    } as GenerateDesignSystemInput;
    return generateDesignSystem(generationInput);
  },
};
