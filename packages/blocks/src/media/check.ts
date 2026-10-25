import { parseMediaFamilyBlock } from '../core/schema/media-family.ts';
import { parseFamilyBlock } from '../core/schema/parse-family.ts';
import type { FieldIssue } from '../core/schema/primitives.ts';
import type { MediaFamilyBlock } from './engine.ts';

export type MediaBlockCheck =
  | { ok: true; block: MediaFamilyBlock }
  | { ok: false; issues: FieldIssue[] };

/**
 * The only way data reaches a media renderer: untrusted input runs through the
 * block schemas, then must be one of the media family types.
 */
export function checkMediaBlock(value: unknown): MediaBlockCheck {
  // Only this family's parser: the renderer does not bundle every family's rules.
  const parsed = parseFamilyBlock<MediaFamilyBlock>(value, [parseMediaFamilyBlock], 'media');
  if (!parsed.success) return { ok: false, issues: parsed.issues };
  return { ok: true, block: parsed.data };
}
