// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalogWithImports } from '@texuli/catalog/build';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';
import { describe, expect, it } from 'vitest';
import {
  catalogImportIndex,
  checkLockedUsage,
  type LockedCatalog,
  usageFromSource,
} from '../src/ds-check/locked-static.ts';

const ROOT = join(import.meta.dirname, '../../..');
const { catalog: builtCatalog } = await buildCatalogWithImports(ALL_MANIFEST_GROUPS);
const catalog: LockedCatalog = {
  components: builtCatalog.entries.map(({ id, imports }) => ({
    id,
    imports,
  })),
};

const namespaces = [
  {
    id: 'dropdown-menu',
    module: 'texuli/menus',
    name: 'DropdownMenu',
    file: 'packages/texuli/src/components/menus/index.ts',
  },
  {
    id: 'multi-select',
    module: 'texuli/combobox',
    name: 'MultiSelect',
    file: 'packages/texuli/src/components/combobox/index.ts',
  },
  {
    id: 'select',
    module: 'texuli/select',
    name: 'Select',
    file: 'packages/texuli/src/components/select/index.ts',
  },
  {
    id: 'tabs',
    module: '@texuli/primitives/tabs',
    name: 'Tabs',
    file: 'packages/primitives/src/tabs/index.ts',
  },
] as const;

function members(namespace: (typeof namespaces)[number]): string[] {
  const source = readFileSync(join(ROOT, namespace.file), 'utf8');
  const declaration =
    new RegExp(`export const ${namespace.name}:\\s*\\{([\\s\\S]*?)\\}\\s*=`, 'u').exec(
      source
    )?.[1] ??
    new RegExp(`export const ${namespace.name}\\s*=\\s*\\{([\\s\\S]*?)\\}`, 'u').exec(source)?.[1];
  if (!declaration) throw new Error(`Missing compound namespace ${namespace.name}`);
  return [
    ...declaration.matchAll(/^\s*(?:readonly\s+)?([A-Z][A-Za-z0-9]*)\s*(?::[^;\n]+)?[,;]?\s*$/gmu),
  ].map((match) => match[1] as string);
}

describe('locked design-system compound parts', () => {
  it('maps every exported namespace member to its parent catalog id', () => {
    const index = catalogImportIndex(catalog);
    for (const namespace of namespaces) {
      expect(index.get(`${namespace.module}#${namespace.name}`)).toBe(namespace.id);
      const source = [
        `import { ${namespace.name} as Parts } from '${namespace.module}';`,
        ...members(namespace).map((member) => `<Parts.${member} />`),
      ].join('\n');
      const usages = usageFromSource('src/Compound.svelte', source, catalog);
      expect(usages.map((usage) => usage.component)).toEqual(
        members(namespace).map(() => namespace.id)
      );

      const allowed = checkLockedUsage(usages, {
        catalog,
        allowManifest: { allow: { [namespace.id]: {} } },
      });
      expect(allowed.errors, namespace.name).toEqual([]);

      const refused = checkLockedUsage(usages, { catalog, allowManifest: { allow: {} } });
      expect(
        refused.errors.map(({ code, component }) => [code, component]),
        namespace.name
      ).toEqual(members(namespace).map(() => ['not-allowed', namespace.id]));
    }
  });
});
