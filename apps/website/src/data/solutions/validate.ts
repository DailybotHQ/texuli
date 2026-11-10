/**
 * File-system checks for the Solutions registry (ADR-029), on top of
 * `checkSolutionRegistry`. Package versions and native statuses are derived here,
 * never typed on the entry. Import from tests and the build only: this module
 * reads the repository.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkSolutionRegistry,
  type SchemaIssue,
  type SolutionEntry,
  type SolutionPlatform,
  type SolutionSlug,
  type SolutionStatus,
} from './schema.ts';

const STATUS_RANK: Readonly<Record<SolutionStatus, number>> = {
  planned: 0,
  experimental: 1,
  'in development': 2,
  available: 3,
};

/** Parity.json capability name that covers each Solution on Compose Desktop. */
const PARITY_CAPABILITY: Readonly<Record<SolutionSlug, string>> = {
  slides: 'Decks',
  documents: 'Documents, forms, canvas and sheets',
  workflows: 'Workflows',
  canvas: 'Documents, forms, canvas and sheets',
  sheets: 'Documents, forms, canvas and sheets',
  'design-systems': 'Design systems and tokens',
};

export interface ValidateRegistryOptions {
  /** Repository root. Defaults to the checkout that contains this file. */
  readonly root?: string;
  /**
   * When true, a missing landing or docs page is an error. Default false: the
   * miss is reported as planned so the registry can land before the pages.
   */
  readonly requireRoutes?: boolean;
}

export interface RegistryValidation {
  readonly issues: SchemaIssue[];
  /** Missing landing/docs pages when `requireRoutes` is false. */
  readonly planned: SchemaIssue[];
}

interface ParityCapability {
  readonly name: string;
  readonly status: string;
}

interface ParityFile {
  readonly capabilities?: readonly ParityCapability[];
}

/** The Texuli checkout that contains `apps/website/src/data/solutions/validate.ts`. */
export function solutionsRepoRoot(): string {
  const url = import.meta.url;
  if (url.startsWith('file:')) {
    return fileURLToPath(new URL('../../../../../', url));
  }
  return process.cwd();
}

/**
 * Checks entries against package manifests, routes, evidence files and
 * `native/docs/parity.json`. An empty `issues` array means the registry may ship.
 */
export function validateSolutionRegistry(
  entries: readonly SolutionEntry[],
  options: ValidateRegistryOptions = {}
): RegistryValidation {
  const root = options.root ?? solutionsRepoRoot();
  const requireRoutes = options.requireRoutes === true;
  const issues: SchemaIssue[] = [...checkSolutionRegistry(entries)];
  const planned: SchemaIssue[] = [];
  const packages = loadPackageExports(root);
  const parity = loadParity(root, issues);

  entries.forEach((entry, i) => {
    const prefix = `[${i}]`;
    checkPackages(entry, prefix, packages, issues);
    checkRoutes(entry, prefix, root, requireRoutes, issues, planned);
    checkEvidence(entry, prefix, root, issues);
    checkNativeStatuses(entry, prefix, parity, issues);
  });

  return { issues, planned };
}

function loadPackageExports(root: string): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return map;
  for (const dir of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: unknown;
      exports?: unknown;
    };
    if (typeof manifest.name !== 'string') continue;
    const keys = new Set<string>();
    if (
      manifest.exports &&
      typeof manifest.exports === 'object' &&
      !Array.isArray(manifest.exports)
    ) {
      for (const key of Object.keys(manifest.exports)) keys.add(key);
    }
    map.set(manifest.name, keys);
  }
  return map;
}

function loadParity(root: string, issues: SchemaIssue[]): ParityFile | null {
  const path = join(root, 'native/docs/parity.json');
  if (!existsSync(path)) {
    issues.push({ path: 'native', message: 'native/docs/parity.json is missing' });
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ParityFile;
  } catch {
    issues.push({ path: 'native', message: 'native/docs/parity.json is not valid JSON' });
    return null;
  }
}

function checkPackages(
  entry: SolutionEntry,
  prefix: string,
  packages: ReadonlyMap<string, ReadonlySet<string>>,
  issues: SchemaIssue[]
): void {
  entry.packages.forEach((pkg, i) => {
    const exports = packages.get(pkg.name);
    if (!exports) {
      issues.push({
        path: `${prefix}.packages[${i}].name`,
        message: `"${pkg.name}" is not a packages/*/package.json name`,
      });
      return;
    }
    pkg.subpaths.forEach((sub, j) => {
      if (!exports.has(sub)) {
        issues.push({
          path: `${prefix}.packages[${i}].subpaths[${j}]`,
          message: `"${sub}" is not an export of ${pkg.name}`,
        });
      }
    });
  });
}

function checkRoutes(
  entry: SolutionEntry,
  prefix: string,
  root: string,
  requireRoutes: boolean,
  issues: SchemaIssue[],
  planned: SchemaIssue[]
): void {
  for (const [field, route] of [
    ['route', entry.route],
    ['docs', entry.docs],
  ] as const) {
    if (pageExists(root, route)) continue;
    const issue: SchemaIssue = {
      path: `${prefix}.${field}`,
      message: `${route} has no page under apps/website/src/pages yet`,
    };
    if (requireRoutes) issues.push(issue);
    else planned.push({ ...issue, message: `planned: ${issue.message}` });
  }
}

function checkEvidence(
  entry: SolutionEntry,
  prefix: string,
  root: string,
  issues: SchemaIssue[]
): void {
  entry.platforms.forEach((platform, i) => {
    platform.evidence.forEach((path, j) => {
      if (!isRepoRelativeFile(root, path)) {
        issues.push({
          path: `${prefix}.platforms[${i}].evidence[${j}]`,
          message: `"${path}" is not a file in this repository`,
        });
      }
    });
  });
}

function checkNativeStatuses(
  entry: SolutionEntry,
  prefix: string,
  parity: ParityFile | null,
  issues: SchemaIssue[]
): void {
  entry.platforms.forEach((platform, i) => {
    if (platform.platform === 'web') return;
    const ceiling = nativeCeiling(entry.slug, platform.platform, parity);
    if (ceiling === null) {
      issues.push({
        path: `${prefix}.platforms[${i}].status`,
        message: `no parity.json capability covers ${entry.slug} on ${platform.platform}`,
      });
      return;
    }
    if (STATUS_RANK[platform.status] > STATUS_RANK[ceiling]) {
      issues.push({
        path: `${prefix}.platforms[${i}].status`,
        message: `${platform.platform} status "${platform.status}" is above parity.json (${ceiling})`,
      });
    }
  });
}

function nativeCeiling(
  slug: SolutionSlug,
  platform: SolutionPlatform,
  parity: ParityFile | null
): SolutionStatus | null {
  if (platform === 'android' || platform === 'ios') return 'planned';
  if (platform !== 'compose-desktop' || !parity) return null;
  const name = PARITY_CAPABILITY[slug];
  const row = parity.capabilities?.find((capability) => capability.name === name);
  if (!row) return null;
  return ceilingFromParity(row.status);
}

function ceilingFromParity(status: string): SolutionStatus {
  if (status === 'parity' || status === 'partial') return 'in development';
  if (status === 'validation-only') return 'experimental';
  return 'planned';
}

function pageExists(root: string, route: string): boolean {
  const rel = route.replace(/^\//, '').replace(/\/$/, '');
  const base = join(root, 'apps/website/src/pages', rel);
  return (
    existsSync(join(base, 'index.astro')) ||
    existsSync(join(base, 'index.md')) ||
    existsSync(`${base}.astro`)
  );
}

function isRepoRelativeFile(root: string, path: string): boolean {
  if (path.length === 0 || isAbsolute(path) || path.startsWith('..')) return false;
  const resolved = resolvePath(root, path);
  const rel = relative(root, resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) return false;
  return existsSync(resolved);
}
