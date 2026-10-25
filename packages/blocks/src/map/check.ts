import type { FieldIssue } from '../core/schema/primitives.ts';
import { type MapBlock, parseMapBlock } from './schema.ts';

export type MapBlockCheck = { ok: true; block: MapBlock } | { ok: false; issues: FieldIssue[] };

/** The only way data reaches the map renderer. */
export function checkMapBlock(value: unknown): MapBlockCheck {
  const parsed = parseMapBlock(value);
  return parsed.success ? { ok: true, block: parsed.data } : { ok: false, issues: parsed.issues };
}
