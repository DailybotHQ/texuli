import { parseCodeFamilyBlock } from '../core/schema/code-family.ts';
import { parseFamilyBlock } from '../core/schema/parse-family.ts';
import type { FieldIssue } from '../core/schema/primitives.ts';
import type { CodeFamilyBlock } from './family-engine.ts';

export type CodeBlockCheck =
  | { ok: true; block: CodeFamilyBlock }
  | { ok: false; issues: FieldIssue[] };

/**
 * The only way data reaches the code renderer: untrusted input runs through
 * the block schemas (length, line count, language token, no bidi controls),
 * then must be a code block.
 */
export function checkCodeBlock(value: unknown): CodeBlockCheck {
  // Only this family's parser: the renderer does not bundle every family's rules.
  const parsed = parseFamilyBlock<CodeFamilyBlock>(value, [parseCodeFamilyBlock], 'code');
  if (!parsed.success) return { ok: false, issues: parsed.issues };
  return { ok: true, block: parsed.data };
}
