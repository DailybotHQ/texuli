// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const srcDir = resolve(fileURLToPath(new URL('../src/', import.meta.url)));
const syncDir = join(srcDir, 'sync');
/** The engine imports only these packages (ADR-011): nothing that touches the DOM. */
const ALLOWED = [
  '@texuli/core/editor-model',
  '@texuli/core/editor-markdown',
  '@texuli/core/url-policy',
  '@texuli/deck/model',
  '@texuli/deck/schema',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name: string) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : extname(path) === '.ts' ? [path] : [];
  });
}

function specifiers(source: string, file: string): string[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      out.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) out.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return out;
}

/** `window`, `document` and `navigator` used as free identifiers (not property or binding names). */
function freeGlobals(source: string, file: string): string[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && ['window', 'document', 'navigator'].includes(node.text)) {
      const parent = node.parent;
      const named =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        ((ts.isPropertyAssignment(parent) ||
          ts.isPropertySignature(parent) ||
          ts.isGetAccessorDeclaration(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isPropertyDeclaration(parent) ||
          ts.isShorthandPropertyAssignment(parent) ||
          ts.isBindingElement(parent) ||
          ts.isVariableDeclaration(parent) ||
          ts.isParameter(parent)) &&
          parent.name === node);
      if (!named) found.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return [...found];
}

/** Problems with one file's imports: packages outside the list, or sync leaving its folder. */
function violations(source: string, file: string): string[] {
  const out: string[] = [];
  const inSync = file.startsWith(`${syncDir}/`);
  for (const specifier of specifiers(source, file)) {
    if (!specifier.startsWith('.')) {
      if (inSync || !ALLOWED.includes(specifier)) out.push(`${file}: imports ${specifier}`);
      continue;
    }
    const target = resolve(dirname(file), specifier);
    if (!target.startsWith(`${srcDir}/`)) out.push(`${file}: escapes the package: ${specifier}`);
    else if (inSync && !target.startsWith(`${syncDir}/`))
      out.push(`${file}: sync imports outside sync: ${specifier}`);
  }
  if (freeGlobals(source, file).length > 0)
    out.push(`${file}: names a DOM global (${freeGlobals(source, file).join(', ')})`);
  return out;
}

describe('document engine import boundary', () => {
  it('imports only core and deck framework-free subpaths, and sync imports nothing else', () => {
    const files = sourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(15);
    expect(files.flatMap((file) => violations(readFileSync(file, 'utf8'), file))).toEqual([]);
  });

  it('detects forbidden imports', () => {
    const syncFile = join(syncDir, 'fixture.ts');
    const modelFile = join(srcDir, 'model', 'fixture.ts');
    expect(violations("import x from 'svelte';", modelFile)).toHaveLength(1);
    expect(violations("import { safeHref } from '@texuli/core/url-policy';", modelFile)).toEqual(
      []
    );
    expect(
      violations("import { safeHref } from '@texuli/core/url-policy';", syncFile)
    ).toHaveLength(1);
    expect(violations("import { t } from '../model/limits.ts';", syncFile)).toHaveLength(1);
    expect(violations("const x = import('../../../pages/src/index.ts');", modelFile)).toHaveLength(
      1
    );
    expect(violations('export const w = window.innerWidth;', modelFile)).toHaveLength(1);
  });
});

describe('importing the engine is inert', () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  afterEach(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    originals.clear();
    vi.resetModules();
  });

  it('reads no browser or transport global while its modules load', async () => {
    for (const key of ['window', 'document', 'navigator', 'BroadcastChannel']) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
      originals.set(key, descriptor);
      if (descriptor && !descriptor.configurable) continue;
      Object.defineProperty(globalThis, key, {
        configurable: true,
        get() {
          throw new Error(`Unexpected module-level read of ${key}`);
        },
      });
    }
    vi.resetModules();
    const root = await import('../src/index.ts');
    const sync = await import('../src/sync/index.ts');
    expect(root.DOCUMENT_FORMAT).toBe('texuli-document');
    expect(sync.syncChannelName('doc')).toBe('texuli-sync/1:doc');
  });
});
