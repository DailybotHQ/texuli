// @vitest-environment node
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PACKAGES, ExportResolver } from '../../../scripts/coverage-matrix.ts';
import { NO_COMPONENT_EXPORT, NON_COMPONENT_IMPORTS } from '../src/manifest/imports-map.ts';
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
  /** Value exports only (components, functions, constants): not types. */
  const liveValues = new Set<string>();
  const auditedPackages = [...COMPONENT_PACKAGES.map((entry) => entry.name), '@texuli/primitives'];
  for (const pkg of auditedPackages) {
    for (const [subpath, file] of resolver.entries(pkg)) {
      const module = moduleOf(pkg, subpath);
      const values = new Set(resolver.exportsOf(file).keys());
      const names = new Set([...values, ...typeExports(file)]);
      names.delete('default');
      for (const name of names) {
        live.add(keyOf(module, name));
        if (values.has(name)) liveValues.add(keyOf(module, name));
      }
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

  /** Every export of any workspace module (default included: a direct `.svelte` subpath has only that). */
  const exportsCache = new Map<string, Set<string>>();
  const exportsOfModule = (module: string): Set<string> => {
    const cached = exportsCache.get(module);
    if (cached) return cached;
    const match = /^(@texuli\/[^/]+|texuli)(?:\/(.+))?$/.exec(module);
    const names = new Set<string>();
    if (match) {
      const [, pkg, rest] = match as unknown as [string, string, string | undefined];
      for (const [subpath, file] of resolver.entries(pkg)) {
        if (subpath !== (rest ? `./${rest}` : '.')) continue;
        for (const name of resolver.exportsOf(file).keys()) names.add(name);
        for (const name of typeExports(file)) names.add(name);
      }
    }
    exportsCache.set(module, names);
    return names;
  };
  const manifests = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests);
  const pascal = (id: string) =>
    id
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

  const nonComponent = new Set<string>();
  for (const entry of NON_COMPONENT_IMPORTS) {
    for (const name of entry.exports) nonComponent.add(keyOf(entry.module, name));
  }

  it('maps every component-package export to exactly one catalog id or a non-component listing', () => {
    expect(duplicate).toEqual([]);
    const unmapped = [...live].filter((key) => !owners.has(key) && !nonComponent.has(key)).sort();
    // Any workspace module counts here (canvas, forms, sheets, workflows, pages own components too).
    const missing = [...owners.keys()]
      .filter((key) => {
        const [module, name] = key.split('::') as [string, string];
        return !exportsOfModule(module).has(name);
      })
      .sort();
    const overlap = [...owners.keys()].filter((key) => nonComponent.has(key)).sort();
    expect(unmapped, 'unmapped exports').toEqual([]);
    expect(missing, 'catalog imports that are not package exports').toEqual([]);
    expect(overlap, 'exports claimed as both a catalog id and non-component').toEqual([]);
  });

  it('gives an export named PascalCase(id) in the id’s own package to that id', () => {
    // dialog → Dialog, select → Select, chat-message → ChatMessage …: never a sibling id.
    // Value exports only: a type that happens to share the name (LayoutSettings) is not the component.
    const wrong: string[] = [];
    for (const manifest of manifests) {
      const name = pascal(manifest.id);
      for (const key of liveValues) {
        const [module, exported] = key.split('::') as [string, string];
        if (exported !== name) continue;
        if (module !== manifest.package && !module.startsWith(`${manifest.package}/`)) continue;
        if (owners.get(key) !== manifest.id)
          wrong.push(`${key} → ${owners.get(key) ?? 'none'}, not ${manifest.id}`);
      }
    }
    expect(wrong).toEqual([]);
    for (const [key, id] of [
      ['texuli::Dialog', 'dialog'],
      ['texuli/dialog::Dialog', 'dialog'],
      ['texuli::Select', 'select'],
      ['texuli/select::Select', 'select'],
      ['texuli::Drawer', 'drawer'],
      ['texuli/sheet::Drawer', 'drawer'],
      ['texuli::Sidebar', 'sidebar'],
      ['texuli/sidebar::Sidebar', 'sidebar'],
      ['@texuli/chat::ChatMessageDisplay', 'chat-message'],
    ] as const)
      expect(owners.get(key), key).toBe(id);
  });

  it('gives every catalog id its imports, or a reason it has no component export', () => {
    const ids = manifests.map((manifest) => manifest.id);
    const withImports = manifests.filter((m) => (m.imports ?? []).length > 0).map((m) => m.id);
    const reasoned = Object.keys(NO_COMPONENT_EXPORT);
    expect(ids.filter((id) => !withImports.includes(id) && !reasoned.includes(id))).toEqual([]);
    expect(reasoned.filter((id) => withImports.includes(id))).toEqual([]);
    expect(reasoned.filter((id) => !ids.includes(id))).toEqual([]);
    for (const [id, reason] of Object.entries(NO_COMPONENT_EXPORT)) {
      expect(reason.length, id).toBeGreaterThan(20);
      // A reasoned id really has no export of its own name in its package.
      const pkg = manifests.find((m) => m.id === id)?.package ?? '';
      expect(
        [...liveValues].filter((key) => key.endsWith(`::${pascal(id)}`) && key.startsWith(pkg)),
        id
      ).toEqual([]);
    }
  });

  it('lists compound parts on their parent catalog id', () => {
    expect(owners.get('texuli::CardHeader')).toBe('card');
    expect(owners.get('texuli/card::CardHeader')).toBe('card');
    expect(owners.get('texuli::Button')).toBe('button');
    expect(owners.get('texuli/button::Button')).toBe('button');
  });

  it('maps every sheet and navigation compound export to its owning catalog id', () => {
    const cases: readonly [string, string, readonly string[]][] = [
      ['texuli/sheet', 'detail-panel', ['DetailPanel', 'DetailPanelContent']],
      ['texuli/sheet', 'drawer', ['Drawer', 'DrawerContent']],
      ['texuli/sheet', 'responsive-modal', ['ResponsiveModal', 'ResponsiveModalContent']],
      [
        'texuli/sheet',
        'sheet',
        [
          'Panel',
          'Sheet',
          'SheetBody',
          'SheetCloseButton',
          'SheetContent',
          'SheetFooter',
          'SheetHeader',
          'SheetOverlay',
        ],
      ],
      [
        'texuli/navigation',
        'navigation-menu',
        [
          'NavigationMenu',
          'NavigationMenuContent',
          'NavigationMenuIndicator',
          'NavigationMenuItem',
          'NavigationMenuLink',
          'NavigationMenuList',
          'NavigationMenuRoot',
          'NavigationMenuTrigger',
          'NavigationMenuViewport',
        ],
      ],
      [
        'texuli/navigation',
        'pagination',
        [
          'Pagination',
          'PaginationEllipsis',
          'PaginationNext',
          'PaginationPage',
          'PaginationPrevious',
          'PaginationRoot',
        ],
      ],
    ];
    for (const [module, id, exports] of cases)
      for (const name of exports) expect(owners.get(keyOf(module, name)), name).toBe(id);
  });
});
