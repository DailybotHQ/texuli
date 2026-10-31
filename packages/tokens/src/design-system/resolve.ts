/**
 * Design-system resolution (ADR-021): the `extends` chain (a library theme
 * `texuli:<id>` or an exact `id@x.y.z` from a caller resolver; never a
 * fetch), then the named variant, then the patches, each merged with the
 * spec's `applyDesignSystemPatch` (objects merge, arrays replace, `null`
 * removes), so precedence is override > variant > extends. Refusals are
 * results with stable codes and JSON paths, never exceptions.
 */

import {
  applyDesignSystemPatch,
  DESIGN_SYSTEM_LIMITS,
  type DesignSystem,
  type DesignSystemIssue,
  type DesignSystemPatch,
  migrateDesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from '@texuli/spec/design-system';
import type { Theme } from '../contract/types.ts';
import type { NeutralFamily } from '../generator/seed.ts';
import { fromTheme } from './from-theme.ts';
import type { DesignSystemPairResult } from './guarantees.ts';
import { canonicalJson, sha256Hex } from './hash.ts';

/** A refusal: a spec issue, plus the base it came from and the failing pairs. */
export interface DesignSystemCompileIssue extends DesignSystemIssue {
  /** Where it was found when not in the document itself: an `extends` ref, `variant:<name>` or `patch:<i>`. */
  source?: string;
  /** The failing contrast pairs (`aa-text`, `aa-focus`). */
  pairs?: DesignSystemPairResult[];
  /** The mode of a guarantee failure. */
  mode?: 'light' | 'dark';
}

export interface DesignSystemFailure {
  ok: false;
  errors: DesignSystemCompileIssue[];
}

/**
 * Returns the base for a reference: a design-system document for `id@x.y.z`;
 * for `texuli:<id>`, a `Theme` or a document. `undefined` when unknown.
 */
export type DesignSystemResolver = (ref: string) => unknown;

export interface ResolveDesignSystemOptions {
  resolve?: DesignSystemResolver;
  /** A key of `variants`, applied over the resolved chain. */
  variant?: string;
  /** Overrides, applied in order after the variant. */
  patches?: readonly DesignSystemPatch[];
  /** `untrusted` (default) refuses every `data:` URL; `developer` accepts capped ones. */
  trust?: 'developer' | 'untrusted';
}

export interface ResolvedDesignSystem {
  ok: true;
  /** The merged document: no `extends`; `variants` kept. */
  document: DesignSystem;
  /** The references followed, nearest first. */
  chain: string[];
  variant?: string;
  /** SHA-256 of the canonical JSON of the document and the variant name. */
  hash: string;
}

const SECTIONS = [
  'color',
  'typography',
  'shape',
  'space',
  'elevation',
  'surface',
  'motion',
  'layout',
  'icons',
  'components',
  'assets',
  'voice',
  'accessibility',
  'variants',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is Theme =>
  isRecord(value) && isRecord(value.light) && isRecord(value.dark) && isRecord(value.style);

const fail = (errors: DesignSystemCompileIssue[]): DesignSystemFailure => ({ ok: false, errors });

/** Migrate and validate one document; `source` tags its issues. */
function check(
  doc: unknown,
  trust: ResolveDesignSystemOptions['trust'],
  source?: string
): { doc: Record<string, unknown> } | DesignSystemFailure {
  const migrated = migrateDesignSystem(doc);
  const tag = (issues: readonly DesignSystemIssue[]) =>
    issues.map((issue) => (source ? { ...issue, source } : { ...issue }));
  if (!migrated.ok) return fail(tag(migrated.errors));
  const result = validateDesignSystem(migrated.document, { trust: trust ?? 'untrusted' });
  if (!result.ok) return fail(tag(result.errors));
  return { doc: migrated.document as unknown as Record<string, unknown> };
}

/**
 * {@link resolveDesignSystem} with a synchronous resolver: what
 * `compileDesignSystem` runs. A `texuli:<id>` base must come from `resolve`
 * (a `Theme` or a document); the asynchronous form loads it from the library.
 */
export function resolveDesignSystemSync(
  input: unknown,
  options: ResolveDesignSystemOptions = {}
): ResolvedDesignSystem | DesignSystemFailure {
  const top = check(input, options.trust);
  if ('ok' in top) return top;
  const docs = [top.doc];
  const chain: string[] = [];
  const seen = new Set([`${top.doc.id}@${top.doc.version}`]);
  for (let current = top.doc; typeof current.extends === 'string'; ) {
    const ref = current.extends;
    const path = '$.extends';
    const source = chain.at(-1);
    const where = source ? { source } : {};
    if (seen.has(ref))
      return fail([
        { code: 'extends-cycle', path, message: `The extends chain returns to ${ref}.`, ...where },
      ]);
    if (chain.length >= DESIGN_SYSTEM_LIMITS.extendsDepth)
      return fail([
        {
          code: 'extends-depth',
          path,
          message: `The extends chain is deeper than ${DESIGN_SYSTEM_LIMITS.extendsDepth}.`,
          ...where,
        },
      ]);
    seen.add(ref);
    chain.push(ref);
    let base = options.resolve?.(ref);
    if (isTheme(base)) base = fromTheme(base);
    if (base === undefined || base === null)
      return fail([
        {
          code: 'invalid-value',
          path,
          message: `Nothing resolves ${ref}.`,
          hint: ref.startsWith('texuli:')
            ? 'Use resolveDesignSystem (it loads library themes), or return the Theme from resolve.'
            : 'Pass a resolve function that returns the document for this exact id@version.',
          ...where,
        },
      ]);
    const checked = check(base, options.trust, ref);
    if ('ok' in checked) return checked;
    if (!ref.startsWith('texuli:') && `${checked.doc.id}@${checked.doc.version}` !== ref)
      return fail([
        {
          code: 'invalid-value',
          path,
          message: `${ref} resolved to ${checked.doc.id}@${checked.doc.version}.`,
          source: ref,
        },
      ]);
    docs.push(checked.doc);
    current = checked.doc;
  }

  let merged: Record<string, unknown> = {};
  for (const doc of docs.reverse()) {
    const sections: Record<string, unknown> = {};
    for (const key of SECTIONS) if (doc[key] !== undefined) sections[key] = doc[key];
    merged = applyDesignSystemPatch(
      merged as unknown as DesignSystem,
      sections as DesignSystemPatch
    ) as unknown as Record<string, unknown>;
  }
  const identity: Record<string, unknown> = {};
  for (const key of ['format', 'formatVersion', 'id', 'version', 'name'])
    identity[key] = top.doc[key];
  for (const key of ['description', 'owner', 'license', 'tags'])
    if (top.doc[key] !== undefined) identity[key] = top.doc[key];
  let document = { ...identity, ...merged } as unknown as DesignSystem;

  const variant = options.variant;
  if (variant !== undefined) {
    const variants = (document as unknown as { variants?: Record<string, unknown> }).variants;
    const chosen = variants && Object.hasOwn(variants, variant) ? variants[variant] : undefined;
    if (!isRecord(chosen))
      return fail([
        {
          code: 'invalid-value',
          path: `$.variants[${JSON.stringify(variant)}]`,
          message: `No variant named ${JSON.stringify(variant)}.`,
          hint: `Known: ${Object.keys(variants ?? {}).join(', ') || 'none'}`,
        },
      ]);
    document = applyDesignSystemPatch(document, chosen as DesignSystemPatch);
  }
  for (const [index, patch] of (options.patches ?? []).entries()) {
    const result = validateDesignSystemPatch(patch, { trust: options.trust ?? 'untrusted' });
    if (!result.ok)
      return fail(result.errors.map((issue) => ({ ...issue, source: `patch:${index}` })));
    document = applyDesignSystemPatch(document, patch);
  }
  if (variant !== undefined || options.patches?.length) {
    const result = validateDesignSystem(document, { trust: options.trust ?? 'untrusted' });
    if (!result.ok)
      return fail(
        result.errors.map((issue) => ({
          ...issue,
          source: options.patches?.length ? 'patches' : `variant:${variant}`,
        }))
      );
  }
  return {
    ok: true,
    document,
    chain,
    ...(variant !== undefined ? { variant } : {}),
    hash: sha256Hex(canonicalJson({ document, variant: variant ?? null })),
  };
}

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
 * network); `id@x.y.z` goes to `options.resolve`, which may return a
 * promise. Resolves to a result, never rejects for a bad document.
 */
export async function resolveDesignSystem(
  input: unknown,
  options: Omit<ResolveDesignSystemOptions, 'resolve'> & {
    resolve?: (ref: string) => unknown | Promise<unknown>;
  } = {}
): Promise<ResolvedDesignSystem | DesignSystemFailure> {
  const bases = new Map<string, unknown>();
  let next = isRecord(input) ? input.extends : undefined;
  for (let hop = 0; typeof next === 'string' && !bases.has(next); hop++) {
    if (hop > DESIGN_SYSTEM_LIMITS.extendsDepth) break;
    const ref = next;
    let base: unknown;
    try {
      base = ref.startsWith('texuli:')
        ? ((await options.resolve?.(ref)) ?? (await loadLibraryBase(ref)))
        : await options.resolve?.(ref);
    } catch {
      base = undefined;
    }
    bases.set(ref, base);
    next = isRecord(base) ? base.extends : undefined;
  }
  return resolveDesignSystemSync(input, { ...options, resolve: (ref) => bases.get(ref) });
}
