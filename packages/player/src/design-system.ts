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
 * The compiled component defaults (`compiled.defaults`) come back filtered by
 * the closed vocabulary (`validateDesignDefaults` from `texuli/defaults`, in
 * this lazy chunk too); `Player.svelte` provides them to the painted
 * components through the `texuli/defaults` context, below blueprint props.
 */
import type { BlueprintDesignSystemReference } from '@texuli/spec';
import { validateDesignDefaults } from 'texuli/defaults';
import {
  type ApplicableDesignSystem,
  applyDesignSystem,
  loadDesignSystemCompiler,
} from 'texuli/design-system';
import type { PlayerDesignSystemEvent, PlayerDesignSystems } from './design-system-types.ts';

export type PlayerDesignSystemResult =
  | { ok: true; compiled: ApplicableDesignSystem; source: 'ref' | 'inline' }
  | {
      ok: false;
      /** `design-system-unresolved`, `design-system-refused` or a design-system code. */
      code: string;
      path: string;
      message: string;
    };

const refused = (code: string, path: string, message: string): PlayerDesignSystemResult => ({
  ok: false,
  code,
  path,
  message,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A host may hand back a compiled design system (a cached JSON copy works). */
function isCompiled(value: Record<string, unknown>): boolean {
  return isRecord(value.vars) && isRecord(value.attrs) && typeof value.id === 'string';
}

/**
 * Resolve, validate and compile the envelope's design system. `trust` is
 * the player's tier for an inline document (agent output), and `developer`
 * for a document the host's resolver returns.
 */
export async function resolvePlayerDesignSystem(
  reference: Readonly<BlueprintDesignSystemReference>,
  host: PlayerDesignSystems | null | undefined,
  tier: 'developer' | 'untrusted'
): Promise<PlayerDesignSystemResult> {
  try {
    let document: unknown;
    let trust = tier;
    const ref = reference.ref;
    const resolve = host?.resolve;
    if (typeof ref === 'string') {
      document = await resolve?.(ref);
      if (document === undefined && !ref.startsWith('texuli:'))
        return refused(
          'design-system-unresolved',
          '$.designSystem.ref',
          `The host resolves no design system for "${ref.slice(0, 80)}".`
        );
      if (isRecord(document) && isCompiled(document)) {
        return { ok: true, compiled: document as unknown as ApplicableDesignSystem, source: 'ref' };
      }
      trust = 'developer';
    } else {
      document = reference.inline;
    }
    const compiler = await loadDesignSystemCompiler();
    if (document === undefined && typeof ref === 'string') {
      document = await compiler.loadLibraryBase(ref);
      if (document === undefined)
        return refused(
          'design-system-unresolved',
          '$.designSystem.ref',
          `The theme library has no "${ref.slice(7, 71)}".`
        );
    }
    if (
      typeof ref === 'string' &&
      !ref.startsWith('texuli:') &&
      isRecord(document) &&
      `${document.id}@${document.version}` !== ref
    )
      return refused(
        'design-system-refused',
        '$.designSystem.ref',
        `The resolved document is not "${ref.slice(0, 80)}".`
      );
    const base = ref ?? '$.designSystem.inline';
    const resolved = await compiler.resolveDesignSystem(document, { trust, resolve });
    const compiled = resolved.ok
      ? compiler.compileDesignSystem(resolved.document, { trust })
      : resolved;
    if (!compiled.ok) {
      const issue = compiled.errors[0];
      return refused(
        issue?.code ?? 'design-system-refused',
        ref ? base : `${base}${issue?.path.slice(1) ?? ''}`,
        issue?.message ?? 'The design system was refused.'
      );
    }
    return { ok: true, compiled, source: ref ? 'ref' : 'inline' };
  } catch (error) {
    return refused(
      'design-system-refused',
      '$.designSystem',
      error instanceof Error ? error.message.slice(0, 200) : 'The design system was refused.'
    );
  }
}

/**
 * Resolve, compile and apply in one call (what `Player.svelte` runs): the
 * event to report and the dispose of what was applied (none on a refusal).
 * Fonts register only for host-resolved documents or at the developer tier.
 * Never rejects.
 */
export async function applyPlayerDesignSystem(
  root: HTMLElement,
  reference: Readonly<BlueprintDesignSystemReference>,
  host: PlayerDesignSystems | null | undefined,
  tier: 'developer' | 'untrusted'
): Promise<{
  event: PlayerDesignSystemEvent;
  dispose?: () => void;
  defaults?: Record<string, Record<string, string>>;
}> {
  const result = await resolvePlayerDesignSystem(reference, host, tier);
  if (!result.ok) return { event: { status: 'refused', ...result } };
  const dispose = applyDesignSystem(root, result.compiled, {
    mode: host?.mode ?? 'light',
    fonts: result.source === 'ref' || tier === 'developer',
  });
  return {
    event: { status: 'applied', id: result.compiled.id, source: result.source },
    dispose,
    defaults: playerDesignDefaults(result.compiled),
  };
}

/**
 * The compiled defaults the painted components read, keeping only the
 * closed vocabulary (a cached compiled copy from a host is not trusted to be
 * clean). `undefined` when the design system sets none.
 */
export function playerDesignDefaults(
  compiled: Readonly<ApplicableDesignSystem>
): Record<string, Record<string, string>> | undefined {
  const { defaults } = validateDesignDefaults(compiled.defaults ?? {});
  return Object.keys(defaults).length > 0
    ? (defaults as Record<string, Record<string, string>>)
    : undefined;
}
