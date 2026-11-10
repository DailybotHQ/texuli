/**
 * PLAN_016 T-0161-unscanned (0.16.1): a prototype that only imports a workspace
 * UI package reports those imports as unchecked; --scan-workspace reads them.
 */
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SpecCatalog } from '@texuli/spec';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDsCliArgs, runDsCli } from '../src/ds-check/cli.ts';
import { checkDesignSystemFull } from '../src/ds-check/full.ts';
import {
  isCatalogSpecifier,
  listUncheckedImports,
  packageNameOf,
  resolveRelativeImport,
} from '../src/ds-check/unscanned.ts';

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/catalog/components.json'), 'utf8')
) as SpecCatalog;

const doc = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.0.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
  allow: { button: { variants: ['default', 'outline'] } },
};

const app = `<script lang="ts">
  import { Page } from '@acme/ui';
  import Local from './Local.svelte';
  import { Button } from 'texuli';
</script>
<Page />
<Local />
<Button variant="outline">Save</Button>
`;

describe('unchecked import listing', () => {
  it('names workspace packages and missing local modules, never catalog specifiers', () => {
    expect(isCatalogSpecifier('texuli')).toBe(true);
    expect(isCatalogSpecifier('@texuli/data')).toBe(true);
    expect(packageNameOf('@acme/ui/page')).toBe('@acme/ui');
    expect(resolveRelativeImport('src/App.svelte', './Local.svelte')).toBe('src/Local.svelte');
    const listed = listUncheckedImports(
      { 'src/App.svelte': app },
      { workspacePackages: ['@acme/ui'] }
    );
    expect(listed).toEqual({ count: 2, imports: ['./Local.svelte', '@acme/ui'] });
  });

  it('drops a local module once its file is in the scan, and a workspace package once scanned', () => {
    const files = {
      'src/App.svelte': app,
      'src/Local.svelte': '<p>ok</p>',
      'workspace:@acme/ui/Page.svelte': '<p>page</p>',
    };
    expect(listUncheckedImports(files, { workspacePackages: ['@acme/ui'] }).imports).toEqual([
      '@acme/ui',
    ]);
    expect(
      listUncheckedImports(files, { workspacePackages: ['@acme/ui'], scanWorkspace: true }).count
    ).toBe(0);
  });
});

describe('checkDesignSystemFull reports unchecked imports', () => {
  it('lists them without failing the document when the prototype src is clean', async () => {
    const report = await checkDesignSystemFull(doc, {
      catalog,
      prototype: {
        files: { 'src/App.svelte': app },
        workspacePackages: ['@acme/ui'],
      },
    });
    expect(report.prototype?.unchecked).toEqual({
      count: 2,
      imports: ['./Local.svelte', '@acme/ui'],
    });
    expect(report.prototype?.components).toMatchObject({ button: 1 });
    expect(report.findings.some((f) => f.code === 'variant-not-allowed')).toBe(false);
  });

  it('scans workspace sources with scanWorkspace and then reports their violations', async () => {
    const page = `<script>import { Button } from 'texuli';</script>
<Button variant="ghost">Go</Button>
`;
    const report = await checkDesignSystemFull(doc, {
      catalog,
      prototype: {
        files: {
          'src/App.svelte': `<script>import { Page } from '@acme/ui';</script>\n<Page />\n`,
          'workspace:@acme/ui/Page.svelte': page,
        },
        workspacePackages: ['@acme/ui'],
        scanWorkspace: true,
      },
    });
    expect(report.prototype?.unchecked.count).toBe(0);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'variant-not-allowed', value: 'ghost' }),
      ])
    );
  });
});

describe('texuli ds check --scan-workspace', () => {
  it('needs --prototype and is off by default', () => {
    expect(() => parseDsCliArgs(['check', 'a.json', '--scan-workspace'])).toThrow(
      /--scan-workspace needs --prototype/
    );
    expect(
      parseDsCliArgs(['check', 'a.json', '--locked', '--prototype', './src', '--scan-workspace'])
    ).toMatchObject({ scanWorkspace: true, prototype: './src' });
    expect(parseDsCliArgs(['check', 'a.json', '--prototype', './src']).scanWorkspace).toBe(false);
  });
});

let dir: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('CLI walks a workspace package with --scan-workspace', () => {
  it('reports @acme/ui unchecked without the flag, and scans it with the flag', async () => {
    dir = await mkdtemp(join(tmpdir(), 'texuli-unscanned-'));
    const ui = join(dir, 'packages', 'ui');
    const src = join(dir, 'apps', 'web', 'src');
    await mkdir(ui, { recursive: true });
    await mkdir(src, { recursive: true });
    await writeFile(
      join(dir, 'pnpm-workspace.yaml'),
      "packages:\n  - 'packages/*'\n  - 'apps/*'\n"
    );
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'harborline', private: true })
    );
    await writeFile(join(ui, 'package.json'), JSON.stringify({ name: '@acme/ui', private: true }));
    await writeFile(
      join(ui, 'Page.svelte'),
      `<script>import { Button } from 'texuli';</script>\n<Button variant="ghost">Go</Button>\n`
    );
    await writeFile(
      join(src, 'App.svelte'),
      `<script>import { Page } from '@acme/ui';</script>\n<Page />\n`
    );
    await writeFile(join(dir, 'brand.json'), JSON.stringify(doc));

    const invoke = async (extra: string[]) => {
      const stdout: string[] = [];
      process.exitCode = undefined;
      await runDsCli(['check', join(dir as string, 'brand.json'), ...extra], {
        cwd: dir,
        stdout: { write: (chunk: string) => stdout.push(chunk) },
        stderr: { write: () => undefined },
      });
      return JSON.parse(stdout.join('')) as {
        prototype?: { unchecked?: { count: number; imports: string[] } };
        findings: { code: string }[];
      };
    };

    const listed = await invoke(['--locked', '--prototype', src, '--json', '--report']);
    expect(listed.prototype?.unchecked).toEqual({ count: 1, imports: ['@acme/ui'] });
    expect(listed.findings.some((f) => f.code === 'variant-not-allowed')).toBe(false);

    const scanned = await invoke([
      '--locked',
      '--prototype',
      src,
      '--scan-workspace',
      '--json',
      '--report',
    ]);
    expect(scanned.prototype?.unchecked?.count).toBe(0);
    expect(scanned.findings.some((f) => f.code === 'variant-not-allowed')).toBe(true);
  });
});
