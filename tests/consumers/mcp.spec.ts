/// <reference types="node" />
/**
 * The local MCP door from a clean consumer (ADR-019, AC-mcp-local): install
 * the packed `@texuli/mcp` tarball and the Texuli tarballs it depends on into
 * an empty app, offline, then spawn `node_modules/.bin/texuli-mcp` the way an
 * MCP host starts it after `npx -y @texuli/mcp`, and speak MCP over stdio:
 * `initialize`, `notifications/initialized`, `tools/list` and one
 * `tools/call` (`catalog.search`). Closing stdin must end the process with
 * exit code 0, and stdout must carry nothing but JSON-RPC.
 *
 * Tarballs come from `pnpm verify:packages` (repacked here when missing or
 * stale). No browser is used.
 */
import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { PINNED } from './fixtures/versions.ts';
import {
  assertInstalledFromTarballs,
  ensureConsumerTarballs,
  installArgs,
  REPO_ROOT,
  type TarballMap,
} from './harness.ts';
import { packablePackages } from './surface.ts';

const execFileAsync = promisify(execFile);
const PROTOCOL_VERSION = '2025-11-25';

/** `@texuli/mcp` and every Texuli package it reaches through `dependencies`. */
function mcpClosure(): string[] {
  const packages = new Map(packablePackages(REPO_ROOT).map((pkg) => [pkg.name, pkg]));
  const seen = new Set<string>();
  const queue = ['@texuli/mcp'];
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (seen.has(name)) continue;
    const pkg = packages.get(name);
    if (!pkg) throw new Error(`${name} is not a packable package`);
    seen.add(name);
    const deps = (pkg.manifest.dependencies ?? {}) as Record<string, string>;
    for (const dep of Object.keys(deps)) if (packages.has(dep)) queue.push(dep);
  }
  return [...seen].sort();
}

type Rpc = {
  jsonrpc: string;
  id?: number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

/** A JSON-RPC client over a child's stdio: one JSON object per line. */
function client(child: ChildProcessWithoutNullStreams) {
  const waiting = new Map<number, (message: Rpc) => void>();
  const received: Rpc[] = [];
  const noise: string[] = [];
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (line.trim() === '') continue;
      let message: Rpc;
      try {
        message = JSON.parse(line) as Rpc;
      } catch {
        noise.push(line);
        continue;
      }
      received.push(message);
      if (typeof message.id === 'number') waiting.get(message.id)?.(message);
    }
  });
  const send = (message: Record<string, unknown>) =>
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  const request = (id: number, method: string, params?: unknown): Promise<Rpc> =>
    new Promise((resolveReply, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} (id ${id}) timed out`)), 60_000);
      waiting.set(id, (message) => {
        clearTimeout(timer);
        resolveReply(message);
      });
      send({ id, method, ...(params === undefined ? {} : { params }) });
    });
  return { send, request, received, noise };
}

test.describe('the packed texuli-mcp bin', () => {
  test('installs offline, answers initialize, tools/list and catalog.search, and exits on stdin close', async () => {
    test.setTimeout(600_000);
    const all = await ensureConsumerTarballs();
    const names = mcpClosure();
    expect(names).toContain('@texuli/tools');
    const byName = Object.fromEntries(names.map((name) => [name, all.byName[name] as string]));
    const subset: TarballMap = { dir: all.dir, byName, nameByDir: all.nameByDir };

    const dir = join(REPO_ROOT, 'tmp', 'consumers', 'mcp-stdio');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const dependencies: Record<string, string> = { svelte: PINNED.svelte };
    for (const [name, file] of Object.entries(byName)) dependencies[name] = `file:${file}`;
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify({ name: 'texuli-mcp-consumer', private: true, type: 'module', dependencies }, null, 2)}\n`
    );
    await execFileAsync('npm', installArgs('tarballs'), {
      cwd: dir,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    assertInstalledFromTarballs(dir, subset);
    const installed = JSON.parse(
      readFileSync(join(dir, 'node_modules', '@texuli', 'mcp', 'package.json'), 'utf8')
    ) as { version: string; bin: Record<string, string>; dependencies: Record<string, string> };
    expect(installed.bin).toEqual({ 'texuli-mcp': './dist/bin.js' });
    expect(installed.dependencies).toEqual({ '@texuli/tools': installed.version });

    const bin = join(dir, 'node_modules', '.bin', 'texuli-mcp');
    expect(existsSync(bin), 'npm links the texuli-mcp bin').toBe(true);
    expect(realpathSync(bin)).toBe(
      realpathSync(join(dir, 'node_modules', '@texuli', 'mcp', 'dist', 'bin.js'))
    );
    // The bin starts through its shebang, as a host's `npx` starts it.
    const version = await execFileAsync(bin, ['--version'], { cwd: dir });
    expect(version.stdout).toBe(`${installed.version}\n`);
    const help = await execFileAsync(bin, ['--help'], { cwd: dir });
    expect(help.stdout).toContain('claude mcp add texuli -- npx -y @texuli/mcp');

    const child = spawn(bin, [], { cwd: dir, env: process.env, stdio: 'pipe' });
    const stderr: string[] = [];
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => stderr.push(chunk));
    const exited = new Promise<number | null>((done) => child.on('exit', (code) => done(code)));
    const rpc = client(child);
    try {
      const init = await rpc.request(1, 'initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'texuli-consumer-test', version: '0.0.0' },
      });
      expect(init.error).toBeUndefined();
      expect(init.result?.protocolVersion).toBe(PROTOCOL_VERSION);
      expect(init.result?.serverInfo).toEqual({ name: 'texuli', version: installed.version });
      expect(init.result?.capabilities).toMatchObject({ tools: { listChanged: false } });
      rpc.send({ method: 'notifications/initialized' });

      const list = await rpc.request(2, 'tools/list');
      const tools = (list.result?.tools ?? []) as { name: string; inputSchema?: unknown }[];
      const toolNames = tools.map((tool) => tool.name);
      // An edge operation and a node operation: the local door serves both.
      expect(toolNames).toEqual(
        expect.arrayContaining(['catalog.search', 'blueprint.validate', 'document.export'])
      );
      for (const tool of tools) expect(tool.inputSchema, tool.name).toBeTruthy();

      const call = await rpc.request(3, 'tools/call', {
        name: 'catalog.search',
        arguments: { query: 'button' },
      });
      expect(call.error).toBeUndefined();
      expect(call.result?.isError).toBeFalsy();
      const content = call.result?.content as { type: string; text: string }[];
      expect(content[0]?.type).toBe('text');
      expect(JSON.parse(content[0]?.text ?? 'null')).toEqual(call.result?.structuredContent);
      expect(content[0]?.text).toContain('button');
    } finally {
      child.stdin.end();
    }
    const timeout = new Promise<'timeout'>((done) => setTimeout(() => done('timeout'), 30_000));
    expect(await Promise.race([exited, timeout]), 'exits cleanly when stdin closes').toBe(0);
    expect(rpc.noise, 'stdout carries only JSON-RPC').toEqual([]);
    expect(rpc.received.map((message) => message.id)).toEqual([1, 2, 3]);
    expect(stderr.join('')).toBe('');
  });
});
