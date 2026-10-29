/**
 * The stage's built-in block support (`./builtin.ts`), imported on first use.
 * The stage asks for it only when it needs it: no renderer table brings a
 * block check (`validateBlock` or `loadValidateBlock`), or a free slide is
 * left to the built-in renderer. Until it arrives the stage validates
 * nothing and paints a loading status, so no block is accepted unchecked;
 * if the import fails, every free-slide block is refused. After the first
 * import every stage reads it synchronously (`loadedBuiltinDeckBlocks()`),
 * and a host that wants its first stage to paint at once awaits
 * `loadBuiltinDeckBlocks()` before mounting it.
 */
import type { DeckSlide } from '@texuli/deck/model';
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '@texuli/deck/schema';
import type { DeckBlockCheck } from './prepare-core.ts';
import { type DeckLazyRenderer, type DeckSlideRendererProps, loadRenderer } from './renderers.ts';

/** What the built-in chunk gives the stage. */
export interface BuiltinDeckBlocks {
  /** The default free-slide block check (`validateDeckBlock`). */
  readonly validateBlock: DeckBlockCheck;
  /** Warm the block families of free slides the built-in renderer paints. */
  readonly prefetch: (slides: readonly DeckSlide[]) => Promise<void>;
  /** False when the chunk failed to load (every block is refused). */
  readonly ok: boolean;
}

type BuiltinModule = typeof import('./builtin.ts');

let module: Promise<BuiltinModule> | undefined;

function importBuiltin(): Promise<BuiltinModule> {
  module ??= import('./builtin.ts').catch((error: unknown) => {
    // A failed chunk can be retried by the next stage.
    module = undefined;
    throw error;
  });
  return module;
}

/**
 * The built-in free-slide renderer as a lazy renderer entry: one shared
 * object, so once it has loaded every stage paints it on the first render.
 */
export const BUILTIN_FREE_RENDERER = {
  load: () => importBuiltin().then((loaded) => loaded.FreeSlide),
} as unknown as DeckLazyRenderer<DeckSlideRendererProps>;

function refuseBlocks(_block: unknown, path: PathSegment[]): DeckDiagnostic[] {
  return [
    createDiagnostic('block-props', 'The block check could not be loaded.', path, {
      fix: 'Reload the page: the stage could not load its block check.',
    }),
  ];
}

let loaded: BuiltinDeckBlocks | undefined;
let loading: Promise<BuiltinDeckBlocks> | undefined;

/**
 * Import the built-in block support once (later calls share the import).
 * Never rejects: a failed import resolves to a check that refuses every
 * block (and is not cached, so a later stage retries).
 */
export function loadBuiltinDeckBlocks(): Promise<BuiltinDeckBlocks> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= Promise.all([importBuiltin(), loadRenderer(BUILTIN_FREE_RENDERER)]).then(
    ([builtin]) => {
      loaded = Object.freeze({
        validateBlock: builtin.validateDeckBlock,
        prefetch: (slides: readonly DeckSlide[]) => builtin.prefetchDeckSlides(slides),
        ok: true,
      });
      return loaded;
    },
    () => {
      loading = undefined;
      return Object.freeze({
        validateBlock: refuseBlocks,
        prefetch: () => Promise.resolve(),
        ok: false,
      });
    }
  );
  return loading;
}

/** The built-in block support when it has already loaded, synchronously. */
export function loadedBuiltinDeckBlocks(): BuiltinDeckBlocks | undefined {
  return loaded;
}
