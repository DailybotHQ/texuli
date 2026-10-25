/**
 * `texuli diff` and `texuli update`: three-way merge of a copied component
 * (the consumer's files) against the source it was copied from (the base,
 * at the installed version) and the new source. Local filesystem only.
 * Reads and writes use the same containment as `texuli add`.
 */
import { existsSync, lstatSync } from 'node:fs';
import { mkdir, readdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { hasProvenance, provenanceHeader, provenanceSource } from '../cli-add/provenance.ts';
import { getAddable, isPrimitivesPath, listAddableIds } from '../cli-add/registry.ts';
import type { AddableComponent } from '../cli-add/types.ts';
import {
  assertNoSymlinkOnPath,
  assertSourceFileInside,
  resolveContainedOutDir,
  resolveContainedSourceDir,
  validateRegistryEntry,
} from '../internal/paths.ts';
import { merge3, unifiedDiff } from './lines.ts';
import { parseProvenance } from './provenance.ts';
import type { UpdateFile, UpdateFileStatus, UpdateOptions, UpdateResult } from './types.ts';

const DEFAULT_VERSION = '0.0.0';
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

type SourceTree = { dir: string; relDir: string; files: Map<string, string> };
type LocalFile = { full: string; body: string; version: string; tracked: boolean };
type Planned = UpdateFile & { to: string; content: string | null };

async function walk(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...(await walk(full, root)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const toRel = (root: string, full: string) => relative(root, full).split(sep).join('/');

/** Read one component's source tree, contained like `texuli add`. */
async function readSource(
  root: string,
  entry: AddableComponent,
  label: string
): Promise<SourceTree | string> {
  if (!existsSync(root)) return `${label} does not exist: ${root}`;
  if (isPrimitivesPath(root)) return `${label} must not be the primitives package.`;
  const resolved = resolveContainedSourceDir(root, entry);
  if (!resolved.ok) return resolved.error;
  const dir = resolved.sourceDir;
  if (isPrimitivesPath(dir)) return `Refusing to read primitives source for "${entry.id}".`;
  const files = new Map<string, string>();
  if (!existsSync(dir)) return { dir, relDir: '', files };
  for (const file of await walk(dir)) {
    const inside = assertSourceFileInside(dir, file);
    if (!inside.ok) return inside.error;
    files.set(toRel(dir, file), await readFile(inside.realFile, 'utf8'));
  }
  // Relative to the real root, so a symlinked root never stamps a parent path.
  const relDir = toRel(await realpath(root), await realpath(dir));
  for (const path of files.keys()) {
    if (provenanceSource(relDir, path) === null) {
      return `Provenance source would not be a plain relative path: ${relDir}/${path}`;
    }
  }
  return { dir, relDir, files };
}

/**
 * Plan (and with `apply`, perform) an update. `diff` is this with
 * `apply: false`.
 */
async function run(options: UpdateOptions, apply: boolean): Promise<UpdateResult> {
  const id = options.id.trim().toLowerCase();
  const version = options.version ?? DEFAULT_VERSION;
  const dryRun = !apply || Boolean(options.dryRun);
  const mode = options.conflicts ?? 'refuse';
  const result: UpdateResult = {
    ok: false,
    id,
    package: '',
    outDir: resolve(options.cwd),
    installedVersion: null,
    version,
    files: [],
    conflicts: 0,
    errors: [],
    dryRun,
  };
  const fail = (error: string): UpdateResult => ({ ...result, errors: [...result.errors, error] });

  if (!id) return fail('Component id is required.');
  const entry = getAddable(id, options.registry);
  if (!entry) {
    return fail(
      `Unknown or non-addable component "${id}". Known: ${listAddableIds(options.registry).join(', ') || '(none)'}.`
    );
  }
  const entryCheck = validateRegistryEntry(entry);
  if (!entryCheck.ok) return fail(entryCheck.error);
  if (entry.package === '@texuli/primitives' || entry.package === 'primitives') {
    return fail(`Refusing to update primitives package component "${id}".`);
  }
  result.package = entry.package;

  const out = resolveContainedOutDir(
    options.cwd,
    options.outDir ?? join('src', 'components', 'texuli', id)
  );
  if (!out.ok) return fail(out.error);
  const outDir = out.outDir;
  result.outDir = outDir;
  const cwdReal = existsSync(options.cwd) ? await realpath(options.cwd) : resolve(options.cwd);

  const upstream = await readSource(options.sourceRoot, entry, 'Source root');
  if (typeof upstream === 'string') return fail(upstream);
  if (upstream.files.size === 0) return fail(`No files found under ${upstream.dir}`);
  let base: SourceTree | null = null;
  if (options.baseRoot !== undefined) {
    const read = await readSource(options.baseRoot, entry, 'Base root');
    if (typeof read === 'string') return fail(read);
    base = read;
  }

  // Local files: never through a symlink; tracked ones carry this component's header.
  const local = new Map<string, LocalFile>();
  if (existsSync(outDir)) {
    const link = assertNoSymlinkOnPath(outDir, cwdReal);
    if (!link.ok) return fail(link.error);
    for (const full of await walk(outDir)) {
      if (lstatSync(full).isSymbolicLink()) return fail(`Refusing symlink in component: ${full}`);
      const content = await readFile(full, 'utf8');
      const parsed = parseProvenance(content);
      const tracked = parsed !== null && parsed.meta.id === entry.id;
      local.set(toRel(outDir, full), {
        full: content,
        body: tracked ? parsed.body : content,
        version: tracked ? parsed.meta.version : '',
        tracked,
      });
    }
  }
  const versions = new Set([...local.values()].filter((f) => f.tracked).map((f) => f.version));
  if (versions.size > 1) {
    return fail(`Local files carry different versions (${[...versions].sort().join(', ')}).`);
  }
  result.installedVersion = versions.size === 1 ? ([...versions][0] as string) : null;
  if (
    options.baseVersion !== undefined &&
    result.installedVersion !== null &&
    result.installedVersion !== options.baseVersion
  ) {
    return fail(
      `Installed version is ${result.installedVersion}, but the base root is ${options.baseVersion}.`
    );
  }

  const labels = {
    local: 'local',
    base: `base ${result.installedVersion ?? '(unknown)'}`,
    upstream: `${entry.package} ${version}`,
  };
  const stamp = (path: string, body: string) => {
    if (hasProvenance(body)) return body;
    const meta = {
      id: entry.id,
      package: entry.package,
      version,
      // Checked in readSource for every upstream path.
      source: provenanceSource(upstream.relDir, path) ?? '',
    };
    return provenanceHeader(meta, path) + body;
  };

  const paths = new Set<string>([
    ...upstream.files.keys(),
    ...(base ? base.files.keys() : []),
    ...local.keys(),
  ]);
  const planned: Planned[] = [];
  const plan = (path: string, status: UpdateFileStatus, content: string | null, conflicts = 0) => {
    const to = resolve(outDir, path);
    const before = local.get(path)?.full ?? '';
    let action: UpdateFile['action'] = 'none';
    if (content === null && status === 'removed' && options.prune) action = 'delete';
    else if (content !== null && content !== before) action = 'write';
    if (dryRun && action !== 'none') action = action === 'write' ? 'would-write' : 'would-delete';
    const after = action === 'delete' || action === 'would-delete' ? '' : (content ?? before);
    const diff = unifiedDiff(before, after, { from: `a/${path}`, to: `b/${path}` });
    planned.push({ path, status, action, diff, conflicts, to, content });
  };

  for (const path of [...paths].sort()) {
    const mine = local.get(path);
    const theirs = upstream.files.get(path);
    const origin = base?.files.get(path);
    if (mine && !mine.tracked) {
      plan(path, 'untracked', null);
    } else if (theirs !== undefined && !mine) {
      if (origin !== undefined && result.installedVersion !== null)
        plan(path, 'deleted-locally', null);
      else plan(path, 'added', stamp(path, theirs));
    } else if (theirs !== undefined && mine) {
      if (mine.body === theirs) plan(path, 'unchanged', stamp(path, theirs));
      else if (!base) plan(path, 'needs-base', null);
      else if (origin === mine.body) plan(path, 'fast-forward', stamp(path, theirs));
      else if (origin === theirs) plan(path, 'kept-local', stamp(path, mine.body));
      else {
        const merged = merge3(origin ?? '', mine.body, theirs, labels);
        plan(
          path,
          merged.conflicts > 0 ? 'conflict' : 'merged',
          stamp(path, merged.text),
          merged.conflicts
        );
      }
    } else if (mine) {
      const untouched = base !== null && origin === mine.body;
      plan(path, untouched ? 'removed' : 'removed-modified', null);
    }
  }

  result.files = planned.map(({ to: _to, content: _content, ...file }) => file);
  result.conflicts = planned.reduce((sum, file) => sum + file.conflicts, 0);
  const blocked = planned.filter((f) => f.status === 'needs-base').map((f) => f.path);
  if (apply && blocked.length > 0) {
    result.errors.push(
      `Local edits cannot be merged without the installed source (--base-root): ${blocked.join(', ')}`
    );
  }
  if (apply && result.conflicts > 0 && mode === 'refuse') {
    result.errors.push(
      `${result.conflicts} conflict(s); nothing was written. Resolve them, or pass --conflicts markers.`
    );
  }
  result.ok = result.errors.length === 0;
  if (!result.ok || dryRun) {
    if (!result.ok) result.files = result.files.map((f) => ({ ...f, action: 'none' }));
    return result;
  }

  for (const file of planned) {
    if (file.action === 'none') continue;
    const link = assertNoSymlinkOnPath(file.to, cwdReal);
    if (!link.ok) return { ...result, ok: false, errors: [link.error] };
    if (file.action === 'delete') {
      await unlink(file.to);
      continue;
    }
    await mkdir(dirname(file.to), { recursive: true });
    const after = assertNoSymlinkOnPath(file.to, cwdReal);
    if (!after.ok) return { ...result, ok: false, errors: [after.error] };
    await writeFile(file.to, file.content ?? '', 'utf8');
  }
  return result;
}

/**
 * Show what `texuli update` would do: each file's status and a unified diff
 * from the local file to its result. Writes nothing.
 */
export function diffComponent(options: UpdateOptions): Promise<UpdateResult> {
  return run(options, false);
}

/**
 * Update a copied component to the new source with a three-way merge.
 * Writes nothing when any file conflicts (unless `conflicts: 'markers'`) or
 * needs a base that was not given.
 */
export function updateComponent(options: UpdateOptions): Promise<UpdateResult> {
  return run(options, true);
}
