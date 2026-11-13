/**
 * The remote MCP Function must never import a runtime-'node' operation
 * module or the heavy @texuli/emojis catalog / search / legacy tables.
 * Cloudflare does not split the worker, so a dynamic import still deploys.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRY = join(ROOT, 'functions/mcp.ts');
const FORBIDDEN_EMOJI = /@texuli\/emojis\/(catalog|search|legacy)/;
const NODE_RUNTIME = /\bruntime:\s*['"]node['"]/;

function collectImports(source: string): string[] {
  const specs: string[] = [];
  const fromRe = /(?:^|\n)import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(fromRe)) {
    const clause = match[1] ?? '';
    if (/^\s*type\s/.test(clause)) continue;
    specs.push(match[2] ?? '');
  }
  const dynamicRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(dynamicRe)) specs.push(match[1] ?? '');
  return specs;
}

function resolveWorkspace(fromFile: string, spec: string): string | undefined {
  if (spec.startsWith('.')) {
    const base = resolve(dirname(fromFile), spec);
    for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
      if (existsSync(candidate)) return candidate;
    }
    return undefined;
  }
  const at = spec.match(/^@texuli\/([^/]+)(?:\/(.+))?$/);
  if (!at) return undefined;
  const pkg = at[1] ?? '';
  const subpath = at[2] ? `./${at[2]}` : '.';
  const manifestPath = join(ROOT, 'packages', pkg, 'package.json');
  if (!existsSync(manifestPath)) return undefined;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Record<string, string | { default?: string; types?: string }>;
  };
  const target = manifest.exports?.[subpath] ?? manifest.exports?.[`./${at[2] ?? ''}`];
  const file =
    typeof target === 'string' ? target : (target?.default ?? target?.types ?? undefined);
  if (!file) return undefined;
  const resolved = resolve(ROOT, 'packages', pkg, file);
  return existsSync(resolved) ? resolved : undefined;
}

function walk(entry: string): { files: string[]; specs: string[] } {
  const files: string[] = [];
  const specs: string[] = [];
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || !file.endsWith('.ts')) continue;
    seen.add(file);
    files.push(file);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const spec of collectImports(source)) {
      specs.push(spec);
      const next = resolveWorkspace(file, spec);
      if (next) queue.push(next);
    }
  }
  return { files, specs };
}

describe('functions/mcp import graph', () => {
  it('never reaches a node operation module or the emoji catalog tables', () => {
    const { files, specs } = walk(ENTRY);
    expect(files.some((file) => file.endsWith('functions/mcp.ts'))).toBe(true);
    const forbiddenSpecs = specs.filter((spec) => FORBIDDEN_EMOJI.test(spec));
    expect(forbiddenSpecs, forbiddenSpecs.join(', ')).toEqual([]);
    const nodeModules = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return NODE_RUNTIME.test(source);
    });
    expect(
      nodeModules.map((file) => relative(ROOT, file)),
      'runtime node modules in the Function graph'
    ).toEqual([]);
    expect(
      files.some((file) => file.includes(`${join('ops', 'emoji-catalog')}`)),
      'emoji-catalog.ts'
    ).toBe(false);
    expect(
      files.some((file) => file.includes(`${join('ops', 'emoji-convert-node')}`)),
      'emoji-convert-node.ts'
    ).toBe(false);
    expect(
      files.some((file) => /tools[/\\]src[/\\]ops[/\\]index\.ts$/.test(file)),
      'packages/tools/src/ops/index.ts'
    ).toBe(false);
  });

  it('starts at the Pages Function entry', () => {
    expect(isAbsolute(ENTRY)).toBe(true);
    expect(existsSync(ENTRY)).toBe(true);
  });
});
