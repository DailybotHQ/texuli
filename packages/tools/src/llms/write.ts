/// <reference types="node" />
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { assertNoSymlinkOnPath, escapesRoot } from '../internal/paths.ts';
import type { LlmsBundle, LlmsWriteResult } from './types.ts';

/**
 * Write every file from a bundle under `outDir`.
 *
 * Containment (shared with `cli-add` via `../internal/paths.ts`):
 * - `outDir` is resolved once
 * - every bundle path is `path.resolve(outDir, file.path)`
 * - paths that escape `outDir` (`escapesRoot`) are refused
 * - `assertNoSymlinkOnPath` runs before each write so nothing is written
 *   through a symlinked file or parent, including overwrite
 */
export async function writeLlmsBundle(
  outDir: string,
  bundle: LlmsBundle,
  options: { dryRun?: boolean } = {}
): Promise<LlmsWriteResult> {
  const dryRun = options.dryRun === true;
  const written: string[] = [];
  const outResolved = resolve(outDir);

  for (const file of bundle.files) {
    if (file.path.includes('\0')) {
      throw new Error(`Refusing unsafe bundle path: ${file.path}`);
    }
    if (
      isAbsolute(file.path) ||
      /^[A-Za-z]:[\\/]/.test(file.path) ||
      file.path.startsWith('\\\\')
    ) {
      throw new Error(`Refusing absolute bundle path: ${file.path}`);
    }

    const abs = resolve(outResolved, file.path);
    if (escapesRoot(outResolved, abs)) {
      throw new Error(`Refusing unsafe bundle path: ${file.path}`);
    }

    written.push(file.path);
    if (dryRun) continue;

    // Before creating parents or writing: refuse symlink leaves and parents.
    const before = assertNoSymlinkOnPath(abs, outResolved);
    if (!before.ok) {
      throw new Error(before.error);
    }

    await mkdir(dirname(abs), { recursive: true });

    // Re-check after mkdir (parent may have been replaced / linked).
    const after = assertNoSymlinkOnPath(abs, outResolved);
    if (!after.ok) {
      throw new Error(after.error);
    }

    await writeFile(abs, file.body, 'utf8');
  }

  return { outDir: outResolved, written, dryRun };
}
