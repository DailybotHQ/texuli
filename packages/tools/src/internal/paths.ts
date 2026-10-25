/**
 * Shared path containment for `@texuli/tools` file writers (`cli-add`, `llms`, …).
 * Every write stays under a resolved root; every read that claims a source
 * tree stays under that tree. Symlinks on a destination path are refused.
 */
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import type { AddableComponent } from '../cli-add/types.ts';

/** True when `candidate` escapes `root` (after resolve). */
export function escapesRoot(root: string, candidate: string): boolean {
  const rootResolved = resolve(root);
  const candidateResolved = resolve(candidate);
  const rel = relative(rootResolved, candidateResolved);
  if (rel === '') return false;
  return rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel);
}

function realPathIfExists(path: string): string {
  try {
    if (existsSync(path)) return realpathSync(path);
  } catch {
    // fall through
  }
  return resolve(path);
}

/**
 * Resolve a destination directory under `cwd`.
 * Returns an error string when the path escapes cwd or is absolute.
 */
export function resolveContainedOutDir(
  cwd: string,
  outRelativeOrDefault: string
): { ok: true; outDir: string } | { ok: false; error: string } {
  const cwdReal = realPathIfExists(cwd);

  if (
    isAbsolute(outRelativeOrDefault) ||
    /^[A-Za-z]:[\\/]/.test(outRelativeOrDefault) ||
    outRelativeOrDefault.startsWith('\\\\')
  ) {
    return {
      ok: false,
      error: `Destination must be relative to the project root (got absolute path: ${outRelativeOrDefault}).`,
    };
  }

  const resolved = resolve(cwdReal, outRelativeOrDefault);
  const rel = relative(cwdReal, resolved);
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    return {
      ok: false,
      error: `Destination escapes the project root: ${outRelativeOrDefault}`,
    };
  }
  return { ok: true, outDir: resolved };
}

/**
 * Walk from `targetPath` up to (and including) `cwdReal`, refusing any symlink.
 * Missing leaf is fine (we will create it). Every existing ancestor must not
 * be a symlink.
 */
export function assertNoSymlinkOnPath(
  targetPath: string,
  cwdReal: string
): { ok: true } | { ok: false; error: string } {
  const cwdResolved = resolve(cwdReal);
  let current = resolve(targetPath);

  const relToCwd = relative(cwdResolved, current);
  if (relToCwd.startsWith(`..${sep}`) || relToCwd === '..' || isAbsolute(relToCwd)) {
    return { ok: false, error: `Path escapes the project root: ${targetPath}` };
  }

  while (true) {
    if (existsSync(current)) {
      try {
        const st = lstatSync(current);
        if (st.isSymbolicLink()) {
          return {
            ok: false,
            error: `Refusing to write through a symlink: ${current}`,
          };
        }
      } catch (error) {
        return {
          ok: false,
          error: `Cannot inspect path ${current}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    if (current === cwdResolved) break;
    const parent = resolve(current, '..');
    if (parent === current) break;
    const relParent = relative(cwdResolved, parent);
    if (relParent.startsWith(`..${sep}`) || relParent === '..' || isAbsolute(relParent)) {
      break;
    }
    current = parent;
  }
  return { ok: true };
}

/**
 * Validate a registry entry's package and directory fields.
 * Both must be relative, normalized, without `..`, absolute form, or NUL.
 */
export function validateRegistryEntry(
  entry: AddableComponent
): { ok: true } | { ok: false; error: string } {
  const checkRelativeField = (name: string, value: string): string | null => {
    if (typeof value !== 'string' || value.length === 0) {
      return `Registry ${name} must be a non-empty string.`;
    }
    if (value.includes('\0')) {
      return `Registry ${name} must not contain NUL.`;
    }
    if (isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\')) {
      return `Registry ${name} must be relative (got absolute: ${value}).`;
    }
    // Inspect raw segments before normalize() collapses `a/../b` into `b`.
    const rawSegments = value.split(/[/\\]/);
    if (rawSegments.some((s) => s === '..')) {
      return `Registry ${name} must not contain '..' segments (got: ${value}).`;
    }
    const normalized = normalize(value);
    const segments = normalized.split(/[/\\]/).filter((s) => s.length > 0);
    if (
      segments.some((s) => s === '..') ||
      normalized === '..' ||
      normalized.startsWith(`..${sep}`)
    ) {
      return `Registry ${name} must not contain '..' segments (got: ${value}).`;
    }
    return null;
  };

  const packageError = checkRelativeField('package', entry.package);
  if (packageError) return { ok: false, error: packageError };

  // package is a bare name or @scope/name (one slash max for scope).
  const pkgSegments = entry.package.split('/').filter(Boolean);
  if (entry.package.includes('\\') || pkgSegments.length > 2) {
    return { ok: false, error: `Registry package must be a package name (got: ${entry.package}).` };
  }
  if (pkgSegments.length === 2 && !entry.package.startsWith('@')) {
    return { ok: false, error: `Registry package must be a package name (got: ${entry.package}).` };
  }

  const directoryError = checkRelativeField('directory', entry.directory);
  if (directoryError) return { ok: false, error: directoryError };

  return { ok: true };
}

/**
 * Ensure `sourceDir` resolves inside `sourceRoot/packages/<package>`.
 */
export function resolveContainedSourceDir(
  sourceRoot: string,
  entry: AddableComponent
): { ok: true; sourceDir: string; packageRoot: string } | { ok: false; error: string } {
  const entryCheck = validateRegistryEntry(entry);
  if (!entryCheck.ok) return entryCheck;

  const rootReal = realPathIfExists(sourceRoot);
  const packagesRoot = resolve(rootReal, 'packages');
  const packageRoot = resolve(packagesRoot, entry.package);
  if (escapesRoot(packagesRoot, packageRoot)) {
    return {
      ok: false,
      error: `Package path escapes packages/: ${entry.package}`,
    };
  }

  const sourceDir = resolve(packageRoot, entry.directory);
  if (escapesRoot(packageRoot, sourceDir)) {
    return {
      ok: false,
      error: `Source directory escapes package root: ${entry.directory}`,
    };
  }
  return { ok: true, sourceDir, packageRoot };
}

/**
 * Ensure a source file's real path stays under sourceDir (no symlink escape).
 */
export function assertSourceFileInside(
  sourceDir: string,
  filePath: string
): { ok: true; realFile: string } | { ok: false; error: string } {
  const sourceReal = realPathIfExists(sourceDir);

  let fileReal: string;
  try {
    fileReal = existsSync(filePath) ? realpathSync(filePath) : resolve(filePath);
  } catch (error) {
    return {
      ok: false,
      error: `Cannot resolve source file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (escapesRoot(sourceReal, fileReal)) {
    return {
      ok: false,
      error: `Source file escapes component directory: ${filePath}`,
    };
  }
  return { ok: true, realFile: fileReal };
}
