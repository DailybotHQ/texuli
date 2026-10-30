/**
 * JSON Schema for the theme contract. Generated from the TypeScript role and
 * enum lists so agents can validate offline without a schema library at runtime.
 */

import { SYSTEM_TOKEN_NAMES } from '../system/names.ts';
import {
  BUTTON_HOOK_VALUES,
  CARD_HOOK_VALUES,
  FOCUS_RING_HOOK_VALUES,
  INPUT_HOOK_VALUES,
} from './hooks.ts';
import { REFERENCE_SCALE_IDS } from './reference.ts';
import { INTERACTION_STATES, SEMANTIC_ROLES } from './semantic.ts';

const colorSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 96,
  description: 'Safe CSS color: hex, keyword, or rgb/hsl/oklch/color-mix/var/calc',
} as const;

const roleValueSchema = {
  oneOf: [
    colorSchema,
    {
      type: 'object',
      required: ['default'],
      properties: {
        default: colorSchema,
        hover: colorSchema,
        active: colorSchema,
        disabled: colorSchema,
        focus: colorSchema,
      },
      additionalProperties: false,
    },
  ],
} as const;

const paletteProperties = Object.fromEntries(SEMANTIC_ROLES.map((role) => [role, roleValueSchema]));

const hex6 = {
  type: 'string',
  pattern: '^#[0-9a-fA-F]{6}$',
} as const;

const chartTokensSchema = {
  type: 'object',
  required: ['categorical', 'sequential', 'diverging', 'grid', 'axis'],
  properties: {
    categorical: { type: 'array', minItems: 8, maxItems: 8, items: hex6 },
    sequential: { type: 'array', minItems: 9, maxItems: 9, items: hex6 },
    diverging: { type: 'array', minItems: 9, maxItems: 9, items: hex6 },
    grid: colorSchema,
    axis: colorSchema,
  },
  additionalProperties: false,
} as const;

/**
 * Draft-07-shaped JSON Schema for a Texuli theme document.
 * Keep in sync with {@link validateTheme}; tests assert role coverage.
 */
export const THEME_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://texuli.dev/schemas/theme.json',
  title: 'TexuliTheme',
  type: 'object',
  required: ['id', 'name', 'light', 'dark'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*$',
      maxLength: 64,
    },
    name: { type: 'string', minLength: 1, maxLength: 40 },
    description: { type: 'string', maxLength: 200 },
    fontFamily: { type: 'string', minLength: 1, maxLength: 300 },
    fontFamilyHeading: { type: 'string', minLength: 1, maxLength: 300 },
    fontFamilyMono: { type: 'string', minLength: 1, maxLength: 300 },
    radius: { type: 'string', maxLength: 32 },
    density: { type: 'number', minimum: 0.75, maximum: 1.25 },
    light: {
      type: 'object',
      required: [...SEMANTIC_ROLES],
      properties: paletteProperties,
      additionalProperties: false,
    },
    dark: {
      type: 'object',
      required: [...SEMANTIC_ROLES],
      properties: paletteProperties,
      additionalProperties: false,
    },
    style: {
      type: 'object',
      additionalProperties: false,
      properties: {
        elevation: { type: 'string', enum: ['flat', 'soft', 'crisp', 'glow', 'layered'] },
        surface: { type: 'string', enum: ['solid', 'glass'] },
        typography: { type: 'object' },
        shape: { type: 'object' },
        motion: { type: 'object' },
        focusRing: {
          type: 'object',
          properties: {
            style: { type: 'string', enum: ['ring', 'outline', 'glow', 'inset'] },
            width: { type: 'string' },
            offset: { type: 'string' },
          },
        },
      },
    },
    charts: {
      type: 'object',
      required: ['light', 'dark'],
      properties: {
        light: chartTokensSchema,
        dark: chartTokensSchema,
      },
      additionalProperties: false,
    },
    components: {
      type: 'object',
      additionalProperties: false,
      properties: {
        button: { type: 'string', enum: [...BUTTON_HOOK_VALUES] },
        card: { type: 'string', enum: [...CARD_HOOK_VALUES] },
        focusRing: { type: 'string', enum: [...FOCUS_RING_HOOK_VALUES] },
        input: { type: 'string', enum: [...INPUT_HOOK_VALUES] },
      },
    },
  },
  definitions: {
    interactionStates: { type: 'string', enum: [...INTERACTION_STATES] },
    semanticRoles: { type: 'string', enum: [...SEMANTIC_ROLES] },
    referenceScaleIds: { type: 'string', enum: [...REFERENCE_SCALE_IDS] },
    /**
     * Token contract v2 system tokens (ADR-020): the closed vocabulary of
     * `--tx-*` system names a design system may set. Component tokens are
     * listed by `getComponentTokensJsonSchema()` in `@texuli/tokens/components`.
     */
    systemTokens: { type: 'string', enum: [...SYSTEM_TOKEN_NAMES] },
  },
} as const;

/** Return a plain JSON-serializable copy of {@link THEME_JSON_SCHEMA}. */
export function getThemeJsonSchema(): typeof THEME_JSON_SCHEMA {
  return THEME_JSON_SCHEMA;
}
