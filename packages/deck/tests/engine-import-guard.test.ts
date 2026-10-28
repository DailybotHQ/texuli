// @vitest-environment node
// @ts-expect-error Node ambient module types are excluded by this package tsconfig.
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node ambient module types are excluded by this package tsconfig.
import { dirname, extname, join, resolve } from 'node:path';
// @ts-expect-error Node ambient module types are excluded by this package tsconfig.
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const engineDir = resolve(fileURLToPath(new URL('../src/engine/', import.meta.url)));
// The engine may use the model and schema of its own package (ADR-009 keeps
// @texuli/deck dependency-free as a whole), never anything outside src/.
const packageSrcDir = resolve(fileURLToPath(new URL('../src/', import.meta.url)));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name: string) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : extname(path) === '.ts' ? [path] : [];
  });
}

function importViolations(source: string, file: string): string[] {
  const violations: string[] = [];
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  for (const statement of parsed.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  const visitDynamicImports = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visitDynamicImports);
  };
  visitDynamicImports(parsed);
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) {
      violations.push(`${file}: non-relative import ${specifier}`);
      continue;
    }
    const resolved = resolve(dirname(file), specifier);
    const separator = engineDir.includes('\\') ? '\\' : '/';
    if (!resolved.startsWith(`${packageSrcDir}${separator}`)) {
      violations.push(`${file}: import escapes the package source: ${specifier}`);
    }
  }
  return violations;
}

function topLevelDomGlobalViolations(source: string, file: string): string[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = new Set<string>();
  const visitRuntime = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isIdentifier(node) && ['window', 'document', 'navigator'].includes(node.text)) {
      const parent = node.parent;
      const isPropertyName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        ((ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === node);
      if (!isPropertyName) found.add(node.text);
    }
    ts.forEachChild(node, visitRuntime);
  };

  for (const statement of parsed.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isFunctionDeclaration(statement)
    )
      continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer) visitRuntime(declaration.initializer);
      }
    } else visitRuntime(statement);
  }
  return found.size > 0
    ? [`${file}: module-level browser global reference (${[...found].join(', ')})`]
    : [];
}

describe('engine import boundary', () => {
  it('keeps every engine import inside the engine subpath and free of module-level browser globals', () => {
    const files = sourceFiles(engineDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...importViolations(source, file), ...topLevelDomGlobalViolations(source, file)];
    });
    expect(violations).toEqual([]);
  });

  it('detects an injected forbidden import and a module-level browser access', () => {
    expect(
      importViolations("import { x } from '@texuli/core';", join(engineDir, 'fixture.ts'))
    ).toHaveLength(1);
    expect(
      importViolations("import { x } from '../model/index.ts';", join(engineDir, 'fixture.ts'))
    ).toEqual([]);
    expect(
      importViolations(
        "import { x } from '../../../slides/src/index.ts';",
        join(engineDir, 'fixture.ts')
      )
    ).toHaveLength(1);
    expect(
      importViolations(
        "const x = import('../../../player/src/index.ts');",
        join(engineDir, 'fixture.ts')
      )
    ).toHaveLength(1);
    expect(
      topLevelDomGlobalViolations('export const width = window.innerWidth;', 'fixture.ts')
    ).toHaveLength(1);
    expect(
      topLevelDomGlobalViolations(
        'export function getWidth() { return window.innerWidth; }',
        'fixture.ts'
      )
    ).toEqual([]);
  });
});

describe('engine import is inert until a host supplies a transport', () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  afterEach(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    originals.clear();
    vi.resetModules();
  });

  it('does not read browser or transport globals while the public engine module loads', async () => {
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
    const engine = await import('../src/engine/index.ts');
    expect(engine.presenterChannelName('unit-test')).toBe('texuli-deck-presenter/1:unit-test');
  });
});
