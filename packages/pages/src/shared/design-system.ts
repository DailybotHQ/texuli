/**
 * The reader's design-system step (spec 0.10.0, ADR-024): `PageReader`
 * imports it with `import()` only when the document names a design system,
 * so a document without one never loads it, the compiler or the runtime.
 * It resolves a `ref` through the host (never a fetch; a `texuli:<theme>`
 * reference or base the host leaves `undefined` goes to `loadLibraryBase`,
 * and is refused without one), validates and compiles the document
 * (`@texuli/tokens/design-system/compile-core`, which runs the spec's
 * validator at `trust`) and never throws: a failure is a refusal with a
 * stable code. It never references the theme library itself (G127): the
 * default entries pass `loadPagesLibraryBase`, the core entries only the
 * host's loader.
 */
import type { DocumentDesignSystem } from '@texuli/document/model';
import type { ApplicableDesignSystem } from '@texuli/tokens/design-system/apply';
import { applyDesignSystem } from '@texuli/tokens/design-system/apply';
import type {
  PagesDesignSystemEvent,
  PagesDesignSystems,
  PagesLibraryBaseLoader,
} from './design-system-types.ts';

export type PagesDesignSystemResult =
  | { ok: true; compiled: ApplicableDesignSystem; source: 'ref' | 'inline' }
  | { ok: false; code: string; path: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const refused = (code: string, path: string, message: string): PagesDesignSystemResult => ({
  ok: false,
  code,
  path,
  message,
});

/** Resolve and compile a document's design system for the reader. */
export async function resolvePagesDesignSystem(
  reference: Readonly<DocumentDesignSystem>,
  host: PagesDesignSystems | null | undefined,
  trust: 'developer' | 'untrusted',
  loadLibraryBase?: PagesLibraryBaseLoader | null
): Promise<PagesDesignSystemResult> {
  try {
    const ref = reference.ref;
    const resolve = host?.resolve;
    let document: unknown = ref === undefined ? reference.inline : await resolve?.(ref);
    if (ref !== undefined && isRecord(document) && isRecord(document.vars)) {
      return { ok: true, compiled: document as unknown as ApplicableDesignSystem, source: 'ref' };
    }
    const compiler = await import('@texuli/tokens/design-system/compile-core');
    if (document === undefined && ref?.startsWith('texuli:')) {
      if (!loadLibraryBase)
        return refused(
          'design-system-unresolved',
          '$.designSystem.ref',
          'No theme library loader resolves it.'
        );
      document = (await loadLibraryBase(ref)) ?? undefined;
    }
    if (document === undefined)
      return refused('design-system-unresolved', '$.designSystem.ref', 'Nothing resolves it.');
    if (
      ref !== undefined &&
      !ref.startsWith('texuli:') &&
      isRecord(document) &&
      `${document.id}@${document.version}` !== ref
    )
      return refused('design-system-refused', '$.designSystem.ref', 'Another document resolved.');
    // A host-resolved document is the host's (developer); an inline one, the document's tier.
    const level = ref === undefined ? trust : 'developer';
    const resolved = await compiler.resolveDesignSystemCore(document, {
      trust: level,
      resolve,
      loadLibraryBase,
    });
    const compiled = resolved.ok
      ? compiler.compileDesignSystem(resolved.document, { trust: level })
      : resolved;
    if (!compiled.ok) {
      const issue = compiled.errors[0];
      const at =
        ref === undefined
          ? `$.designSystem.inline${issue?.path.slice(1) ?? ''}`
          : '$.designSystem.ref';
      return refused(issue?.code ?? 'design-system-refused', at, issue?.message ?? 'Refused.');
    }
    return { ok: true, compiled, source: ref === undefined ? 'inline' : 'ref' };
  } catch (error) {
    return refused(
      'design-system-refused',
      '$.designSystem',
      error instanceof Error ? error.message.slice(0, 200) : 'Refused.'
    );
  }
}

/**
 * Resolve, compile and apply in one call (what `PageReader` runs): returns
 * the event to report and the dispose of what was applied (none on a
 * refusal). Never rejects.
 */
export async function applyPagesDesignSystem(
  target: HTMLElement,
  reference: Readonly<DocumentDesignSystem>,
  host: PagesDesignSystems | null | undefined,
  loadLibraryBase?: PagesLibraryBaseLoader | null
): Promise<{ event: PagesDesignSystemEvent; dispose?: () => void }> {
  const trust = host?.trust ?? 'untrusted';
  const result = await resolvePagesDesignSystem(reference, host, trust, loadLibraryBase);
  if (!result.ok) return { event: { status: 'refused', ...result } };
  const dispose = applyDesignSystem(target, result.compiled, {
    mode: host?.mode ?? 'light',
    // Fonts load only for host-resolved documents, or at the developer level.
    fonts: result.source === 'ref' || trust === 'developer',
  });
  return { event: { status: 'applied', id: result.compiled.id, source: result.source }, dispose };
}
