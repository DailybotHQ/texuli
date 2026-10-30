/**
 * The deep schema check of every `blocks-*` family, exactly as
 * `validateDraft` runs it: `createFamilyBlockCheck` over the family engines
 * of `@texuli/blocks`. Raw: messages are the parsers' own. `static-draft.ts`
 * adds the expected shape to each failure; `ops/block-shapes.ts` asks this
 * check which fields a block needs.
 */
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';

let familyCheck: ReturnType<typeof createFamilyBlockCheck> | undefined;

/** Check one block against the family that `id` (a `blocks-*` component) renders. Never throws. */
export function rawFamilyCheck(block: unknown, id: string) {
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
