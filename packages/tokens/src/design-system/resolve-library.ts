/**
 * The theme library's `texuli:<id>` bases for design-system resolution: the
 * default loader `@texuli/tokens/design-system/compile` adds over the
 * library-free core (`./resolve.ts`, `@texuli/tokens/design-system/compile-core`,
 * G127). Only this module references the theme library.
 */
import type { DesignSystem } from '@texuli/spec/design-system';
import type { NeutralFamily } from '../generator/seed.ts';
import { fromTheme } from './from-theme.ts';
import {
  type DesignSystemFailure,
  type ResolveDesignSystemCoreOptions,
  type ResolvedDesignSystem,
  resolveDesignSystemCore,
} from './resolve.ts';

/** Load `texuli:<id>` from the theme library (lazily) as a document with its generator brand. */
export async function loadLibraryBase(ref: string): Promise<DesignSystem | undefined> {
  const id = ref.slice('texuli:'.length);
  const library = await import('../library-expand/registry.ts');
  try {
    const [theme, definition] = await Promise.all([
      library.loadFullLibraryTheme(id),
      library.loadFullLibraryThemeDefinition(id),
    ]);
    return fromTheme(theme, {
      brand: {
        seed: definition.seed,
        ...(definition.secondary ? { secondary: definition.secondary } : {}),
        ...(definition.neutral ? { neutral: definition.neutral as NeutralFamily } : {}),
        contrast: definition.contrastLevel === 'AAA' ? 'AAA' : 'AA',
      },
    });
  } catch {
    return undefined;
  }
}

/**
 * Resolve a document's `extends` chain, variant and patches into one
 * document. `texuli:<id>` loads the library theme (a lazy chunk, never the
 * network) when `options.resolve` returns nothing for it; `id@x.y.z` goes to
 * `options.resolve`, which may return a promise. Resolves to a result, never
 * rejects for a bad document. `resolveDesignSystemCore` is the same without
 * the library default.
 */
export async function resolveDesignSystem(
  input: unknown,
  options: ResolveDesignSystemCoreOptions = {}
): Promise<ResolvedDesignSystem | DesignSystemFailure> {
  return resolveDesignSystemCore(input, {
    ...options,
    loadLibraryBase: options.loadLibraryBase ?? loadLibraryBase,
  });
}
