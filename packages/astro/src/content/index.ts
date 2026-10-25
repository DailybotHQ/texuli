import { type Block, type FieldIssue, safeParseBlocks } from '@texuli/blocks/core';

export type ParsedTexuliBlocks =
  | { success: true; blocks: Block[] }
  | { success: false; issues: FieldIssue[] };

/** Parse a content entry's block field using the closed Texuli block schema. */
export function parseTexuliBlocks(value: unknown): ParsedTexuliBlocks {
  const parsed = safeParseBlocks(value);
  if (!parsed.success) return { success: false, issues: parsed.issues };
  return { success: true, blocks: parsed.data };
}
