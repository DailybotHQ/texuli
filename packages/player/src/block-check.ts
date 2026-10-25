import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import type { DraftBlockCheck } from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';

/**
 * The family parsers injected per `blocks-*` id (the catalog entry stays
 * under its 8 KiB budget because the engines are injected here).
 */
let familyEngines: ReturnType<typeof createFamilyBlockCheck> | undefined;
// The factory runs on first use instead of at module init: an init-time
// call made loading order-sensitive under transformed module graphs.
export function checkFamilyBlock(block: unknown, id: string): DraftBlockCheck {
  familyEngines ??= createFamilyBlockCheck({
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
  return familyEngines(block, id);
}
