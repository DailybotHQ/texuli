import { MAX_PATCH_OPERATIONS } from '@texuli/document/ops';
import {
  DOCUMENT_COMMANDS,
  type DocumentCommandInput,
  type DocumentCommandName,
  runDocumentCommand,
} from '../document/index.ts';
import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import type { Operation } from './types.ts';

/** The largest document or Markdown input, in characters (and bytes, through `limits`). */
export const MAX_SOURCE = 2_000_000;

/** The commands that need the PDF or DOCX writers: `document.export`, node-only. */
export const EXPORT_COMMANDS = ['to-docx', 'to-pdf'] as const;
/** Every other document command: `document.run`, edge. */
export const RUN_COMMANDS = DOCUMENT_COMMANDS.filter(
  (command) => !(EXPORT_COMMANDS as readonly string[]).includes(command)
) as Exclude<DocumentCommandName, (typeof EXPORT_COMMANDS)[number]>[];

const documentSchema: JsonSchema = {
  type: 'object',
  description: 'A Texuli document (format texuli-document, formatVersion 1).',
};
const tierSchema: JsonSchema = {
  type: 'string',
  enum: ['developer', 'untrusted'],
  default: 'untrusted',
  description: 'The URL policy tier links and media are checked at (default untrusted).',
};
const EXAMPLE_DOCUMENT = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Fictional brief', locale: 'en' },
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      content: [{ type: 'text', text: 'A fictional paragraph.', marks: [] }],
    },
  ],
};

/** The legacy `document` tool's input (every command), for the alias. */
export const LEGACY_DOCUMENT_INPUT: JsonSchema = {
  type: 'object',
  properties: {
    command: { type: 'string', enum: DOCUMENT_COMMANDS },
    document: documentSchema,
    markdown: { type: 'string', maxLength: MAX_SOURCE },
    patch: { type: 'array', maxItems: MAX_PATCH_OPERATIONS, items: { type: 'object' } },
    tier: tierSchema,
    key: { type: 'string', pattern: '^[A-Za-z0-9._:-]{1,64}$' },
  },
  required: ['command'],
  additionalProperties: false,
};

const pick = (input: Record<string, unknown>): DocumentCommandInput => ({
  ...(Object.hasOwn(input, 'document') ? { document: input.document } : {}),
  ...(typeof input.markdown === 'string' ? { markdown: input.markdown } : {}),
  ...(Object.hasOwn(input, 'patch') ? { patch: input.patch } : {}),
  ...(input.tier === 'developer' || input.tier === 'untrusted' ? { tier: input.tier } : {}),
  ...(typeof input.key === 'string' ? { key: input.key } : {}),
});

export const documentRun: Operation = defineOperation({
  name: 'document.run',
  title: 'Run a document command',
  summary: `Create, validate, inspect, patch and convert a Texuli document (spec 0.7.0): capabilities, the JSON Schema, validate, inspect, a bounded RFC 6902 patch (at most ${MAX_PATCH_OPERATIONS} operations), from-markdown, to-markdown and to-blueprint. Returns { result } with the command output; PDF and DOCX are document.export.`,
  input: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: RUN_COMMANDS,
        description:
          'capabilities and schema take nothing; from-markdown takes markdown; every other command takes document.',
      },
      document: documentSchema,
      markdown: {
        type: 'string',
        maxLength: MAX_SOURCE,
        description: 'Markdown text for from-markdown.',
      },
      patch: {
        type: 'array',
        maxItems: MAX_PATCH_OPERATIONS,
        items: { type: 'object' },
        description: 'RFC 6902 operations for patch (add, remove, replace, move, copy, test).',
      },
      tier: tierSchema,
      key: {
        type: 'string',
        pattern: '^[A-Za-z0-9._:-]{1,64}$',
        description: 'The node key for to-blueprint (default "document").',
      },
    },
    required: ['command'],
    additionalProperties: false,
  },
  output: { type: 'object', properties: { result: { type: 'object' } }, required: ['result'] },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: MAX_SOURCE + 100_000, items: MAX_PATCH_OPERATIONS, timeMs: 10_000 },
  examples: [
    {
      title: 'Import Markdown',
      input: { command: 'from-markdown', markdown: '# Brief\n\nA fictional plan.' },
    },
    {
      title: 'Rename a document with a patch',
      input: {
        command: 'patch',
        document: EXAMPLE_DOCUMENT,
        patch: [{ op: 'replace', path: '/meta/title', value: 'Renamed' }],
      },
    },
  ],
  async handler(input) {
    return { result: await runDocumentCommand(input.command as DocumentCommandName, pick(input)) };
  },
});

export const documentExport: Operation = defineOperation({
  name: 'document.export',
  title: 'Export a document as PDF or DOCX',
  summary:
    'Write a Texuli document as PDF or DOCX bytes with the owned writers, links and media checked at the tier. Returns { result } with ok, mime, byteLength, base64 bytes (no files are written), diagnostics and, for PDF, pageCount. Needs Node.',
  input: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['pdf', 'docx'], description: 'The file format to write.' },
      document: documentSchema,
      tier: tierSchema,
    },
    required: ['format', 'document'],
    additionalProperties: false,
  },
  output: { type: 'object', properties: { result: { type: 'object' } }, required: ['result'] },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'node',
  limits: { inputBytes: MAX_SOURCE + 100_000, timeMs: 30_000 },
  examples: [
    { title: 'A PDF of a short brief', input: { format: 'pdf', document: EXAMPLE_DOCUMENT } },
  ],
  async handler(input) {
    const command = input.format === 'docx' ? 'to-docx' : 'to-pdf';
    return { result: await runDocumentCommand(command, pick(input)) };
  },
});

/** Route a legacy `document` tool call to document.run or document.export. */
export function routeLegacyDocument(input: Record<string, unknown>): {
  name: string;
  input: Record<string, unknown>;
} {
  if (input.command === 'to-docx' || input.command === 'to-pdf') {
    return {
      name: 'document.export',
      input: {
        format: input.command === 'to-docx' ? 'docx' : 'pdf',
        ...(Object.hasOwn(input, 'document') ? { document: input.document } : {}),
        ...(input.tier === undefined ? {} : { tier: input.tier }),
      },
    };
  }
  return { name: 'document.run', input };
}
