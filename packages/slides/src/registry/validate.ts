/**
 * The second validation phase of slide content, at the host's tier:
 *
 * - `validateSlideComponent`: a component's props through the catalog
 *   (`validateDraft` with the player's catalog and the block family
 *   engines), as the one-node blueprint the player will paint. `parseDeck`
 *   calls it through the renderer table's `validateComponent` hook.
 * - `validateSlideBlock`: a free-slide block body. It accepts what the deck
 *   Markdown writes and the core block schema does not know: `math` blocks
 *   (`$$`, checked with `@texuli/deck/math`), images without `width` and
 *   `height` (measured at paint from their natural size), and the
 *   `diagram`, `map` and `embed` families (painted through the player).
 *   Everything else goes through `safeParseBlock` as before.
 */
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { safeParseBlock } from '@texuli/blocks/core';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import type { RenderCatalog, RenderTier } from '@texuli/catalog/render/renderer';
import { type DraftBlockCheck, validateDraft } from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';
import { MATH_LIMITS, texToMath } from '@texuli/deck/math';
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '@texuli/deck/schema';
import { createPlayerCatalog } from '@texuli/player';
import { componentBlueprint, type SlideCapabilities } from './blueprint.ts';
import { slideComponentSupport } from './catalog-ids.ts';
import { isUnsizedImage, playerFamilyOf, withStandInSize } from './extended.ts';

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

let familyCheck: ReturnType<typeof createFamilyBlockCheck> | undefined;

/** The `checkBlock` for `validateDraft`: every block family's own engine. */
export function checkSlideFamilyBlock(block: unknown, id: string): DraftBlockCheck {
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

let catalog: RenderCatalog | undefined;

/** The player's catalog, built once on first use. */
export function slideCatalog(): RenderCatalog {
  catalog ??= createPlayerCatalog();
  return catalog;
}

export interface SlideComponentCheck {
  tier?: RenderTier;
  capabilities?: SlideCapabilities;
}

/**
 * Check one component (`{ component, props }`) for a slide. Issues carry
 * absolute paths below `path` (`…props`), code `component-props`.
 */
export function validateSlideComponent(
  component: { component: string; props: Bag },
  path: readonly PathSegment[],
  options: SlideComponentCheck = {}
): DeckDiagnostic[] {
  const support = slideComponentSupport(component.component);
  if (support.kind === 'excluded') {
    return [
      createDiagnostic(
        'component-excluded',
        `"${component.component}" is not a slide component: ${support.reason}`,
        [...path, 'component'],
        { fix: 'Use a slide-renderable catalog component, a block family or a slide layout.' }
      ),
    ];
  }
  if (support.kind === 'unknown') return [];
  const blueprint = componentBlueprint(
    { id: component.component, props: component.props },
    options.capabilities
  );
  const result = validateDraft(blueprint, {
    catalog: slideCatalog(),
    tier: options.tier ?? 'untrusted',
    frameRoots: false,
    checkBlock: checkSlideFamilyBlock,
  });
  return result.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .slice(0, 20)
    .map((diagnostic) =>
      createDiagnostic(
        'component-props',
        `${diagnostic.code}: ${diagnostic.message}`,
        [...path, 'props'],
        { fix: `Check the props of "${component.component}" against its catalog entry.` }
      )
    );
}

const MATH_KEYS = new Set(['type', 'id', 'tex', 'display', 'tone']);

/**
 * Check one free-slide block body (step fields already removed): the
 * stage's `validateBlock` hook with the slide extensions described above.
 */
export function validateSlideBlock(block: unknown, path: PathSegment[]): DeckDiagnostic[] {
  const issue = (message: string, at: PathSegment[] = []) =>
    createDiagnostic('block-props', message, [...path, ...at], {
      fix: 'Check the block against the @texuli/blocks schema for its type.',
    });
  if (isBag(block) && block.type === 'math') {
    for (const key of Object.keys(block)) {
      if (!MATH_KEYS.has(key)) return [issue(`A math block has no "${key.slice(0, 40)}".`, [key])];
    }
    if (typeof block.tex !== 'string' || block.tex.trim() === '') {
      return [issue('A math block needs its TeX source in `tex`.', ['tex'])];
    }
    if (block.tex.length > MATH_LIMITS.source) {
      return [issue(`A formula is at most ${MATH_LIMITS.source} characters.`, ['tex'])];
    }
    const math = texToMath(block.tex, { display: true });
    return math.issues.map((item) => issue(`${item.code}: ${item.message}`, ['tex']));
  }
  const family = isBag(block) ? playerFamilyOf(block.type) : undefined;
  if (family) {
    const result = checkSlideFamilyBlock(block, family);
    if (result.success) return [];
    return result.issues.slice(0, 20).map((item) => issue(item.message, [...(item.path ?? [])]));
  }
  const body = isUnsizedImage(block) ? withStandInSize(block as Bag) : block;
  const parsed = safeParseBlock(body);
  if (parsed.success) return [];
  return parsed.issues.slice(0, 20).map((item) => issue(item.message, item.path));
}
