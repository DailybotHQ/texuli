/**
 * The work behind the `ds.*` operations and `blueprint.theme` (T-ds-agent-tools):
 * validate, compile and emit, contrast, suggest, import, diff, preview and
 * save, over `@texuli/tokens/design-system/*` and the `texuli ds check`
 * static check. The operations load this module lazily, so a door that
 * never runs a design-system operation never loads the compiler, the
 * importers or the emitters (the remote Function's initial bundle stays
 * the same). Pure and deterministic: no time, no randomness, no network;
 * only `ds.save` writes, through the door's local writer.
 */
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  loadLibraryBase,
} from '@texuli/tokens/design-system/compile';
import { diffDesignSystems } from '@texuli/tokens/design-system/diff';
import {
  emitCompiledJson,
  emitCss,
  emitDtcgJson,
  emitTailwindPresetJson,
  emitTokensStudio,
} from '@texuli/tokens/design-system/emit';
import {
  type DesignSystemImportOptions,
  type DesignSystemImportResult,
  importBrand,
  importDtcg,
  importLogoPixels,
  importRolePalette,
  importTheme,
  importTokensStudio,
} from '@texuli/tokens/design-system/import';
import { emitReportHtml } from '@texuli/tokens/design-system/report';
import {
  checkDesignSystemReference,
  type DesignSystem,
} from '@texuli/tokens/design-system/validate';
import { getFullThemeMeta, loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { checkDesignSystem, loadDesignSystemBases, toIssue } from '../ds-check/static.ts';
import type { DsCheckIssue, DsCheckMode } from '../ds-check/types.ts';
import { DESIGN_SYSTEM_EXAMPLES } from './design-system-examples.ts';
import { previewSvg } from './design-system-preview.ts';
import { PREVIEW_TOKENS } from './themes.ts';
import type { LocalFiles } from './types.ts';

export { checkDesignSystemReference };

type Input = Record<string, unknown>;
type Trust = 'developer' | 'untrusted';

/** The output formats of `ds.compile`. */
export const DS_COMPILE_FORMATS = ['json', 'css', 'tailwind', 'dtcg', 'tokens-studio'] as const;
export type DsCompileFormat = (typeof DS_COMPILE_FORMATS)[number];
/** The sources `ds.import` reads. */
export const DS_IMPORT_SOURCES = [
  'brand',
  'dtcg',
  'tokens-studio',
  'role-palette',
  'theme',
] as const;
export type DsImportSource = (typeof DS_IMPORT_SOURCES)[number];

const MEDIA_TYPES: Record<DsCompileFormat | 'html' | 'svg', string> = {
  json: 'application/json',
  css: 'text/css',
  tailwind: 'application/json',
  dtcg: 'application/json',
  'tokens-studio': 'application/json',
  html: 'text/html',
  svg: 'image/svg+xml',
};

const trustOf = (input: Input): Trust => (input.trust === 'developer' ? 'developer' : 'untrusted');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;

/** The bases an input passes for `extends: "id@x.y.z"` (`texuli:<id>` loads from the library). */
const basesOf = (input: Input): Record<string, unknown> =>
  isRecord(input.bases) ? (input.bases as Record<string, unknown>) : {};

/** The modes an input asks for, or every mode the document compiles. */
const modesOf = (input: Input): DsCheckMode[] | undefined =>
  input.mode === 'light' || input.mode === 'dark' ? [input.mode] : undefined;

type Compiled =
  | { ok: true; compiled: CompiledDesignSystem }
  | { ok: false; errors: DsCheckIssue[] };

/** Resolve `extends`, then compile one document (one variant), with the guarantees enforced. */
export async function compileOne(document: unknown, input: Input): Promise<Compiled> {
  const loaded = await loadDesignSystemBases(document, basesOf(input));
  const variant = typeof input.variant === 'string' ? input.variant : undefined;
  const modes = modesOf(input);
  const result = compileDesignSystem(document, {
    resolve: (ref: string) => loaded.get(ref),
    trust: trustOf(input),
    ...(variant ? { variant } : {}),
    ...(modes ? { modes } : {}),
  });
  if (!result.ok)
    return { ok: false, errors: result.errors.map((issue) => toIssue(issue, variant ?? null)) };
  return { ok: true, compiled: result };
}

/** The identity fields of a compiled design system. */
const identity = (compiled: CompiledDesignSystem) => ({
  id: compiled.id,
  version: compiled.version,
  name: compiled.name,
  hash: compiled.hash,
});

// ─── ds.validate ───────────────────────────────────────────────────────────

export async function runValidate(input: Input) {
  const variant = typeof input.variant === 'string' ? input.variant : undefined;
  const report = await checkDesignSystem(input.document, {
    trust: trustOf(input),
    bases: basesOf(input),
    ...(variant ? { variants: [variant] } : {}),
  });
  const base = report.runs[0];
  return {
    valid: report.ok,
    ...report.document,
    ...(base?.hash ? { hash: base.hash } : {}),
    codes: report.codes,
    errors: report.errors,
    warnings: base?.warnings ?? [],
    variants: report.runs.flatMap((run) => (run.variant ? [run.variant] : [])),
  };
}

// ─── ds.compile ────────────────────────────────────────────────────────────

/** The text of one format; `dtcg` and `tokens-studio` carry the document itself. */
function emitFormat(format: DsCompileFormat, compiled: CompiledDesignSystem, input: Input): string {
  switch (format) {
    case 'css':
      return emitCss(compiled, {
        ...(typeof input.selector === 'string' ? { selector: input.selector } : {}),
        ...(input.dark === 'attribute' || input.dark === 'media' || input.dark === 'class'
          ? { dark: input.dark }
          : {}),
      });
    case 'tailwind':
      return emitTailwindPresetJson(compiled);
    case 'dtcg':
      return emitDtcgJson(input.document as DesignSystem);
    case 'tokens-studio':
      return `${JSON.stringify(emitTokensStudio(input.document as DesignSystem), null, 2)}\n`;
    default:
      return emitCompiledJson(compiled);
  }
}

export async function runCompile(input: Input) {
  const format = (input.format ?? 'json') as DsCompileFormat;
  const result = await compileOne(input.document, input);
  if (!result.ok) return { valid: false, format, errors: result.errors, warnings: [] };
  const { compiled } = result;
  let content: string;
  try {
    content = emitFormat(format, compiled, input);
  } catch (error) {
    return {
      valid: false,
      format,
      errors: [
        {
          code: 'invalid-value',
          path: '$.selector',
          message: error instanceof Error ? error.message : String(error),
          hint: 'A selector is one simple selector list item: no commas, blocks or comments.',
        },
      ],
      warnings: compiled.report.warnings,
    };
  }
  return {
    valid: true,
    format,
    mediaType: MEDIA_TYPES[format],
    ...identity(compiled),
    ...(compiled.variant ? { variant: compiled.variant } : {}),
    bytes: bytesOf(content),
    content,
    errors: [],
    warnings: compiled.report.warnings,
  };
}

// ─── ds.contrast ───────────────────────────────────────────────────────────

export async function runContrast(input: Input) {
  const result = await compileOne(input.document, input);
  if (!result.ok) return { valid: false, modes: [], adjustments: [], errors: result.errors };
  const { compiled } = result;
  return {
    valid: true,
    ...identity(compiled),
    contrast: compiled.accessibility.contrast,
    targetMin: compiled.accessibility.targetMin,
    modes: compiled.modes.map((mode) => {
      const pairs = compiled.report.contrast[mode] ?? [];
      return {
        mode,
        total: pairs.length,
        failing: pairs.filter((pair) => !pair.pass).length,
        pairs,
      };
    }),
    adjustments: compiled.report.adjustments,
    errors: [],
  };
}

// ─── ds.suggest ────────────────────────────────────────────────────────────

/** The key tokens of each compiled mode, the same set `theme.preview` shows. */
function keyTokens(compiled: CompiledDesignSystem): Record<string, Record<string, string>> {
  const roles: Record<string, Record<string, string>> = {};
  for (const mode of compiled.modes) {
    const vars = (compiled.vars[mode] ?? {}) as Record<string, string>;
    const tokens: Record<string, string> = {};
    for (const name of PREVIEW_TOKENS) if (vars[name] !== undefined) tokens[name] = vars[name];
    roles[mode] = tokens;
  }
  return roles;
}

function identityOptions(input: Input): DesignSystemImportOptions {
  return {
    trust: trustOf(input),
    ...(typeof input.id === 'string' ? { id: input.id } : {}),
    ...(typeof input.version === 'string' ? { version: input.version } : {}),
    ...(typeof input.name === 'string' ? { name: input.name } : {}),
  };
}

export async function runSuggest(input: Input) {
  const sources = ['seed', 'colors', 'pixels'].filter((key) => input[key] !== undefined);
  if (sources.length !== 1)
    return {
      valid: false,
      palette: [],
      errors: [
        {
          code: 'invalid-input',
          path: '$',
          message: `Pass exactly one of seed, colors or pixels (got ${sources.length === 0 ? 'none' : sources.join(', ')}).`,
        },
      ],
      warnings: [],
    };
  const options = identityOptions(input);
  let imported: DesignSystemImportResult;
  let palette: { color: string; weight: number }[] = [];
  if (input.pixels !== undefined) {
    const pixels = input.pixels as number[];
    if (pixels.length % 4 !== 0)
      return {
        valid: false,
        palette: [],
        errors: [
          {
            code: 'invalid-input',
            path: '$.pixels',
            message: `Pixels are RGBA, 4 values each; got ${pixels.length} values.`,
          },
        ],
        warnings: [],
      };
    const result = importLogoPixels(
      { data: pixels },
      { ...options, ...(typeof input.count === 'number' ? { count: input.count } : {}) }
    );
    imported = result;
    palette = result.palette.map((color) => ({
      color: color.color,
      weight: Math.round(color.weight * 10_000) / 10_000,
    }));
  } else {
    const colors = input.seed !== undefined ? [input.seed as string] : (input.colors as string[]);
    imported = importBrand(colors.join(', '), options);
  }
  if (!imported.ok)
    return { valid: false, palette, errors: imported.errors, warnings: imported.warnings };
  const compiled = await compileOne(imported.document, input);
  if (!compiled.ok)
    return {
      valid: false,
      document: imported.document,
      palette,
      errors: compiled.errors,
      warnings: imported.warnings,
    };
  return {
    valid: true,
    document: imported.document,
    palette,
    roles: keyTokens(compiled.compiled),
    hash: compiled.compiled.hash,
    errors: [],
    warnings: imported.warnings,
  };
}

// ─── ds.import ─────────────────────────────────────────────────────────────

/** A library theme id, as `theme.search` returns it. */
const THEME_ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;

export async function runImport(input: Input) {
  const from = input.from as DsImportSource;
  const source = input.input;
  const options = identityOptions(input);
  let result: DesignSystemImportResult;
  switch (from) {
    case 'brand':
      result =
        typeof source === 'string'
          ? importBrand(source, options)
          : {
              ok: false,
              errors: [
                {
                  code: 'invalid-input',
                  path: '$.input',
                  message: 'A brand one-liner is text.',
                },
              ],
              warnings: [],
            };
      break;
    case 'dtcg':
      result = importDtcg(source, options);
      break;
    case 'tokens-studio':
      result = importTokensStudio(source, options);
      break;
    case 'role-palette':
      result = importRolePalette(source as never, options);
      break;
    default: {
      if (typeof source === 'string' && THEME_ID.test(source)) {
        if (!(await getFullThemeMeta(source)))
          return {
            valid: false,
            from,
            errors: [
              {
                code: 'not-found',
                path: '$.input',
                message: `Unknown theme "${source}". Find ids with theme.search.`,
              },
            ],
            warnings: [],
          };
        result = importTheme(await loadFullLibraryTheme(source), options);
      } else result = importTheme(source, options);
    }
  }
  if (!result.ok) return { valid: false, from, errors: result.errors, warnings: result.warnings };
  return { valid: true, from, document: result.document, errors: [], warnings: result.warnings };
}

// ─── ds.diff ───────────────────────────────────────────────────────────────

export async function runDiff(input: Input) {
  const [before, after] = await Promise.all([
    compileOne(input.before, input),
    compileOne(input.after, input),
  ]);
  const errors = [
    ...(before.ok ? [] : before.errors.map((issue) => ({ ...issue, source: 'before' }))),
    ...(after.ok ? [] : after.errors.map((issue) => ({ ...issue, source: 'after' }))),
  ];
  if (!before.ok || !after.ok) return { valid: false, errors };
  const diff = diffDesignSystems(before.compiled, after.compiled);
  return {
    valid: true,
    before: identity(before.compiled),
    after: identity(after.compiled),
    ...diff,
    errors: [],
  };
}

// ─── ds.preview ────────────────────────────────────────────────────────────

export async function runPreview(input: Input) {
  const format = input.format === 'html' ? 'html' : 'svg';
  const result = await compileOne(input.document, input);
  if (!result.ok) return { valid: false, format, errors: result.errors };
  const { compiled } = result;
  const content =
    format === 'html'
      ? emitReportHtml(compiled, typeof input.title === 'string' ? { title: input.title } : {})
      : previewSvg(compiled);
  return {
    valid: true,
    format,
    mediaType: MEDIA_TYPES[format],
    ...identity(compiled),
    bytes: bytesOf(content),
    content,
    errors: [],
  };
}

// ─── ds.save ───────────────────────────────────────────────────────────────

/** The document as the file `ds.save` writes: two-space JSON and a final newline. */
export const savedText = (document: unknown) => `${JSON.stringify(document, null, 2)}\n`;

/**
 * What `ds.save` may write, on top of the local write policy (ADR-019):
 * a `.json` file (any case), with no path segment that starts with `.`
 * (`.git/`, `.github/`, `.vscode/`, `.npmrc`), no `node_modules` segment and
 * no file named `package.json`, so even with `overwrite` it cannot replace
 * repository, CI or tool files. Checked on the path relative to the working
 * directory; the names compare case-insensitively (case-insensitive file
 * systems). Returns the refusal, or `undefined` when the path may be written.
 */
export function savePathRefusal(
  relative: string
): { code: 'path-extension' | 'path-reserved'; error: string } | undefined {
  const segments = relative.split(/[\\/]/u);
  const name = (segments.at(-1) ?? '').toLowerCase();
  if (segments.some((segment) => segment.startsWith('.')))
    return {
      code: 'path-reserved',
      error: `ds.save does not write in a dot directory or to a dotfile: ${relative}`,
    };
  if (
    segments.some((segment) => segment.toLowerCase() === 'node_modules') ||
    name === 'package.json'
  )
    return {
      code: 'path-reserved',
      error: `ds.save does not write to node_modules or package.json: ${relative}`,
    };
  if (!name.endsWith('.json'))
    return { code: 'path-extension', error: `ds.save writes .json files only: ${relative}` };
  return undefined;
}

export async function runSave(input: Input, files: LocalFiles) {
  const check = await runValidate(input);
  if (!check.valid) return { saved: false, errors: check.errors };
  const text = savedText(input.document);
  const path = input.path as string;
  const refused = (code: string, message: string) => ({
    saved: false,
    errors: [{ code, path: '$.path', message }],
  });
  const target = files.check(path);
  if (!target.ok) return refused(target.code, target.error);
  const reserved = savePathRefusal(target.relative);
  if (reserved) return refused(reserved.code, reserved.error);
  if (input.dryRun === true)
    return { saved: false, dryRun: true, path: target.relative, bytes: bytesOf(text), errors: [] };
  const written = await files.write(path, text, { overwrite: input.overwrite === true });
  if (!written.ok) return refused(written.code, written.error);
  return { saved: true, path: written.relative, bytes: written.bytes, errors: [] };
}

// ─── Resources and blueprint.theme ─────────────────────────────────────────

/** The ids `texuli://design-system/{id}` serves for the spec's examples. */
export const DESIGN_SYSTEM_EXAMPLE_IDS: readonly string[] = Object.freeze(
  Object.keys(DESIGN_SYSTEM_EXAMPLES)
);

/**
 * An example document, or a library theme as a document by id
 * (`loadLibraryBase`: `fromTheme` with the theme's generator input as
 * `color.brand`, the base `extends: "texuli:<id>"` reads).
 */
export async function designSystemDocument(id: string): Promise<unknown | undefined> {
  if (Object.hasOwn(DESIGN_SYSTEM_EXAMPLES, id)) return DESIGN_SYSTEM_EXAMPLES[id];
  if (!(await getFullThemeMeta(id))) return undefined;
  return loadLibraryBase(`texuli:${id}`);
}

/** True when `texuli:<id>` names a library theme. */
export async function libraryThemeExists(id: string): Promise<boolean> {
  return (await getFullThemeMeta(id)) !== undefined;
}
