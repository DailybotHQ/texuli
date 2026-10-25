/// <reference types="node" />
/**
 * Contained reads and writes for `texuli init` and `texuli theme`: every
 * destination resolves inside the project root and no symlink may sit on its
 * path (even with `--force`).
 */
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertNoSymlinkOnPath, resolveContainedOutDir } from '../internal/paths.ts';
import { projectPathError } from './safe-path.ts';
import type { FileChange } from './types.ts';

export interface Project {
  /** Real path of the project root. */
  root: string;
}

export function openProject(cwd: string): Project | string {
  if (!existsSync(cwd)) return `Project root does not exist: ${cwd}`;
  return { root: realpathSync(cwd) };
}

/** Resolves a project-relative path, or explains why it is refused. */
export function resolveInProject(
  project: Project,
  rel: string,
  name = 'Path'
): string | { error: string } {
  const pathError = projectPathError(name, rel);
  if (pathError) return { error: pathError };
  const contained = resolveContainedOutDir(project.root, rel);
  if (!contained.ok) return { error: contained.error };
  const symlink = assertNoSymlinkOnPath(contained.outDir, project.root);
  if (!symlink.ok) return { error: symlink.error };
  if (existsSync(contained.outDir) && !lstatSync(contained.outDir).isFile()) {
    return { error: `${name} is not a regular file: ${rel}` };
  }
  return contained.outDir;
}

/** Reads a project file (null when missing), refusing paths outside the project or through symlinks. */
export async function readProjectFile(
  project: Project,
  rel: string,
  name?: string
): Promise<string | null | { error: string }> {
  const path = resolveInProject(project, rel, name);
  if (typeof path !== 'string') return path;
  return existsSync(path) ? readFile(path, 'utf8') : null;
}

/** A planned write: compare, then (unless dry run) write through the containment checks again. */
export async function writeProjectFile(
  project: Project,
  rel: string,
  before: string | null,
  after: string,
  dryRun: boolean
): Promise<FileChange | { error: string }> {
  const change: FileChange = {
    path: rel,
    action: before === null ? 'create' : before === after ? 'unchanged' : 'update',
    bytes: Buffer.byteLength(after),
  };
  if (dryRun || change.action === 'unchanged') return change;
  // Check again right before writing: the tree may have changed since planning.
  const path = resolveInProject(project, rel);
  if (typeof path !== 'string') return path;
  await mkdir(dirname(path), { recursive: true });
  const parent = assertNoSymlinkOnPath(dirname(path), project.root);
  if (!parent.ok) return { error: parent.error };
  await writeFile(path, after);
  return change;
}
