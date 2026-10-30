/**
 * The validation every static output runs first (ADR-016): `validateDraft`
 * at the `untrusted` tier with the deep block schemas, any roots allowed.
 * Shared by `@texuli/tools/email` and `@texuli/tools/print`.
 */
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { type DraftValidation, validateDraft } from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';

export interface StaticDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  id?: string;
}

let familyCheck: ReturnType<typeof createFamilyBlockCheck> | undefined;
/** The deep schema check of every `blocks-*` family, shared with `blueprint.validate`. */
export function checkFamilyBlock(block: unknown, id: string) {
  familyCheck ??= createFamilyBlockCheck({
    'blocks-code': checkCodeBlock,
    'blocks-data': checkDataBlock,
    'blocks-diagram': diagramFamilyCheck,
    'blocks-embed': checkEmbedBlock,
    'blocks-interactive': checkInteractiveBlock,
    'blocks-map': checkMapBlock,
    'blocks-media': checkMediaBlock,
    'blocks-structure': checkStructureBlock,
    'blocks-text': checkTextBlock,
  });
  return familyCheck(block, id);
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
