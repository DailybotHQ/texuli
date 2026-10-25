/**
 * Core `texuli add` logic: resolve a styled component, refuse primitives,
 * stamp provenance, write into the consumer tree. No network.
 * Destination and source paths are contained (see paths.ts).
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  assertNoSymlinkOnPath,
  assertSourceFileInside,
  resolveContainedOutDir,
  resolveContainedSourceDir,
  validateRegistryEntry,
} from './paths.ts';
import { hasProvenance, provenanceHeader, provenanceSource } from './provenance.ts';
import { getAddable, isPrimitivesPath, listAddableIds } from './registry.ts';
import type { AddFilePlan, AddOptions, AddResult } from './types.ts';

const DEFAULT_VERSION = '0.0.0';

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      out.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function defaultOutRelative(id: string): string {
  return join('src', 'components', 'texuli', id);
}

/**
 * Plan which files to copy for a component. Does not write.
 * Throws never — errors go on the result.
 */
export async function planAdd(options: AddOptions): Promise<{
  result: AddResult;
  plans: AddFilePlan[];
  meta?: { id: string; package: string; version: string; sourceDir: string; cwdReal: string };
}> {
  const id = options.id.trim().toLowerCase();
  const version = options.version ?? DEFAULT_VERSION;
  const dryRun = Boolean(options.dryRun);
  const force = options.force === true;
  const cwdResolved = resolve(options.cwd);

  const empty = (
    errors: string[],
    outDir = cwdResolved
  ): { result: AddResult; plans: AddFilePlan[] } => ({
    result: {
      ok: false,
      id,
      package: '',
      outDir,
      files: [],
      errors,
      dryRun,
    },
    plans: [],
  });

  if (!id) return empty(['Component id is required.']);
  if (!options.sourceRoot || !existsSync(options.sourceRoot)) {
    return empty([`Source root does not exist: ${options.sourceRoot || '(empty)'}`]);
  }
  if (isPrimitivesPath(options.sourceRoot)) {
    return empty(['Source root must not be the primitives package.']);
  }

  // (1) Contain outDir under cwd.
  const outRelative = options.outDir ?? defaultOutRelative(id);
  const outResolved = resolveContainedOutDir(options.cwd, outRelative);
  if (!outResolved.ok) return empty([outResolved.error]);
  const outDir = outResolved.outDir;

  let cwdReal = cwdResolved;
  try {
    cwdReal = await realpath(cwdResolved);
  } catch {
    cwdReal = cwdResolved;
  }

  const entry = getAddable(id, options.registry);
  if (!entry) {
    const known = listAddableIds(options.registry).join(', ');
    return empty(
      [
        `Unknown or non-addable component "${id}". Styled components only (never primitives). Known: ${known || '(none)'}.`,
      ],
      outDir
    );
  }

  // (3) Validate registry entry (built-in or options.registry).
  const entryCheck = validateRegistryEntry(entry);
  if (!entryCheck.ok) return empty([entryCheck.error], outDir);

  if (
    entry.package === '@texuli/primitives' ||
    entry.package === 'primitives' ||
    isPrimitivesPath(join('packages', entry.package, entry.directory))
  ) {
    return empty([`Refusing to copy primitives package component "${id}".`], outDir);
  }

  const sourceResolved = resolveContainedSourceDir(options.sourceRoot, entry);
  if (!sourceResolved.ok) return empty([sourceResolved.error], outDir);
  const { sourceDir } = sourceResolved;

  if (isPrimitivesPath(sourceDir)) {
    return empty([`Refusing to copy primitives package component "${id}".`], outDir);
  }
  if (!existsSync(sourceDir)) {
    return empty([`Source directory missing: ${sourceDir}`], outDir);
  }
  const sourceStat = await stat(sourceDir);
  if (!sourceStat.isDirectory()) {
    return empty([`Source is not a directory: ${sourceDir}`], outDir);
  }

  const files = await listFilesRecursive(sourceDir);
  if (files.length === 0) {
    return empty([`No files found under ${sourceDir}`], outDir);
  }

  // Headers record the source relative to the real root, so a symlinked root
  // (macOS /var -> /private/var) never stamps a parent or machine path.
  const sourceDirRel = relative(await realpath(options.sourceRoot), await realpath(sourceDir))
    .split(sep)
    .join('/');

  const plans: AddFilePlan[] = [];
  const fileResults: AddResult['files'] = [];
  const errors: string[] = [];

  for (const from of files) {
    if (isPrimitivesPath(from)) {
      return empty([`Refusing path under primitives: ${from}`], outDir);
    }
    // (4) Source file must realpath inside sourceDir.
    const inside = assertSourceFileInside(sourceDir, from);
    if (!inside.ok) {
      return empty([inside.error], outDir);
    }

    const relativePath = relative(sourceDir, from).split(sep).join('/');
    // Relative path must not escape (belt and braces).
    if (
      relativePath.startsWith('..') ||
      relativePath.includes(`../`) ||
      relativePath.includes('..\\')
    ) {
      return empty([`Source relative path escapes component directory: ${relativePath}`], outDir);
    }

    if (provenanceSource(sourceDirRel, relativePath) === null) {
      return empty(
        [`Provenance source would not be a plain relative path: ${sourceDirRel}/${relativePath}`],
        outDir
      );
    }

    const to = resolve(outDir, relativePath);
    // Destination file must stay under outDir / cwd.
    const relToOut = relative(outDir, to);
    if (relToOut.startsWith(`..${sep}`) || relToOut === '..' || isAbsoluteRel(relToOut)) {
      return empty([`Destination file escapes outDir: ${to}`], outDir);
    }

    // (2) No symlink on destination path (even with --force).
    const linkCheck = assertNoSymlinkOnPath(to, cwdReal);
    if (!linkCheck.ok) {
      return empty([linkCheck.error], outDir);
    }

    const buf = await readFile(from);
    plans.push({
      relativePath,
      from: inside.realFile,
      to,
      sourceBytes: buf.byteLength,
    });

    const exists = existsSync(to);
    if (exists && !force) {
      fileResults.push({ path: to, action: 'skip', bytes: buf.byteLength });
      errors.push(`Refusing to overwrite existing file (use --force): ${to}`);
      continue;
    }
    fileResults.push({
      path: to,
      action: dryRun ? 'would-write' : 'write',
      bytes: buf.byteLength,
    });
  }

  const ok = errors.length === 0;
  return {
    result: {
      ok,
      id: entry.id,
      package: entry.package,
      outDir,
      files: fileResults,
      errors,
      dryRun,
    },
    plans: ok ? plans : [],
    meta: ok
      ? {
          id: entry.id,
          package: entry.package,
          version,
          sourceDir: sourceDirRel,
          cwdReal,
        }
      : undefined,
  };
}

function isAbsoluteRel(rel: string): boolean {
  return rel.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rel);
}

/**
 * Copy a styled component into the consumer project with provenance headers.
 * Local filesystem only — no network. Contained writes only.
 */
export async function addComponent(options: AddOptions): Promise<AddResult> {
  const { result, plans, meta } = await planAdd(options);
  if (!result.ok || !meta || result.dryRun) return result;

  for (const plan of plans) {
    // Re-check symlink containment immediately before write (TOCTOU).
    const linkCheck = assertNoSymlinkOnPath(plan.to, meta.cwdReal);
    if (!linkCheck.ok) {
      return {
        ...result,
        ok: false,
        errors: [...result.errors, linkCheck.error],
        files: result.files.map((file) =>
          file.path === plan.to ? { ...file, action: 'skip' as const } : file
        ),
      };
    }

    const raw = await readFile(plan.from, 'utf8');
    // planAdd checked every path; null here would be a bug, so stamp nothing unsafe.
    const source = provenanceSource(meta.sourceDir, plan.relativePath);
    if (source === null) {
      return {
        ...result,
        ok: false,
        errors: [...result.errors, `Unsafe provenance source: ${plan.relativePath}`],
      };
    }
    const header = hasProvenance(raw)
      ? ''
      : provenanceHeader(
          { id: meta.id, package: meta.package, version: meta.version, source },
          plan.relativePath
        );
    const body = header + raw;
    await mkdir(dirname(plan.to), { recursive: true });
    // After mkdir, parents must still be free of symlinks.
    const afterMkdir = assertNoSymlinkOnPath(plan.to, meta.cwdReal);
    if (!afterMkdir.ok) {
      return {
        ...result,
        ok: false,
        errors: [...result.errors, afterMkdir.error],
      };
    }
    await writeFile(plan.to, body, 'utf8');
  }

  return {
    ...result,
    files: result.files.map((file) =>
      file.action === 'would-write' ? { ...file, action: 'write' as const } : file
    ),
  };
}
