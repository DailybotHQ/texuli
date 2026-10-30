/**
 * The validation every static output runs first (ADR-016): `validateDraft`
 * at the `untrusted` tier with the deep block schemas, any roots allowed.
 * Shared by `@texuli/tools/email` and `@texuli/tools/print`.
 */
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { type DraftValidation, validateDraft } from '@texuli/catalog/validate';
import { loadedBlockShapes } from '../ops/block-shapes-loader.ts';
import { rawFamilyCheck } from './family-check.ts';

export interface StaticDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  id?: string;
}

/**
 * The deep schema check of every `blocks-*` family, shared with
 * `blueprint.validate`: the family parsers' verdict, with each failure
 * naming the shape expected at its path (derived from the validated
 * examples, see `ops/block-shapes.ts`) once `loadBlockShapes()` has run
 * (`blueprint.validate` loads it first), so an agent can repair the block
 * from the diagnostic alone.
 */
export function checkFamilyBlock(block: unknown, id: string) {
  const result = rawFamilyCheck(block, id);
  if (result.success) return result;
  return {
    success: false as const,
    issues: result.issues.map((issue) => {
      const expected = loadedBlockShapes()?.expectedAt(block, id, issue.path ?? []);
      return expected ? { ...issue, message: `${issue.message}. ${expected}` } : issue;
    }),
  };
}

/** Validate a draft for a static target; never throws. `validation` is null when validation itself failed. */
export function validateStaticDraft(
  input: unknown,
  catalog: RenderCatalog
): { validation: DraftValidation | null; diagnostics: StaticDiagnostic[] } {
  try {
    const validation = validateDraft(input, {
      catalog,
      tier: 'untrusted',
      frameRoots: false,
      checkBlock: checkFamilyBlock,
    });
    return {
      validation,
      diagnostics: validation.diagnostics.map((d) => ({
        code: d.code,
        severity: d.severity,
        path: d.path,
        message: d.message,
        ...(d.id ? { id: d.id } : {}),
      })),
    };
  } catch {
    return {
      validation: null,
      diagnostics: [
        {
          code: 'static-failed',
          severity: 'error',
          path: '',
          message: 'The draft could not be validated.',
        },
      ],
    };
  }
}
