// @vitest-environment node

import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import {
  groupHelp,
  operationHelp,
  parseRouterArgs,
  routerCommandNames,
  routerHelp,
  routerOperations,
  runRouter,
} from '../src/cli/router.ts';
import { localFiles } from '../src/internal/local-write.ts';
import { texuliOps } from '../src/ops/index.ts';

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    },
  };
}

let dir: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('texuli help', () => {
  it('is written from the registry (snapshot), lists every operation and kept command, and has a page per group and operation', async () => {
    const groups = [...new Set(routerOperations().map((entry) => entry.group))];
    const text = [
      routerHelp(),
      ...groups.map((group) => groupHelp(group)),
      ...routerOperations().map(({ operation }) => operationHelp(operation.name)),
    ].join('\n----\n');
    await expect(text).toMatchFileSnapshot('./__snapshots__/texuli-help.txt');
    // The CLI is a local door: every edge and node operation, never a site one.
    expect(routerOperations().map(({ operation }) => operation.name)).toEqual(
      texuliOps.list({ runtimes: ['edge', 'node'] }).map((operation) => operation.name)
    );
    expect(routerHelp()).not.toMatch(/\bsite\b/u);
    expect(parseRouterArgs(['site', 'read'])).toMatchObject({ kind: 'error' });
    for (const { operation } of routerOperations()) {
      const [group, verb] = operation.name.split('.') as [string, string];
      expect(routerHelp(), operation.name).toContain(`  ${group} ${verb} `);
      expect(groupHelp(group)).toContain(`[${operation.name}]`);
    }
    for (const kept of ['deck <command>', 'document <command>', 'mcp', 'theme preview <id>'])
      expect(routerHelp()).toContain(`  ${kept} `);

    const { out, io } = capture();
    expect(await runRouter(['help'], io)).toEqual({ ok: true });
    expect(await runRouter(['catalog', '--help'], io)).toEqual({ ok: true });
    expect(await runRouter(['help', 'deck'], io)).toEqual({ ok: true });
    expect(await runRouter(['theme', 'get', '--help'], io)).toEqual({ ok: true });
    expect(out).toEqual([
      routerHelp(),
      groupHelp('catalog'),
      groupHelp('deck'),
      operationHelp('theme.get'),
    ]);
  });
});

describe('parseRouterArgs', () => {
  it('routes every operation as <group> <verb>; keeps the 0.8 commands through their own parsers; refuses unknown commands, verbs and flags', () => {
    for (const { group, verb, operation } of routerOperations()) {
      expect(parseRouterArgs([group, verb, '--json', '{}'])).toEqual({
        kind: 'operation',
        operation: operation.name,
        input: { from: 'json', text: '{}' },
        overwrite: false,
      });
      expect(parseRouterArgs([group, verb, '--file', 'in.json', '--out', 'o.json'])).toMatchObject({
        input: { from: 'file', path: 'in.json' },
        out: 'o.json',
      });
      expect(parseRouterArgs([group, verb])).toMatchObject({ input: { from: 'stdin' } });
      expect(parseRouterArgs([group, verb, '--json', '-'])).toMatchObject({
        input: { from: 'stdin' },
      });
    }
    for (const [argv, command] of [
      [['deck', 'lint', '--file', 'deck.json'], 'deck'],
      [['document', 'to-pdf', '--file', 'd.json', '--out', 'd.pdf'], 'document'],
      [['mcp'], 'mcp'],
      [['mcp', '--version'], 'mcp'],
      [['theme', 'list', '--search', 'teal'], 'theme'],
      [['theme', 'preview', 'violet', '--mode', 'dark'], 'theme'],
      [['theme', 'apply', 'violet', '--dry-run'], 'theme'],
      [['init', '--dry-run'], 'init'],
      [['add', 'button'], 'add'],
      [['diff', 'button'], 'update'],
      [['update', 'button'], 'update'],
    ] as const)
      expect(parseRouterArgs(argv), argv.join(' ')).toMatchObject({ kind: 'legacy', command });
    // `theme preview` with flags only is the theme.preview operation.
    expect(parseRouterArgs(['theme', 'preview', '--json', '{"id":"violet"}'])).toMatchObject({
      kind: 'operation',
      operation: 'theme.preview',
    });
    for (const [argv, message] of [
      [['explode'], /Unknown texuli command "explode"/u],
      [['catalog', 'explode'], /Unknown verb "explode" for texuli catalog/u],
      [['catalog', 'search', '--frob'], /Unknown flag "--frob"/u],
      [['catalog', 'search', '--json'], /needs a value/u],
      [['catalog', 'search', '--json', '{}', '--file', 'x'], /not both/u],
      [['catalog', 'search', '--overwrite'], /--overwrite needs --out/u],
      [['deck', 'explode'], /Unknown deck command/u],
      [['document', 'validate', '--key', 'k'], /only for to-blueprint/u],
      [['mcp', '--port', '1'], /Unknown texuli mcp argument/u],
      [['theme', 'apply'], /theme id is required/u],
      [['help', 'nope'], /Unknown texuli group "nope"/u],
    ] as const) {
      const parsed = parseRouterArgs(argv);
      expect(parsed.kind, argv.join(' ')).toBe('error');
      expect(parsed.kind === 'error' ? parsed.message : '', argv.join(' ')).toMatch(message);
    }
    const names = routerCommandNames();
    for (const name of ['catalog search', 'deck run', 'deck', 'theme list', 'init', 'help'])
      expect(names.has(name), name).toBe(true);
    expect(names.has('explode')).toBe(false);
  });
});

describe('runRouter', () => {
  it('runs every operation example from --json, stdin and --file with the registry output; prints a refusal as JSON with its code and exit 1', async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-router-')));
    for (const { group, verb, operation } of routerOperations()) {
      for (const example of operation.examples) {
        const expected = await texuliOps.invoke(operation.name, example.input, {
          files: localFiles(),
        });
        expect(expected.ok, `${operation.name}: ${example.title}`).toBe(true);
        const json = JSON.stringify(example.input);
        const viaJson = capture();
        expect(await runRouter([group, verb, '--json', json], viaJson.io)).toEqual({ ok: true });
        expect(JSON.parse(viaJson.out.join(''))).toEqual(expected.ok ? expected.output : null);
        const viaStdin = capture();
        await runRouter([group, verb], { ...viaStdin.io, stdin: Readable.from([json]) });
        expect(viaStdin.out.join('')).toBe(viaJson.out.join(''));
        const file = join(dir, `${operation.name}.json`);
        await writeFile(file, json);
        const viaFile = capture();
        await runRouter([group, verb, '--file', file], viaFile.io);
        expect(viaFile.out.join('')).toBe(viaJson.out.join(''));
      }
    }
    expect(process.exitCode).toBeUndefined();

    const refused = capture();
    expect(
      await runRouter(['component', 'get', '--json', '{"id":"nope-nope"}'], refused.io)
    ).toMatchObject({
      ok: false,
    });
    expect(JSON.parse(refused.out.join(''))).toMatchObject({
      ok: false,
      operation: 'component.get',
      error: { code: 'not-found' },
    });
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;

    const invalid = capture();
    await runRouter(['catalog', 'search', '--json', '{"limit":"x","extra":1}'], invalid.io);
    expect(JSON.parse(invalid.out.join(''))).toMatchObject({ error: { code: 'invalid-input' } });
    process.exitCode = undefined;

    const usage = capture();
    expect(await runRouter(['catalog', 'search', '--json', '{nope'], usage.io)).toMatchObject({
      ok: false,
    });
    expect(usage.err.join('')).toMatch(/one JSON object/u);
    expect(usage.out).toEqual([]);
    expect(process.exitCode).toBe(1);
  });

  it('refuses hostile input before running: oversized stdin and files, non-files, non-object JSON', async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-router-')));
    const max = texuliOps.get('component.get')?.limits.inputBytes as number;
    const big = JSON.stringify({ id: 'x'.repeat(max) });
    const viaStdin = capture();
    expect(
      await runRouter(['component', 'get'], { ...viaStdin.io, stdin: Readable.from([big]) })
    ).toMatchObject({ ok: false });
    expect(viaStdin.err.join('')).toMatch(/exceeds 1024 bytes/u);
    const file = join(dir, 'big.json');
    await writeFile(file, big);
    const viaFile = capture();
    await runRouter(['component', 'get', '--file', file], viaFile.io);
    expect(viaFile.err.join('')).toMatch(/nothing was read/u);
    const folder = capture();
    await runRouter(['component', 'get', '--file', dir], folder.io);
    expect(folder.err.join('')).toMatch(/not a regular file/u);
    for (const text of ['[]', '"x"', 'null', '1']) {
      const shape = capture();
      await runRouter(['component', 'get', '--json', text], shape.io);
      expect(JSON.parse(shape.out.join('')), text).toMatchObject({
        error: { code: 'invalid-input' },
      });
    }
    // An empty stdin runs the operation with {}: the schema then names what is missing.
    const empty = capture();
    await runRouter(['component', 'get'], { ...empty.io, stdin: Readable.from(['']) });
    expect(JSON.parse(empty.out.join(''))).toMatchObject({ error: { code: 'invalid-input' } });
  });

  it('writes --out through the local write policy: a new file inside the working directory, never outside, never over a file unless --overwrite', async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-router-')));
    const args = ['theme', 'get', '--json', '{"id":"violet"}'];
    const first = capture();
    expect(
      await runRouter([...args, '--out', 'out/violet.json'], { ...first.io, cwd: dir })
    ).toEqual({
      ok: true,
      out: join('out', 'violet.json'),
    });
    const written = JSON.parse(await readFile(join(dir, 'out', 'violet.json'), 'utf8'));
    expect(written.theme.id).toBe('violet');
    expect(JSON.parse(first.out.join(''))).toMatchObject({ ok: true, operation: 'theme.get' });

    const again = capture();
    expect(
      await runRouter([...args, '--out', 'out/violet.json'], { ...again.io, cwd: dir })
    ).toMatchObject({
      ok: false,
    });
    expect(again.err.join('')).toMatch(/already exists.*\(exists\)/u);
    process.exitCode = undefined;
    const replaced = capture();
    expect(
      await runRouter([...args, '--out', 'out/violet.json', '--overwrite'], {
        ...replaced.io,
        cwd: dir,
      })
    ).toMatchObject({ ok: true });

    for (const target of ['../escape.json', '/etc/texuli.json', '']) {
      const outside = capture();
      const result = await runRouter([...args, '--out', target], { ...outside.io, cwd: dir });
      expect(result.ok, target).toBe(false);
      expect(outside.err.join(''), target).toMatch(/outside-working-directory|path-required/u);
    }
  });
});
