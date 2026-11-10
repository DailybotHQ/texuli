/**
 * Unchecked imports (0.16.1): workspace packages and local modules a prototype
 * imports that the locked scan did not read. Catalog modules (`texuli`,
 * `@texuli/*`) are mapped through the catalog and are not listed. `--scan-workspace`
 * pulls those workspace packages into the file map so they are scanned.
 */

const FROM_IMPORT =
  /import\s+(?:type\s+)?(?:(?:[A-Za-z_$][\w$]*)\s*,?\s*)?(?:\*\s+as\s+[A-Za-z_$][\w$]*\s*,?\s*)?(?:\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/g;
const SIDE_IMPORT = /(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;

/** The most unique specifiers one report lists. */
export const UNCHECKED_IMPORT_CAP = 64;

export interface UncheckedImports {
  readonly count: number;
  readonly imports: readonly string[];
}

export interface UnscannedOptions {
  /** Package names that belong to the workspace (from pnpm-workspace / workspaces). */
  readonly workspacePackages?: readonly string[];
  /**
   * When true, a workspace specifier is treated as scanned if any file path is
   * under `workspace:<name>/` or `node_modules/<name>/`.
   */
  readonly scanWorkspace?: boolean;
}

const SKIP = new Set(['svelte', 'vite', 'vitest', 'node', 'path', 'fs', 'url', 'os']);

export function isCatalogSpecifier(specifier: string): boolean {
  return (
    specifier === 'texuli' || specifier.startsWith('texuli/') || specifier.startsWith('@texuli/')
  );
}

/** Bare package name of a specifier (`@acme/ui/button` → `@acme/ui`). */
export function packageNameOf(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:'))
    return undefined;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  const name = specifier.split('/')[0];
  return name || undefined;
}

/** Import specifiers in one source (skips `import type`). */
export function listImportSpecifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(FROM_IMPORT)) {
    if (match[0].includes('import type')) continue;
    if (match[1]) found.push(match[1]);
  }
  for (const match of source.matchAll(SIDE_IMPORT)) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

export function resolveRelativeImport(fromFile: string, specifier: string): string {
  const slash = fromFile.lastIndexOf('/');
  const dir = slash === -1 ? '' : fromFile.slice(0, slash);
  const joined = dir ? `${dir}/${specifier}` : specifier;
  const parts: string[] = [];
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function isScannedPath(resolved: string, scanned: ReadonlySet<string>): boolean {
  if (scanned.has(resolved)) return true;
  for (const ext of ['.svelte', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']) {
    if (scanned.has(resolved + ext)) return true;
  }
  for (const index of ['index.ts', 'index.js', 'index.svelte']) {
    if (scanned.has(`${resolved}/${index}`)) return true;
  }
  return false;
}

function workspaceScanned(name: string, scanned: ReadonlySet<string>): boolean {
  const prefixes = [`workspace:${name}/`, `node_modules/${name}/`];
  for (const path of scanned) {
    for (const prefix of prefixes) if (path.startsWith(prefix)) return true;
    if (path.includes(`/node_modules/${name}/`)) return true;
  }
  return false;
}

/**
 * Unique workspace-package and local-module specifiers the scan did not read,
 * sorted, capped. Catalog and well-known runtime imports are omitted.
 */
export function listUncheckedImports(
  files: Readonly<Record<string, string>>,
  options: UnscannedOptions = {}
): UncheckedImports {
  const scanned = new Set(Object.keys(files));
  const workspace = new Set(options.workspacePackages ?? []);
  const unique = new Set<string>();
  for (const [path, text] of Object.entries(files)) {
    if (!/\.(svelte|[cm]?[jt]sx?)$/.test(path)) continue;
    for (const specifier of listImportSpecifiers(text)) {
      if (isCatalogSpecifier(specifier)) continue;
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(path, specifier);
        if (!isScannedPath(resolved, scanned)) unique.add(specifier);
        continue;
      }
      const name = packageNameOf(specifier);
      if (!name || SKIP.has(name) || name.startsWith('node:')) continue;
      if (!workspace.has(name)) continue;
      if (options.scanWorkspace && workspaceScanned(name, scanned)) continue;
      unique.add(specifier.startsWith(name) ? name : specifier);
    }
  }
  const imports = [...unique].sort().slice(0, UNCHECKED_IMPORT_CAP);
  return { count: imports.length, imports };
}
