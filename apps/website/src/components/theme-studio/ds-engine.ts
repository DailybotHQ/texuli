/**
 * The studio's engine (PLAN_011 T-ds-studio), loaded lazily by the island
 * the first time the visitor interacts with the studio (or opens a shared
 * link): the design-system compiler, the diff and the validator. Importers,
 * emitters, the report and the email renderer are further dynamic imports,
 * loaded only when a file is imported or an export is asked for. Everything
 * runs in this page; nothing is fetched except this site's own chunks (and,
 * for a legacy `#theme=` link that names a library theme, that theme's
 * `/theme-data/<id>.json`).
 *
 * Every document is treated as `untrusted` (a visitor's file, a link or a
 * pasted JSON): data URLs are refused, as for agent output.
 */

import {
  type CompiledDesignSystem,
  compileDesignSystem,
  fromTheme,
  resolveDesignSystem,
} from '@texuli/tokens/design-system/compile';
import { diffDesignSystems } from '@texuli/tokens/design-system/diff';
import {
  detectImportKind,
  type ExportFormat,
  type ImportKind,
  MAX_IMPORT_BYTES,
  STUDIO_DOCUMENT_ID,
  type StudioDocument,
  type StudioIssue,
  toStudioIssue,
} from './ds-studio.ts';

export type { CompiledDesignSystem };

const TRUST = 'untrusted' as const;

export type CompileOutcome =
  | { ok: true; compiled: CompiledDesignSystem }
  | { ok: false; issues: StudioIssue[] };

/**
 * Resolve `extends` (library themes load as lazy chunks) and compile for
 * light and dark, optionally under a variant. Never throws.
 */
export async function compileStudio(doc: unknown, variant?: string): Promise<CompileOutcome> {
  try {
    const resolved = await resolveDesignSystem(doc, { trust: TRUST });
    if (!resolved.ok) return { ok: false, issues: resolved.errors.map(toStudioIssue) };
    const compiled = compileDesignSystem(resolved.document, {
      trust: TRUST,
      ...(variant ? { variant } : {}),
    });
    if (!compiled.ok) return { ok: false, issues: compiled.errors.map(toStudioIssue) };
    return { ok: true, compiled };
  } catch (cause) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid-input',
          path: '$',
          message: cause instanceof Error ? cause.message : 'The document could not be compiled.',
        },
      ],
    };
  }
}

export type StudioDiff = ReturnType<typeof diffDesignSystems>;

/** The diff from the starting point (`base`) to the current design system. */
export function diffStudio(base: unknown, current: unknown): StudioDiff {
  return diffDesignSystems(base as CompiledDesignSystem, current as CompiledDesignSystem);
}

export type ImportOutcome =
  | { ok: true; document: StudioDocument; warnings: StudioIssue[]; kind: ImportKind }
  | { ok: false; issues: StudioIssue[]; kind?: ImportKind };

const tooLarge = (): ImportOutcome => ({
  ok: false,
  issues: [{ code: 'input-limit', path: '$', message: 'The file is over 1 MiB.' }],
});

/**
 * Import a JSON file the visitor picked: a design-system document, a DTCG
 * file, a Tokens Studio file or a flat role palette (detected from its
 * shape). The importers never throw and return a validated document.
 */
export async function importText(text: string): Promise<ImportOutcome> {
  if (text.length > MAX_IMPORT_BYTES) return tooLarge();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      ok: false,
      issues: [{ code: 'invalid-input', path: '$', message: 'The file is not JSON.' }],
    };
  }
  const kind = detectImportKind(value);
  if (kind === 'design-system') {
    // Opened as is: compiling it validates it at the untrusted tier.
    return { ok: true, document: value as StudioDocument, warnings: [], kind };
  }
  const { importDtcg, importRolePalette, importTokensStudio } = await import(
    '@texuli/tokens/design-system/import'
  );
  const options = { trust: TRUST, maxBytes: MAX_IMPORT_BYTES };
  const result =
    kind === 'tokens-studio'
      ? importTokensStudio(value, options)
      : kind === 'role-palette'
        ? importRolePalette(value, options)
        : importDtcg(value, options);
  const warnings = (result.warnings ?? []).map(toStudioIssue);
  if (!result.ok) return { ok: false, issues: result.errors.map(toStudioIssue), kind };
  return { ok: true, document: result.document as unknown as StudioDocument, warnings, kind };
}

export type LogoOutcome =
  | { ok: true; document: StudioDocument; palette: string[]; warnings: StudioIssue[] }
  | { ok: false; issues: StudioIssue[] };

/** A document from logo pixels (read locally from a canvas). */
export async function importLogo(data: Uint8ClampedArray): Promise<LogoOutcome> {
  const { importLogoPixels } = await import('@texuli/tokens/design-system/import');
  const result = importLogoPixels(
    { data },
    { trust: TRUST, id: STUDIO_DOCUMENT_ID, name: 'Logo palette' }
  );
  if (!result.ok) return { ok: false, issues: result.errors.map(toStudioIssue) };
  return {
    ok: true,
    document: result.document as unknown as StudioDocument,
    palette: result.palette.map((entry) => entry.color),
    warnings: result.warnings.map(toStudioIssue),
  };
}

/** A document from a brand one-liner (`brand #4f46e5, font Inter, rounded`). */
export async function importBrandLine(text: string): Promise<ImportOutcome> {
  const { importBrand } = await import('@texuli/tokens/design-system/import');
  const result = importBrand(text, { trust: TRUST, id: STUDIO_DOCUMENT_ID });
  const warnings = (result.warnings ?? []).map(toStudioIssue);
  if (!result.ok) return { ok: false, issues: result.errors.map(toStudioIssue) };
  return {
    ok: true,
    document: result.document as unknown as StudioDocument,
    warnings,
    kind: 'design-system',
  };
}

const asDocument = (theme: Parameters<typeof fromTheme>[0], name: string): StudioDocument => {
  const doc = fromTheme(theme, {
    id: STUDIO_DOCUMENT_ID,
    version: '1.0.0',
  }) as unknown as StudioDocument;
  return { ...doc, name };
};

/** A document from mood words, through the theme generator (as the theme studio did). */
export async function documentFromMood(words: string): Promise<ImportOutcome> {
  const trimmed = words.trim().slice(0, 120);
  if (!trimmed) {
    return {
      ok: false,
      issues: [{ code: 'required', path: '$', message: 'Enter one or more mood words.' }],
    };
  }
  // A destructured import keeps tree-shaking: a namespace import of the
  // tokens root would keep every root export alive in the chunks the site
  // shell shares with it.
  const { generateThemeFromMood } = await import('@texuli/tokens/generator');
  try {
    const theme = generateThemeFromMood(trimmed, { id: STUDIO_DOCUMENT_ID, name: 'Mood' });
    return {
      ok: true,
      document: asDocument(theme, `Mood: ${trimmed}`.slice(0, 80)),
      warnings: [],
      kind: 'design-system',
    };
  } catch (cause) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid-input',
          path: '$',
          message: cause instanceof Error ? cause.message : 'No theme for those words.',
        },
      ],
    };
  }
}

/**
 * A legacy theme-studio link (`#theme=…`): the recipe or library theme is
 * rebuilt with the old helpers, then carried into a document by `fromTheme`.
 */
export async function documentFromLegacyHash(hash: string): Promise<ImportOutcome> {
  const { decodeStudioShare, themeFromShare } = await import('./studio.ts');
  const decoded = decodeStudioShare(hash);
  if (!decoded.ok) {
    return { ok: false, issues: [{ code: 'share-format', path: '$', message: decoded.message }] };
  }
  const { loadThemeData } = await import('../perf/theme-assets.ts');
  const opened = await themeFromShare(decoded.share, (id) => loadThemeData<unknown>(id));
  if (!opened.ok) {
    return { ok: false, issues: [{ code: 'share-format', path: '$', message: opened.message }] };
  }
  return {
    ok: true,
    document: asDocument(opened.theme, 'Theme studio link'),
    warnings: [],
    kind: 'design-system',
  };
}

/** The text of one export format. `null` when the format cannot be built. */
export async function buildExport(
  format: ExportFormat,
  doc: StudioDocument,
  compiled: CompiledDesignSystem
): Promise<string | null> {
  switch (format) {
    case 'document':
      return `${JSON.stringify(doc, null, 2)}\n`;
    case 'report': {
      const { emitReportHtml } = await import('@texuli/tokens/design-system/report');
      return emitReportHtml(compiled, { title: `${compiled.name} design system` });
    }
    case 'email': {
      const [{ renderEmail }, { EMAIL_OPTIONS, WEEKLY_DIGEST }] = await Promise.all([
        import('@texuli/tools/email'),
        import('../output-site/drafts.ts'),
      ]);
      const result = renderEmail(WEEKLY_DIGEST, {
        ...EMAIL_OPTIONS,
        designSystem: compiled,
      });
      return result.ok ? result.html : null;
    }
    default: {
      const { emitCompiledJson, emitCss, emitDtcgJson, emitTailwindPresetJson, emitTokensStudio } =
        await import('@texuli/tokens/design-system/emit');
      if (format === 'compiled') return emitCompiledJson(compiled);
      if (format === 'css') return emitCss(compiled);
      if (format === 'tailwind') return emitTailwindPresetJson(compiled);
      if (format === 'dtcg') return emitDtcgJson(doc as never);
      if (format === 'tokens-studio') {
        return `${JSON.stringify(emitTokensStudio(doc as never), null, 2)}\n`;
      }
      return null;
    }
  }
}
