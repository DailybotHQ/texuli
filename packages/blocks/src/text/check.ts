import { parseFamilyBlock } from '../core/schema/parse-family.ts';
import type { FieldIssue } from '../core/schema/primitives.ts';
import { parseTextFamilyBlock } from '../core/schema/text-family.ts';
import type { TextFamilyBlock } from './engine.ts';

export type TextBlockCheck =
  | { ok: true; block: TextFamilyBlock }
  | { ok: false; issues: FieldIssue[] };

/**
 * The only way data reaches a text renderer: untrusted input runs through the
 * block schemas, then must be one of the text family types.
 */
export function checkTextBlock(value: unknown): TextBlockCheck {
  // Only this family's parser: the renderer does not bundle every family's rules.
  const parsed = parseFamilyBlock<TextFamilyBlock>(value, [parseTextFamilyBlock], 'text');
  if (!parsed.success) return { ok: false, issues: parsed.issues };
  return { ok: true, block: parsed.data };
}
