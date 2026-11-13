/**
 * `ds.save`: write a design-system document to an explicit path. Node only —
 * the remote MCP Function never imports this module.
 */

import {
  COMPILE_INPUT,
  DOCUMENT,
  DS_INPUT_BYTES,
  ISSUES,
  MINIMAL_DESIGN_SYSTEM,
  TIME_MS,
} from './design-system.ts';
import { defineOperation } from './registry.ts';
import { type Operation, OperationError } from './types.ts';

const run = () => import('./design-system-run.ts');

export const dsSave: Operation = defineOperation({
  name: 'ds.save',
  title: 'Save a design system to a file',
  summary:
    'Validate a design-system document (as ds.validate does) and write it as two-space JSON to an explicit .json path inside the working directory (traversal, symlinks, dot paths, node_modules, package.json and existing files without overwrite are refused). Anything marked approved is refused (approval-human-only). Local doors only. Returns saved, the path and bytes, or errors with stable codes.',
  input: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        minLength: 1,
        maxLength: 1024,
        description:
          'Where to write, relative to the working directory (e.g. design-systems/harborline.ds.json): a .json file outside dot directories and node_modules, never package.json.',
      },
      document: DOCUMENT,
      overwrite: {
        type: 'boolean',
        default: false,
        description: 'Replace an existing file (default false: an existing file is refused).',
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Validate the document and the path, and write nothing.',
      },
      ...COMPILE_INPUT,
    },
    required: ['path', 'document'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      saved: { type: 'boolean' },
      dryRun: { type: 'boolean' },
      path: { type: 'string' },
      bytes: { type: 'integer', minimum: 0 },
      errors: ISSUES,
    },
    required: ['saved', 'errors'],
  },
  annotations: { readOnly: false, destructive: true, idempotent: true, openWorld: true },
  runtime: 'node',
  limits: { inputBytes: DS_INPUT_BYTES, timeMs: TIME_MS },
  examples: [
    {
      title: 'Check where the minimal document would go',
      input: {
        path: 'design-systems/minimal.ds.json',
        document: MINIMAL_DESIGN_SYSTEM,
        dryRun: true,
      },
    },
  ],
  async handler(input, context) {
    if (!context.files)
      throw new OperationError(
        'runtime-unavailable',
        'ds.save needs a door that writes local files (texuli-mcp or the texuli CLI).'
      );
    return (await run()).runSave(input, context.files, context.approve === true);
  },
});
