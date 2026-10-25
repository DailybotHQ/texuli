import { parseFamilyBlock } from '../core/schema/parse-family.ts';
import type { FieldIssue } from '../core/schema/primitives.ts';
import type { InteractiveFamilyBlock } from './engine.ts';
import { parseInteractiveBlock } from './schema.ts';

export type InteractiveBlockCheck =
  | { ok: true; block: InteractiveFamilyBlock }
  | { ok: false; issues: FieldIssue[] };

export function checkInteractiveBlock(value: unknown): InteractiveBlockCheck {
  // Only this family's parser: the renderer does not bundle every family's rules.
  const parsed = parseFamilyBlock<InteractiveFamilyBlock>(
    value,
    [parseInteractiveBlock],
    'interactive'
  );
  if (!parsed.success) return { ok: false, issues: parsed.issues };
  return { ok: true, block: parsed.data };
}
