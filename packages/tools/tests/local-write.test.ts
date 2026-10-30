/// <reference types="node" />
// @vitest-environment node
/**
 * The local write policy (ADR-019): every file an operation writes through
 * the local MCP door goes through `resolveLocalWritePath` / `writeLocalFile`,
 * which confine writes to explicit paths inside the working directory.
 */
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_LOCAL_PATH_LENGTH,
  resolveLocalWritePath,
  writeLocalFile,
} from '../src/internal/local-write.ts';

let base: string;
let cwd: string;
let outside: string;

beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), 'texuli-local-write-')));
  cwd = join(base, 'project');
  outside = join(base, 'outside');
  await mkdir(cwd);
  await mkdir(outside);
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('resolveLocalWritePath', () => {
  it('accepts explicit paths inside the working directory', () => {
    for (const [path, rel] of [
      ['theme.json', 'theme.json'],
      ['out/systems/acme.json', join('out', 'systems', 'acme.json')],
      ['./a/../b.json', 'b.json'],
      [join(cwd, 'abs.json'), 'abs.json'],
    ] as const) {
      const target = resolveLocalWritePath(path, { cwd });
      expect(target, path).toEqual({ ok: true, path: join(cwd, rel), relative: rel });
    }
  });

  it('refuses missing, invalid, escaping and directory paths with a stable code', () => {
    for (const [path, code] of [
      [undefined, 'path-required'],
      ['', 'path-required'],
      ['   ', 'path-required'],
      [42, 'path-required'],
      ['a\0b.json', 'path-invalid'],
      ['x'.repeat(MAX_LOCAL_PATH_LENGTH + 1), 'path-invalid'],
      ['../outside/x.json', 'outside-working-directory'],
      ['a/../../outside/x.json', 'outside-working-directory'],
      ['..', 'outside-working-directory'],
      [join(outside, 'x.json'), 'outside-working-directory'],
      ['/etc/passwd', 'outside-working-directory'],
      ['.', 'not-a-file'],
      ['a/..', 'not-a-file'],
      [cwd, 'not-a-file'],
    ] as const) {
      const target = resolveLocalWritePath(path, { cwd });
      expect(target.ok, String(path)).toBe(false);
      if (!target.ok) expect(target.code, String(path)).toBe(code);
    }
  });

  it('refuses a symlinked directory or file, even one that points back inside', async () => {
    await symlink(outside, join(cwd, 'escape'));
    await mkdir(join(cwd, 'real'));
    await symlink(join(cwd, 'real'), join(cwd, 'inner'));
    await writeFile(join(outside, 'target.json'), 'x');
    await symlink(join(outside, 'target.json'), join(cwd, 'link.json'));
    for (const path of ['escape/x.json', 'escape/deep/x.json', 'inner/x.json', 'link.json']) {
      const target = resolveLocalWritePath(path, { cwd });
      expect(target.ok, path).toBe(false);
      if (!target.ok) expect(target.code, path).toBe('symlink');
    }
  });

  it('defaults to process.cwd()', () => {
    const target = resolveLocalWritePath('x.json');
    expect(target.ok).toBe(true);
    if (target.ok) expect(target.relative).toBe('x.json');
    expect(resolveLocalWritePath('../x.json').ok).toBe(false);
  });
});

describe('writeLocalFile', () => {
  it('writes a new file, creating parents, and never overwrites without the flag', async () => {
    const first = await writeLocalFile('out/acme.json', '{"a":1}', { cwd });
    expect(first).toEqual({
      ok: true,
      path: join(cwd, 'out', 'acme.json'),
      relative: join('out', 'acme.json'),
      bytes: 7,
    });
    expect(await readFile(join(cwd, 'out', 'acme.json'), 'utf8')).toBe('{"a":1}');
    const again = await writeLocalFile('out/acme.json', 'changed', { cwd });
    expect(again).toMatchObject({ ok: false, code: 'exists' });
    expect(await readFile(join(cwd, 'out', 'acme.json'), 'utf8')).toBe('{"a":1}');
    const replaced = await writeLocalFile('out/acme.json', new Uint8Array([104, 105]), {
      cwd,
      overwrite: true,
    });
    expect(replaced).toMatchObject({ ok: true, bytes: 2 });
    expect(await readFile(join(cwd, 'out', 'acme.json'), 'utf8')).toBe('hi');
  });

  it('writes nothing outside the working directory or through a symlink', async () => {
    await symlink(outside, join(cwd, 'escape'));
    await writeFile(join(outside, 'target.json'), 'original');
    await symlink(join(outside, 'target.json'), join(cwd, 'link.json'));
    for (const [path, code] of [
      ['../outside/new.json', 'outside-working-directory'],
      ['escape/new.json', 'symlink'],
      ['link.json', 'symlink'],
      [undefined, 'path-required'],
    ] as const) {
      const result = await writeLocalFile(path, 'pwned', { cwd, overwrite: true });
      expect(result, String(path)).toMatchObject({ ok: false, code });
    }
    expect(await readFile(join(outside, 'target.json'), 'utf8')).toBe('original');
    await expect(readFile(join(outside, 'new.json'), 'utf8')).rejects.toThrow();
  });
});
