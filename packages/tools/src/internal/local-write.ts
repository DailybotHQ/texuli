/// <reference types="node" />
/**
 * The local write policy (ADR-019) for operations that write files through
 * the local MCP door (`texuli-mcp`, `texuli mcp`) and the CLI: `ds.save`
 * (through {@link localFiles}, which the local doors hand the registry) and
 * the CLI's `--out`. Every writer goes through {@link resolveLocalWritePath}
 * or {@link writeLocalFile}, never `node:fs` directly.
 *
 * The rules:
 * - the path is explicit: a non-empty string an agent or user passed, with
 *   no NUL byte and at most {@link MAX_LOCAL_PATH_LENGTH} characters;
 * - it resolves inside the working directory (`process.cwd()` unless a test
 *   passes `cwd`), and never to the working directory itself; an absolute
 *   path is accepted only when it already points inside it;
 * - `..` segments that leave the working directory are refused;
 * - no existing component of the path, the target included, is a symlink,
 *   so a link planted inside the working directory cannot redirect a write
 *   outside it;
 * - {@link writeLocalFile} creates a new file (`wx`) unless `overwrite` is
 *   set, and opens an existing one with `O_NOFOLLOW` where the platform has it.
 */
import { constants, lstatSync, realpathSync } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { LocalFiles } from '../ops/types.ts';

/** The longest path the policy accepts (characters). */
export const MAX_LOCAL_PATH_LENGTH = 1024;

export type LocalWriteRefusal =
  | 'path-required'
  | 'path-invalid'
  | 'outside-working-directory'
  | 'symlink'
  | 'not-a-file';

export type LocalWriteTarget =
  | { ok: true; path: string; relative: string }
  | { ok: false; code: LocalWriteRefusal; error: string };

export interface LocalWriteOptions {
  /** The directory writes are confined to (default `process.cwd()`). */
  cwd?: string;
}

const outside = (rel: string) => rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);

function realOrResolved(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * Resolve `path` against the working directory under the local write
 * policy. Returns the absolute path to write, or a refusal with a stable
 * code; it never touches the file itself.
 */
export function resolveLocalWritePath(
  path: unknown,
  options: LocalWriteOptions = {}
): LocalWriteTarget {
  if (typeof path !== 'string' || path.trim() === '')
    return {
      ok: false,
      code: 'path-required',
      error: 'An explicit output path is required; nothing is written without one.',
    };
  if (path.length > MAX_LOCAL_PATH_LENGTH || path.includes('\0'))
    return {
      ok: false,
      code: 'path-invalid',
      error: `The output path must be at most ${MAX_LOCAL_PATH_LENGTH} characters with no NUL byte.`,
    };
  const cwd = resolve(options.cwd ?? process.cwd());
  const cwdReal = realOrResolved(cwd);
  let target: string;
  if (isAbsolute(path)) {
    const absolute = resolve(path);
    // Accept the working directory as written or as its real path (macOS
    // reports /var/... while the real path is /private/var/...).
    const base = [cwdReal, cwd].find((root) => !outside(relative(root, absolute)));
    if (base === undefined)
      return {
        ok: false,
        code: 'outside-working-directory',
        error: `The output path must be inside the working directory: ${path}`,
      };
    target = resolve(cwdReal, relative(base, absolute));
  } else {
    target = resolve(cwdReal, path);
  }
  const rel = relative(cwdReal, target);
  if (outside(rel))
    return {
      ok: false,
      code: 'outside-working-directory',
      error: `The output path must be inside the working directory: ${path}`,
    };
  if (rel === '')
    return {
      ok: false,
      code: 'not-a-file',
      error: 'The output path names the working directory, not a file.',
    };
  // Every existing component below the working directory, the target
  // included, must be a real directory or file, never a symlink.
  let current = target;
  while (current !== cwdReal) {
    let link = false;
    try {
      link = lstatSync(current).isSymbolicLink();
    } catch {
      // Missing: it will be created.
    }
    if (link)
      return {
        ok: false,
        code: 'symlink',
        error: `Refusing to write through a symlink: ${relative(cwdReal, current)}`,
      };
    current = dirname(current);
  }
  return { ok: true, path: target, relative: rel };
}

export type LocalWriteResult =
  | { ok: true; path: string; relative: string; bytes: number }
  | { ok: false; code: LocalWriteRefusal | 'exists' | 'write-failed'; error: string };

/**
 * Write `data` to `path` under the local write policy: parent directories
 * are created inside the working directory, a new file is required unless
 * `overwrite` is set, and an existing target is never followed through a
 * symlink.
 */
export async function writeLocalFile(
  path: unknown,
  data: string | Uint8Array,
  options: LocalWriteOptions & { overwrite?: boolean } = {}
): Promise<LocalWriteResult> {
  const target = resolveLocalWritePath(path, options);
  if (!target.ok) return target;
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  try {
    await mkdir(dirname(target.path), { recursive: true });
    // Re-check after creating the parents: a symlink raced in is refused.
    const again = resolveLocalWritePath(target.path, options);
    if (!again.ok) return again;
    const flags = options.overwrite
      ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0)
      : 'wx';
    const handle = await open(target.path, flags, 0o644);
    try {
      await handle.writeFile(bytes);
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST')
      return {
        ok: false,
        code: 'exists',
        error: `${target.relative} already exists; pass overwrite to replace it.`,
      };
    if (code === 'ELOOP')
      return {
        ok: false,
        code: 'symlink',
        error: `Refusing to write through a symlink: ${target.relative}`,
      };
    return {
      ok: false,
      code: 'write-failed',
      error: `Could not write ${target.relative}${code ? ` (${code})` : ''}.`,
    };
  }
  return { ok: true, path: target.path, relative: target.relative, bytes: bytes.byteLength };
}

/**
 * The local writer a door hands `node` operations (`ds.save`): every write
 * goes through {@link writeLocalFile}, confined to `cwd`.
 */
export function localFiles(options: LocalWriteOptions = {}): LocalFiles {
  return {
    check(path) {
      const target = resolveLocalWritePath(path, options);
      return target.ok
        ? { ok: true, relative: target.relative }
        : { ok: false, code: target.code, error: target.error };
    },
    async write(path, data, { overwrite }) {
      const written = await writeLocalFile(path, data, { ...options, overwrite });
      return written.ok
        ? { ok: true, relative: written.relative, bytes: written.bytes }
        : { ok: false, code: written.code, error: written.error };
    },
  };
}
