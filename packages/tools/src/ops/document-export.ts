/**
 * `document.export`: PDF and DOCX writers. Node only — the remote MCP
 * Function never imports this module.
 */

import { runDocumentCommand } from '../document/index.ts';
import {
  documentSchema,
  EXAMPLE_DOCUMENT,
  MAX_SOURCE,
  pickDocumentInput,
  tierSchema,
} from './document.ts';
import { defineOperation } from './registry.ts';
import type { Operation } from './types.ts';

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
    return { result: await runDocumentCommand(command, pickDocumentInput(input)) };
  },
});
