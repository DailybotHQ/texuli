// @vitest-environment node
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PACKAGES, ExportResolver } from '../../../scripts/coverage-matrix.ts';
import { NON_COMPONENT_IMPORTS } from '../src/manifest/imports-map.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

function moduleOf(pkg: string, subpath: string): string {
  return subpath === '.' ? pkg : `${pkg}/${subpath.slice(2)}`;
}

function typeExports(file: string): string[] {
  if (!file.endsWith('.ts')) return [];
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const names: string[] = [];
  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const el of statement.exportClause.elements) {
        if (el.isTypeOnly || statement.isTypeOnly) names.push(el.name.text);
      }
    }
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      if (
        statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
        statement.name
      ) {
        names.push(statement.name.text);
      }
    }
  }
  return names;
}

function keyOf(module: string, name: string): string {
  return `${module}::${name}`;
}

describe('catalog imports (exactly one owner)', () => {
  const resolver = new ExportResolver(ROOT);
  const live = new Set<string>();
  for (const pkg of COMPONENT_PACKAGES.map((entry) => entry.name)) {
    for (const [subpath, file] of resolver.entries(pkg)) {
      const module = moduleOf(pkg, subpath);
      const names = new Set([...resolver.exportsOf(file).keys(), ...typeExports(file)]);
      names.delete('default');
      for (const name of names) live.add(keyOf(module, name));
    }
  }

  const owners = new Map<string, string>();
  const duplicate: string[] = [];
  for (const manifest of ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests)) {
    for (const entry of manifest.imports ?? []) {
      for (const name of entry.exports) {
        const key = keyOf(entry.module, name);
        const previous = owners.get(key);
        if (previous && previous !== manifest.id)
          duplicate.push(`${key} → ${previous} and ${manifest.id}`);
        else owners.set(key, manifest.id);
      }
    }
  }

  const nonComponent = new Set<string>();
  for (const entry of NON_COMPONENT_IMPORTS) {
    for (const name of entry.exports) nonComponent.add(keyOf(entry.module, name));
  }

  it('maps every component-package export to exactly one catalog id or a non-component listing', () => {
    expect(duplicate).toEqual([]);
    const unmapped = [...live].filter((key) => !owners.has(key) && !nonComponent.has(key)).sort();
    const missing = [...owners.keys()].filter((key) => !live.has(key)).sort();
    const overlap = [...owners.keys()].filter((key) => nonComponent.has(key)).sort();
    expect(unmapped, 'unmapped exports').toEqual([]);
    expect(missing, 'catalog imports that are not package exports').toEqual([]);
    expect(overlap, 'exports claimed as both a catalog id and non-component').toEqual([]);
  });

  it('lists compound parts on their parent catalog id', () => {
    expect(owners.get('texuli::CardHeader')).toBe('card');
    expect(owners.get('texuli/card::CardHeader')).toBe('card');
    expect(owners.get('texuli::Button')).toBe('button');
    expect(owners.get('texuli/button::Button')).toBe('button');
  });
});
