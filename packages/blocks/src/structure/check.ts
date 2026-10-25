// Structure blocks nest any block, so they need the full multi-family parser.
import { safeParseBlock } from '../core/schema/blocks.ts';
import type { FieldIssue } from '../core/schema/primitives.ts';
import type { StructureFamilyBlock } from './engine.ts';

const STRUCTURE_TYPES = new Set([
  'columns',
  'grid',
  'tabs',
  'accordion',
  'cards',
  'divider',
  'cta',
]);

export type StructureBlockCheck =
  | { ok: true; block: StructureFamilyBlock }
  | { ok: false; issues: FieldIssue[] };

/**
 * The only way data reaches a structure renderer: untrusted input runs through
 * the block schemas, then must be one of the structure family types.
 */
export function checkStructureBlock(value: unknown): StructureBlockCheck {
  const parsed = safeParseBlock(value);
  if (!parsed.success) return { ok: false, issues: parsed.issues };
  if (!STRUCTURE_TYPES.has(parsed.data.type)) {
    return {
      ok: false,
      issues: [{ path: ['type'], message: `"${parsed.data.type}" is not a structure block` }],
    };
  }
  return { ok: true, block: parsed.data as StructureFamilyBlock };
}
