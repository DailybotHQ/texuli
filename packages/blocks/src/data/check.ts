import { parseFamilyBlock } from '../core/schema/parse-family.ts';
import type { FieldIssue } from '../core/schema/primitives.ts';
import type { DataFamilyBlock } from './engine.ts';
import { parseDataBlock } from './schema.ts';

export type DataBlockCheck =
  | { ok: true; block: DataFamilyBlock }
  | { ok: false; issues: FieldIssue[] };

export function checkDataBlock(value: unknown): DataBlockCheck {
  // Only this family's parser: the renderer does not bundle every family's rules.
  const parsed = parseFamilyBlock<DataFamilyBlock>(value, [parseDataBlock], 'data');
  if (!parsed.success) return { ok: false, issues: parsed.issues };
  return { ok: true, block: parsed.data };
}
