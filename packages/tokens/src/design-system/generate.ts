/**
 * Compose the existing design-system importers into one deterministic,
 * validated and compiled starting point. Inputs are untrusted and each
 * importer enforces its own size and shape limits.
 */

import type { DesignSystem } from '@texuli/spec/design-system';
import { SEMANTIC_ROLES } from '../contract/semantic.ts';
import { compileDesignSystem } from './compiler.ts';
import { DEFAULT_DESIGN_SYSTEM_SEED } from './from-theme.ts';
import {
  checkDesignSystemGuarantees,
  checkDesignSystemIndicators,
  evaluateDesignSystemIndicators,
} from './guarantees.ts';
import type { LogoPixels } from './import.ts';
import { importBrand, importLogoPixels, importTheme } from './import.ts';
import { importSiteCss } from './import-css.ts';
import {
  DESIGN_SYSTEM_IMPORT_LIMITS,
  type DesignSystemImportOptions,
  identity,
  isObject,
  type Json,
  type JsonObject,
  setPath,
  Warnings,
} from './io.ts';
import type { DesignSystemImportLoss } from './token-formats.ts';
import { importDtcg, importTokensStudio } from './token-formats.ts';

export interface GenerateDesignSystemInput {
  brief?: unknown;
  /** W3C DTCG or Tokens Studio JSON (object or bounded JSON text). */
  tokens?: unknown;
  /** Bounded CSS text. */
  css?: unknown;
  logoPixels?: LogoPixels;
  /** A Texuli Theme object or bounded JSON text. */
  theme?: unknown;
}

export type GenerateDesignSystemOptions = DesignSystemImportOptions;

export interface DesignSystemRepair {
  path: string;
  reason: string;
  from?: Json;
  to?: Json;
  mode?: 'light' | 'dark';
  variable?: string;
}

export interface DesignSystemGenerationReport {
  losses: DesignSystemImportLoss[];
  repairs: DesignSystemRepair[];
  guarantees: {
    passed: boolean;
    issues: { code: string; path: string; message: string }[];
  };
}

export type GenerateDesignSystemResult =
  | { ok: true; document: DesignSystem; report: DesignSystemGenerationReport }
  | {
      ok: false;
      errors: { code: string; path: string; message: string }[];
      report: DesignSystemGenerationReport;
    };

const DEFAULT_IDENTITY = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'generated-design-system',
  version: '1.0.0',
  name: 'Generated design system',
  color: { brand: { seed: DEFAULT_DESIGN_SYSTEM_SEED } },
  typography: {
    families: {
      sans: { stack: ['system-ui', 'sans-serif'] },
      heading: { stack: ['system-ui', 'sans-serif'] },
      mono: { stack: ['ui-monospace', 'monospace'] },
    },
    scale: { base: 16, ratio: 1.2 },
  },
  shape: { radius: 10, borderWidth: 1 },
  space: { base: 4, density: 1 },
  motion: { personality: 'standard' },
  accessibility: { contrast: 'AA', targetMin: 44, focusWidth: 2 },
} satisfies JsonObject;

const IDENTITY_KEYS = new Set(['format', 'formatVersion', 'id', 'version', 'name', 'description']);
const MAX_REPAIRS = 64;

function cloneObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function mergeDocument(
  target: JsonObject,
  source: JsonObject,
  sourceName: string,
  losses: DesignSystemImportLoss[],
  reportOverwrites: boolean,
  path = '$'
): void {
  for (const key of Object.keys(source)) {
    if (IDENTITY_KEYS.has(key)) continue;
    const incoming = source[key] as Json;
    const current = target[key];
    const childPath = `${path}.${key}`;
    if (isObject(incoming) && isObject(current)) {
      mergeDocument(
        target[key] as JsonObject,
        incoming,
        sourceName,
        losses,
        reportOverwrites,
        childPath
      );
    } else {
      if (
        reportOverwrites &&
        current !== undefined &&
        JSON.stringify(current) !== JSON.stringify(incoming)
      ) {
        losses.push({
          path: childPath,
          reason: `${sourceName} replaced a value supplied by an earlier input.`,
          value: current as Json,
        });
      }
      target[key] = incoming;
    }
  }
}

function removeAt(target: JsonObject, path: string): Json | undefined {
  const parts = path
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean);
  if (parts.length === 0) return;
  let node: JsonObject = target;
  for (const key of parts.slice(0, -1)) {
    const child = node[key];
    if (!isObject(child)) return;
    node = child;
  }
  const key = parts[parts.length - 1] as string;
  const value = node[key];
  if (value === undefined) return;
  delete node[key];
  return value;
}

function tokensImporter(input: unknown, options: GenerateDesignSystemOptions) {
  const root = typeof input === 'string' ? parseJson(input) : input;
  const studio =
    isObject(root) &&
    (('$metadata' in root && isObject(root.$metadata)) ||
      'global' in root ||
      'light' in root ||
      'dark' in root);
  const first = studio ? importTokensStudio(input, options) : importDtcg(input, options);
  if (first.ok) return first;
  const second = studio ? importDtcg(input, options) : importTokensStudio(input, options);
  return second.ok ? second : first;
}

function parseJson(value: string): unknown {
  if (value.length > DESIGN_SYSTEM_IMPORT_LIMITS.bytes) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function hasDefaultSeedWarning(warnings: { code: string; path: string }[]): boolean {
  return warnings.some(
    (warning) => warning.code === 'default' && warning.path === '$.color.brand.seed'
  );
}

function failingIndicatorPath(
  compiled: Extract<ReturnType<typeof compileDesignSystem>, { ok: true }>
): string | undefined {
  const failed = (['light', 'dark'] as const).flatMap((mode) =>
    evaluateDesignSystemIndicators(compiled.vars[mode] ?? {})
      .filter((item) => item.blocking && !item.pass)
      .map((item) => ({ mode, ...item }))
  )[0];
  if (!failed) return;
  return compiled.report.warnings.find(
    (warning) =>
      warning.code === 'aa-non-text' &&
      warning.mode === failed.mode &&
      warning.message.includes(failed.foreground)
  )?.path;
}

function roleFromVariable(variable: string): string | undefined {
  const role = variable
    .replace(/^--tx-/, '')
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return SEMANTIC_ROLES.includes(role as (typeof SEMANTIC_ROLES)[number]) ? role : undefined;
}

function pinFailingForeground(
  document: JsonObject,
  issue: { pairs?: readonly { foreground: string }[]; mode?: 'light' | 'dark' },
  options: GenerateDesignSystemOptions
): { path: string; value: string; reason: string } | undefined {
  const role = issue.pairs?.[0] ? roleFromVariable(issue.pairs[0].foreground) : undefined;
  const mode = issue.mode ?? 'light';
  if (!role) return;
  const path = `$.color.roles.${mode}.${role}`;
  const roles =
    isObject(document.color) && isObject(document.color.roles) ? document.color.roles : {};
  const modeRoles = isObject(roles[mode]) ? roles[mode] : {};
  if (Object.hasOwn(modeRoles, role)) return;

  const candidates = mode === 'light' ? ['#000000', '#ffffff'] : ['#ffffff', '#000000'];
  for (const value of candidates) {
    const candidate = cloneObject(document);
    setPath(candidate, ['color', 'roles', mode, role], value);
    if (compileDesignSystem(candidate, { trust: options.trust ?? 'untrusted' }).ok)
      return {
        path,
        value,
        reason: `Pinned ${role} to preserve the brand seed while meeting the failing AA guarantee.`,
      };
  }
}

/**
 * Import, merge, validate and compile any combination of brand brief, token
 * file, stylesheet, logo pixels and Texuli theme. Later inputs take
 * precedence; overwritten values are retained in `report.losses`.
 */
export function generateDesignSystem(
  input: GenerateDesignSystemInput = {},
  options: GenerateDesignSystemOptions = {}
): GenerateDesignSystemResult {
  const report: DesignSystemGenerationReport = {
    losses: [],
    repairs: [],
    guarantees: { passed: false, issues: [] },
  };
  const identityWarnings = new Warnings();
  const safeIdentity = identity({}, options, identityWarnings, DEFAULT_IDENTITY.name);
  const document = cloneObject(DEFAULT_IDENTITY);
  document.id = safeIdentity.id;
  document.version = safeIdentity.version;
  document.name = safeIdentity.name;
  if (safeIdentity.description) document.description = safeIdentity.description;
  const imported: { name: string; result: ReturnType<typeof importBrand> }[] = [];

  if (input.brief !== undefined)
    imported.push({ name: 'brief', result: importBrand(input.brief as string, options) });
  if (input.tokens !== undefined)
    imported.push({ name: 'tokens', result: tokensImporter(input.tokens, options) });
  if (input.css !== undefined)
    imported.push({ name: 'css', result: importSiteCss(input.css, options) });
  if (input.logoPixels !== undefined)
    imported.push({ name: 'logo', result: importLogoPixels(input.logoPixels, options) });
  if (input.theme !== undefined)
    imported.push({ name: 'theme', result: importTheme(input.theme, options) });
  if (imported.length === 0)
    report.losses.push(
      ...identityWarnings.list.map(({ path, message }) => ({ path, reason: message }))
    );

  let hasMergedInput = false;
  for (const { name, result } of imported) {
    report.losses.push(...result.losses);
    if (!result.ok)
      return {
        ok: false,
        errors: result.errors,
        report,
      };
    const firstInput = !hasMergedInput;
    const hasSeed =
      isObject(result.document.color) && isObject(result.document.color.brand)
        ? result.document.color.brand.seed !== undefined
        : false;
    if (hasSeed && hasDefaultSeedWarning(result.warnings)) {
      const withoutFallback = cloneObject(result.document as unknown as JsonObject);
      const color = withoutFallback.color as JsonObject;
      const brand = color.brand as JsonObject;
      delete brand.seed;
      mergeDocument(document, withoutFallback, name, report.losses, hasMergedInput);
    } else {
      mergeDocument(
        document,
        result.document as unknown as JsonObject,
        name,
        report.losses,
        hasMergedInput
      );
    }
    hasMergedInput = true;
    if (firstInput) {
      document.name = result.document.name;
      document.id = result.document.id;
      document.version = result.document.version;
    }
    if (firstInput && result.document.description !== undefined)
      document.description = result.document.description;
  }

  // The compiler treats the seed as the source of all defaults; keeping it
  // explicit makes the generated JSON a useful, valid starting document.
  let color: JsonObject;
  if (isObject(document.color)) color = document.color;
  else {
    color = {};
    document.color = color;
  }
  let brand: JsonObject;
  if (isObject(color.brand)) brand = color.brand;
  else {
    brand = {};
    color.brand = brand;
  }
  if (brand.seed === undefined) brand.seed = DEFAULT_DESIGN_SYSTEM_SEED;
  let compiled = compileDesignSystem(document, { trust: options.trust ?? 'untrusted' });
  for (let attempt = 0; attempt < MAX_REPAIRS; attempt++) {
    const path = compiled.ok
      ? failingIndicatorPath(compiled)
      : compiled.errors.find((entry) => ['aa-text', 'aa-focus', 'target-size'].includes(entry.code))
          ?.path;
    if (!path) break;
    if (path === '$.color.brand.seed') {
      const issue = compiled.ok
        ? undefined
        : compiled.errors.find(
            (entry) => entry.path === path && ['aa-text', 'aa-focus'].includes(entry.code)
          );
      const repair = issue ? pinFailingForeground(document, issue, options) : undefined;
      if (!repair) break;
      setPath(document, repair.path.slice(2).split('.'), repair.value);
      report.repairs.push({
        path: repair.path,
        reason: repair.reason,
        to: repair.value,
      });
    } else {
      const removed = removeAt(document, path);
      if (removed === undefined) break;
      report.repairs.push({
        path,
        reason:
          'Removed a pinned value that prevented the compiler from meeting its AA guarantees.',
        from: removed,
      });
    }
    compiled = compileDesignSystem(document, { trust: options.trust ?? 'untrusted' });
  }

  if (!compiled.ok) {
    return {
      ok: false,
      errors: compiled.errors,
      report,
    };
  }
  report.repairs.push(
    ...compiled.report.adjustments.map((adjustment) => ({
      path: adjustment.path,
      reason: adjustment.reason,
      from: adjustment.from,
      to: adjustment.to,
      mode: adjustment.mode,
      variable: adjustment.variable,
    }))
  );
  const guaranteeIssues = checkDesignSystemGuarantees(compiled).map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
  const indicatorIssues = checkDesignSystemIndicators(compiled).map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
  report.guarantees.issues = [...guaranteeIssues, ...indicatorIssues];
  report.guarantees.passed = report.guarantees.issues.length === 0;
  if (!report.guarantees.passed) {
    return {
      ok: false,
      errors: report.guarantees.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
      report,
    };
  }
  return { ok: true, document: document as unknown as DesignSystem, report };
}
