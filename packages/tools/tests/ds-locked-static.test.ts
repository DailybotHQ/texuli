/**
 * PLAN_016 T-t5-static (ADR-032): the static checker core reports each disallowed component,
 * prop value or state with a stable code and a location, from Svelte/TypeScript sources and
 * from blueprints, against the allow manifest and the real catalog.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  catalogImportIndex,
  checkLockedSources,
  checkLockedUsage,
  importedComponents,
  LOCKED_STATIC_CODES,
  LOCKED_STATIC_MAX_ISSUES,
  type LockedAllowManifest,
  type LockedCatalog,
  locationText,
  usageFromBlueprint,
  usageFromSource,
} from '../src/ds-check/locked-static.ts';

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/catalog/components.json'), 'utf8')
) as LockedCatalog;

const allowManifest: LockedAllowManifest = {
  allow: {
    button: {
      variants: ['default', 'outline'],
      sizes: ['sm', 'md'],
      states: ['hover', 'focus-visible'],
    },
    badge: {},
  },
};

const page = `<script lang="ts">
  import { Button, Card as Panel } from 'texuli';
  import { Badge } from 'texuli/badge';
  import type { ButtonProps } from 'texuli';
  import { cx } from 'texuli';
  let kind = $state('default');
</script>

<Button variant="outline" size="sm">Save</Button>
<Button variant="ghost">Cancel</Button>
<Button
  variant={'default'}
  size="xl"
  disabled
>Wide</Button>
<Button variant={kind}>Dynamic</Button>
<Panel variant="flat">Card</Panel>
<Badge variant="success" />
<div class={cx('x')}>plain</div>
`;

const codes = (report: ReturnType<typeof checkLockedUsage>) =>
  report.errors.map((e) => [e.code, e.component, e.path]);

describe('reading sources', () => {
  it('maps every catalog import (module and export) to its id', () => {
    const index = catalogImportIndex(catalog);
    expect(index.get('texuli#Button')).toBe('button');
    expect(index.get('texuli/button#Button')).toBe('button');
    expect(index.get('texuli#cx')).toBeUndefined();
    const locals = importedComponents(page, index);
    expect([...locals]).toEqual([
      ['Button', 'button'],
      ['Panel', 'card'],
      ['Badge', 'badge'],
    ]);
  });

  it('reads each tag of an imported component with its static attributes and location', () => {
    const usages = usageFromSource('src/Page.svelte', page, catalog);
    expect(usages.map((u) => [u.component, u.props, locationText(u.location)])).toEqual([
      ['button', { variant: 'outline', size: 'sm' }, 'src/Page.svelte:9:1'],
      ['button', { variant: 'ghost' }, 'src/Page.svelte:10:1'],
      ['button', { variant: 'default', size: 'xl', disabled: true }, 'src/Page.svelte:11:1'],
      ['button', { variant: { dynamic: true } }, 'src/Page.svelte:16:1'],
      ['card', { variant: 'flat' }, 'src/Page.svelte:17:1'],
      ['badge', { variant: 'success' }, 'src/Page.svelte:18:1'],
    ]);
  });

  it('counts a component a TypeScript module imports as one use at its import', () => {
    const usages = usageFromSource(
      'src/mount.ts',
      "import { mount } from 'svelte';\nimport { Badge } from 'texuli';\nmount(Badge, { target: document.body });\n",
      catalog
    );
    expect(usages).toEqual([
      { component: 'badge', props: {}, location: { file: 'src/mount.ts', line: 2, column: 10 } },
    ]);
    expect(usageFromSource('src/none.ts', "import { x } from './x.ts';", catalog)).toEqual([]);
  });

  it('reads blueprint trees with JSON paths', () => {
    const usages = usageFromBlueprint({
      tree: {
        id: 'layout-page',
        props: {},
        children: [
          { id: 'button', props: { variant: 'ghost', label: 'Go', disabled: true } },
          { id: 'badge', props: { variant: { $bind: 'x' } } },
          { id: 'nope' },
        ],
      },
    });
    expect(usages.map((u) => [u.component, locationText(u.location)])).toEqual([
      ['layout-page', '$.tree'],
      ['button', '$.tree.children[0]'],
      ['badge', '$.tree.children[1]'],
      ['nope', '$.tree.children[2]'],
    ]);
    expect(usages[2]?.props).toEqual({ variant: { dynamic: true } });
  });
});

describe('checking against the allow manifest and the catalog', () => {
  it('reports each disallowed component, value and state with its code and location', () => {
    const report = checkLockedSources({ 'src/Page.svelte': page }, { catalog, allowManifest });
    expect(report.ok).toBe(false);
    expect(codes(report)).toEqual([
      ['variant-not-allowed', 'button', 'src/Page.svelte:10:1'],
      ['unknown-size', 'button', 'src/Page.svelte:11:1'],
      ['state-not-allowed', 'button', 'src/Page.svelte:11:1'],
      ['not-allowed', 'card', 'src/Page.svelte:17:1'],
    ]);
    expect(report.errors[0]).toMatchObject({ value: 'ghost', hint: 'Allowed: default, outline.' });
    expect(report.errors[2]).toMatchObject({ value: 'disabled' });
    expect(report.warnings.map((w) => [w.code, w.path])).toEqual([
      ['dynamic-value', 'src/Page.svelte:16:1'],
    ]);
    expect(report.codes).toEqual([
      'not-allowed',
      'state-not-allowed',
      'unknown-size',
      'variant-not-allowed',
    ]);
    expect(report.components).toEqual({ button: 4, card: 1, badge: 1 });
    for (const code of report.codes) expect(LOCKED_STATIC_CODES).toContain(code);
  });

  it('checks only catalog membership when the design system is unlocked', () => {
    const report = checkLockedSources({ 'src/Page.svelte': page }, { catalog });
    expect(codes(report)).toEqual([['unknown-size', 'button', 'src/Page.svelte:11:1']]);
    expect(
      checkLockedSources({ 'src/Page.svelte': page }, { catalog, allowManifest: {} }).errors
    ).toHaveLength(1);
  });

  it('reports blueprint problems at their JSON paths, unknown components included', () => {
    const report = checkLockedUsage(
      usageFromBlueprint({
        tree: {
          id: 'button',
          props: { variant: 'outline', tone: 'success', loading: true },
          children: [{ id: 'nope' }, { id: 'badge', props: { variant: 'sparkly' } }],
        },
      }),
      { catalog, allowManifest }
    );
    expect(codes(report)).toEqual([
      ['state-not-allowed', 'button', '$.tree'],
      ['unknown-component', 'nope', '$.tree.children[0]'],
      ['unknown-variant', 'badge', '$.tree.children[1]'],
    ]);
  });

  it('allows the values an omitted list leaves open and ignores false states', () => {
    const report = checkLockedUsage(
      [
        {
          component: 'button',
          props: { tone: 'warning', disabled: false, loading: 'false' },
          location: { path: '$' },
        },
        { component: 'badge', props: { variant: 'destructive' }, location: { path: '$' } },
      ],
      { catalog, allowManifest }
    );
    expect(report).toMatchObject({ ok: true, errors: [], warnings: [] });
  });

  it('flags an empty allow list as allowing no value', () => {
    const report = checkLockedUsage(
      [{ component: 'button', props: { size: 'md' }, location: { path: '$' } }],
      {
        catalog,
        allowManifest: { allow: { button: { sizes: [] } } },
      }
    );
    expect(report.errors).toMatchObject([
      { code: 'size-not-allowed', hint: 'No size is allowed.' },
    ]);
  });

  it('flags category colors excluded by the design-system allow list', () => {
    const report = checkLockedSources(
      {
        'src/Labels.svelte':
          '<script>import { Badge } from \'texuli\';</script>\n<Badge color="chart-1" />',
      },
      { catalog, allowManifest: { allow: { badge: { colors: ['none'] } } } }
    );
    expect(codes(report)).toEqual([['color-not-allowed', 'badge', 'src/Labels.svelte:2:1']]);
  });

  it('caps the errors and stays total over hostile input', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      component: 'dialog',
      props: {},
      location: { file: 'a.svelte', line: i + 1, column: 1 },
    }));
    expect(checkLockedUsage(many, { catalog, allowManifest }).errors).toHaveLength(
      LOCKED_STATIC_MAX_ISSUES
    );
    expect(usageFromBlueprint(null)).toEqual([]);
    expect(usageFromBlueprint({ tree: 'x' })).toEqual([]);
    expect(usageFromSource('a.svelte', '<Button variant="x', catalog)).toEqual([]);
    expect(() =>
      usageFromSource(
        'a.svelte',
        "import { Button } from 'texuli';\n<Button variant={'a' ",
        catalog
      )
    ).not.toThrow();
  });
});
