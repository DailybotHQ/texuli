/**
 * `block.list` and `block.schema`: the block types the `blocks-*`
 * components render, and the shape of each, so an agent can write the
 * `block` prop of a blueprint node from the protocol alone. The data comes
 * from the validator (`ops/block-shapes.ts`); nothing here is hand-written
 * per type.
 */
import { BLOCK_FAMILY_TYPES } from '@texuli/catalog/render/renderer';
import { BLOCK_TYPES, loadBlockShapes } from './block-shapes-loader.ts';
import { defineOperation } from './registry.ts';
import type { Operation } from './types.ts';

const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

const COMPONENTS = Object.keys(BLOCK_FAMILY_TYPES);

export const blockList: Operation = defineOperation({
  name: 'block.list',
  title: 'List block types',
  summary:
    'List the content block types the blocks-* components render (table, stat, cta, poll …), optionally for one component or matching words. Returns the match count and, per type, the component that renders it, a label and when to use it; read one shape with block.schema.',
  input: {
    type: 'object',
    properties: {
      component: {
        type: 'string',
        enum: COMPONENTS,
        description: 'Only the types this blocks-* component renders, e.g. "blocks-data".',
      },
      query: {
        type: 'string',
        maxLength: 200,
        description: 'Words to match against the type, its label and its useWhen notes.',
      },
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      total: { type: 'integer', minimum: 0 },
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            component: { type: 'string' },
            label: { type: 'string' },
            useWhen: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'component', 'label', 'useWhen'],
        },
      },
    },
    required: ['total', 'blocks'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 1024, items: BLOCK_TYPES.length, timeMs: 5000 },
  examples: [
    { title: 'What blocks-data renders', input: { component: 'blocks-data' } },
    { title: 'Blocks for questions', input: { query: 'question' } },
  ],
  async handler(input) {
    const { blockTypeInfos } = await loadBlockShapes();
    const component = typeof input.component === 'string' ? input.component : undefined;
    const words =
      typeof input.query === 'string'
        ? input.query.toLowerCase().split(/\s+/u).filter(Boolean)
        : [];
    const blocks = blockTypeInfos()
      .filter((info) => !component || info.component === component)
      .filter((info) => {
        const text = `${info.type} ${info.label} ${info.useWhen.join(' ')}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .map((info) => ({
        type: info.type,
        component: info.component,
        label: info.label,
        useWhen: [...info.useWhen],
      }));
    return { total: blocks.length, blocks };
  },
});

export const blockSchema: Operation = defineOperation({
  name: 'block.schema',
  title: 'Read a block shape',
  summary:
    'Read the shape of one content block type: the component that renders it, its fields as compact text and as a JSON Schema (required fields are the ones the validator refuses a block without), examples that validate in a blueprint, limits, when to use it and whether it can pass blueprint.validate today. Returns what a blocks-* node’s block prop needs.',
  input: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: BLOCK_TYPES,
        description: 'A block type from block.list, e.g. "table" or "cta".',
      },
    },
    required: ['type'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      component: { type: 'string' },
      label: { type: 'string' },
      shape: { type: 'string' },
      schema: { type: 'object' },
      examples: { type: 'array', items: { type: 'object' } },
      useWhen: { type: 'array', items: { type: 'string' } },
      dontUseWhen: { type: 'array', items: { type: 'string' } },
      limits: { type: 'array', items: { type: 'string' } },
      a11y: { type: 'string' },
      usableInBlueprint: { type: 'boolean' },
      notes: { type: 'array', items: { type: 'string' } },
      source: { type: 'string', enum: ['block-catalog', 'tools-fixture'] },
    },
    required: [
      'type',
      'component',
      'label',
      'shape',
      'schema',
      'examples',
      'limits',
      'usableInBlueprint',
      'notes',
    ],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 1024, timeMs: 5000 },
  examples: [
    { title: 'The table block', input: { type: 'table' } },
    { title: 'The call-to-action block', input: { type: 'cta' } },
  ],
  async handler(input) {
    const { blockShape, blockTypeInfo, shapeSchema, shapeText } = await loadBlockShapes();
    const type = input.type as string;
    const info = blockTypeInfo(type);
    const shape = blockShape(type);
    if (!info || !shape) throw new Error(`No shape for block type "${type}".`);
    return {
      type,
      component: info.component,
      label: info.label,
      shape: shapeText(shape),
      schema: {
        $comment:
          'Derived from validated examples; the validator (blueprint.validate) stays authoritative.',
        ...shapeSchema(shape),
      },
      examples: structuredClone([...info.examples]),
      useWhen: [...info.useWhen],
      dontUseWhen: [...info.dontUseWhen],
      limits: [...info.limits],
      ...(info.a11y ? { a11y: info.a11y } : {}),
      usableInBlueprint: info.usableInBlueprint,
      notes: [...info.notes],
      source: info.source,
    };
  },
});
