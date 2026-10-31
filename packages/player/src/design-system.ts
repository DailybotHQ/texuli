/**
 * The player's design-system step (spec 0.10.0, ADR-024). `Player.svelte`
 * imports this module with `import()` only when a validated envelope carries
 * a `designSystem`, so a blueprint without one never loads it, the compiler
 * or the runtime (`tests/design-system.test.ts` walks the static graph).
 *
 * It resolves the reference through the host (never a fetch), validates and
 * compiles the document with `@texuli/tokens/design-system/compile` (loaded
 * through `texuli/design-system`, a lazy chunk) and returns what
 * `applyDesignSystem` writes on the player's root. It never throws: every
 * failure is a refusal with a stable code, and the player keeps the default
 * theme and shows a notice.
 *
 * Also the `@texuli/player/design-system` subpath, so other stages resolve a
 * `designSystem` the same way; import it lazily to keep the 0 B cost. It is
 * `@texuli/player/design-system-core` (G127) with the theme library as the
 * default `texuli:<theme>` loader (`loadPlayerLibraryBase`); a stage that
 * must not reference the library uses the core and injects its own loader.
 */
import type { BlueprintDesignSystemReference } from '@texuli/spec';
import { loadDesignSystemCompiler } from 'texuli/design-system';
import {
  applyPlayerDesignSystemCore,
  type PlayerDesignSystemCoreOptions,
  type PlayerDesignSystemResult,
  resolvePlayerDesignSystemCore,
} from './design-system-core.ts';
import type { PlayerDesignSystems } from './design-system-types.ts';

export {
  type PlayerDesignSystemCoreOptions,
  type PlayerDesignSystemLibraryLoader,
  type PlayerDesignSystemResult,
  playerDesignDefaults,
} from './design-system-core.ts';
export type {
  PlayerDesignSystemEvent,
  PlayerDesignSystemSource,
  PlayerDesignSystems,
} from './design-system-types.ts';

/** The default `texuli:<theme>` loader: the token theme library, imported on first use. */
export async function loadPlayerLibraryBase(ref: string): Promise<unknown> {
  const compiler = await loadDesignSystemCompiler();
  return compiler.loadLibraryBase(ref);
}

/** `options.loadLibraryBase`, or the library's when none is given. */
const withLibrary = (options: PlayerDesignSystemCoreOptions): PlayerDesignSystemCoreOptions => ({
  loadLibraryBase:
    options.loadLibraryBase === undefined ? loadPlayerLibraryBase : options.loadLibraryBase,
});

/**
 * Resolve, validate and compile the envelope's design system. `trust` is
 * the player's tier for an inline document (agent output), and `developer`
 * for a document the host's resolver returns. `texuli:<theme>` falls back to
 * the theme library unless `options.loadLibraryBase` replaces it (`null`
 * turns the fallback off).
 */
export function resolvePlayerDesignSystem(
  reference: Readonly<BlueprintDesignSystemReference>,
  host: PlayerDesignSystems | null | undefined,
  tier: 'developer' | 'untrusted',
  options: PlayerDesignSystemCoreOptions = {}
): Promise<PlayerDesignSystemResult> {
  return resolvePlayerDesignSystemCore(reference, host, tier, withLibrary(options));
}

/**
 * Resolve, compile and apply in one call (what `Player.svelte` runs): the
 * event to report and the dispose of what was applied (none on a refusal).
 * Fonts register only for host-resolved documents or at the developer tier.
 * Never rejects.
 */
export function applyPlayerDesignSystem(
  root: HTMLElement,
  reference: Readonly<BlueprintDesignSystemReference>,
  host: PlayerDesignSystems | null | undefined,
  tier: 'developer' | 'untrusted',
  options: PlayerDesignSystemCoreOptions = {}
): ReturnType<typeof applyPlayerDesignSystemCore> {
  return applyPlayerDesignSystemCore(root, reference, host, tier, withLibrary(options));
}
