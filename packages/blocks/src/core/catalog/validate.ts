import { type Block, safeParseBlocks } from '../schema/blocks.ts';
import { toJsonPath } from '../schema/primitives.ts';
import { getCatalogEntry } from './entries.ts';
import type { BlockAuthoringDiagnostic, BlockAuthoringValidation } from './types.ts';

/**
 * Validate untrusted block author input and return path-addressed repair
 * diagnostics. Never throws.
 */
export function validateBlocksForAuthoring(input: unknown): BlockAuthoringValidation {
  const parsed = safeParseBlocks(input);
  if (!parsed.success) {
    return {
      valid: false,
      diagnostics: parsed.issues.map(
        (issue): BlockAuthoringDiagnostic => ({
          code: 'invalid-block',
          path: issue.path,
          jsonPath: toJsonPath(issue.path),
          message: issue.message,
          hint: 'Compare the value to BLOCK_CATALOG for this type (useWhen, limits and examples).',
        })
      ),
    };
  }

  const diagnostics: BlockAuthoringDiagnostic[] = [];
  for (const [index, block] of parsed.data.entries()) {
    const entry = getCatalogEntry(block.type);
    if (!entry) {
      diagnostics.push({
        code: 'unknown-type',
        path: [index, 'type'],
        jsonPath: toJsonPath([index, 'type']),
        message: `No catalog entry for type "${block.type}"`,
        hint: 'Use a type listed in BLOCK_CATALOG.',
      });
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/** Re-export parsed blocks when authoring validation succeeds. */
export function parseBlocksForAuthoring(
  input: unknown
): { success: true; blocks: Block[] } | { success: false; validation: BlockAuthoringValidation } {
  const validation = validateBlocksForAuthoring(input);
  if (!validation.valid) return { success: false, validation };
  const parsed = safeParseBlocks(input);
  if (!parsed.success) return { success: false, validation };
  return { success: true, blocks: parsed.data };
}
