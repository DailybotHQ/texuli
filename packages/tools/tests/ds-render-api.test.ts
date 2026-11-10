/**
 * PLAN_016 T-017-render: host IIFE path, data-tx-component color roots,
 * part/extension mapping, render-disabled-value, literal paths, baseline compare.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkBuiltHost,
  DS_CHECK_HOST_DIST,
  DS_CHECK_HOST_IIFE,
} from '../../../scripts/ds-check-host.ts';
import { PACKAGE_ASSETS } from '../../../scripts/packages.ts';
import { compareDsReport, dsReportFingerprint } from '../src/ds-check/baseline.ts';
import { parseDsCliArgs } from '../src/ds-check/cli.ts';
import { dsCheckComponentSelector } from '../src/ds-check/host.ts';
import {
  DS_MAP_DISABLED_VALUE,
  mapDesignSystemTree,
  resolveAllowedComponentId,
} from '../src/ds-check/map.ts';
import { renderIssues } from '../src/ds-check/render.ts';
import {
  DS_CHECK_COMPONENT_ATTRIBUTE,
  DS_TX_COMPONENT_ATTRIBUTE,
  type DsRenderRun,
  DS_CHECK_HOST_IIFE as HOST_IIFE_NAME,
} from '../src/ds-check/types.ts';

describe('prebuilt host IIFE', () => {
  it('is built into dist/ds-check/host.iife.js by verify:packages', () => {
    expect(DS_CHECK_HOST_IIFE).toBe('host.iife.js');
    expect(DS_CHECK_HOST_DIST).toBe(join('ds-check', 'host.iife.js'));
    expect(HOST_IIFE_NAME).toBe('host.iife.js');
    expect(typeof PACKAGE_ASSETS.tools).toBe('function');
    const dir = mkdtempSync(join(tmpdir(), 'texuli-ds-host-'));
    const fake = join(dir, 'host.iife.js');
    writeFileSync(fake, 'var TexuliDsCheckHost=(function(){function installDsCheckHost(){}})();');
    expect(checkBuiltHost(fake)).toEqual([]);
    writeFileSync(fake, 'console.log(1)');
    expect(checkBuiltHost(fake).length).toBeGreaterThan(0);
  });
});

describe('host color roots', () => {
  it('defaults to data-tx-component and still matches the sheet attribute', () => {
    expect(DS_TX_COMPONENT_ATTRIBUTE).toBe('data-tx-component');
    expect(dsCheckComponentSelector()).toContain(`[${DS_TX_COMPONENT_ATTRIBUTE}]`);
    expect(dsCheckComponentSelector()).toContain(`[${DS_CHECK_COMPONENT_ATTRIBUTE}]`);
    expect(dsCheckComponentSelector(DS_CHECK_COMPONENT_ATTRIBUTE)).toBe(
      `[${DS_CHECK_COMPONENT_ATTRIBUTE}]`
    );
  });
});

let window: Window | undefined;
afterEach(() => {
  window?.happyDOM.close();
  window = undefined;
});

function tree(markup: string) {
  window ??= new Window();
  const scope = window.document.createElement('main');
  scope.innerHTML = markup;
  window.document.body.append(scope);
  return scope as unknown as HTMLElement;
}

const allow = (ids: readonly string[], extra?: Record<string, Record<string, unknown>>) => ({
  allow: Object.fromEntries(ids.map((id) => [id, extra?.[id] ?? {}])),
});

describe('mapDesignSystemTree parts and composed ids', () => {
  it('resolves select-trigger to select and extension-composed ids to the parent', () => {
    expect(resolveAllowedComponentId('select-trigger', new Set(['select']))).toBe('select');
    expect(resolveAllowedComponentId('button-group', new Set(['button']))).toBeUndefined();
    expect(resolveAllowedComponentId('acme:select-trigger', new Set(['select']))).toBe('select');
    expect(resolveAllowedComponentId('acme:select-trigger', new Set(['acme:select']))).toBe(
      'acme:select'
    );
    expect(
      resolveAllowedComponentId('kpi', new Set(['acme:kpi-strip']), {
        composed: { kpi: 'acme:kpi-strip' },
      })
    ).toBe('acme:kpi-strip');

    const nested = tree(
      '<div data-tx-component="select"><button data-tx-component="select-trigger">Open</button></div>'
    );
    expect(mapDesignSystemTree(nested, { allowManifest: allow(['select']) }).ok).toBe(true);

    const portal = tree('<button data-tx-component="select-trigger">Open</button>');
    expect(mapDesignSystemTree(portal, { allowManifest: allow(['select']) }).ok).toBe(true);

    const group = tree('<div data-tx-component="button-group"><button>A</button></div>');
    expect(mapDesignSystemTree(group, { allowManifest: allow(['button']) }).codes).toContain(
      'not-allowed'
    );
  });

  it('flags a rendered axis the allow entry disables as render-disabled-value', () => {
    const report = mapDesignSystemTree(
      tree('<button data-tx-component="button" data-tx-variant="ghost">Save</button>'),
      { allowManifest: allow(['button'], { button: { variants: ['default', 'outline'] } }) }
    );
    expect(report.codes).toContain(DS_MAP_DISABLED_VALUE);
    expect(report.errors[0]).toMatchObject({
      code: 'render-disabled-value',
      message: expect.stringContaining('ghost'),
    });
    const ok = mapDesignSystemTree(
      tree('<button data-tx-component="button" data-tx-variant="outline">Save</button>'),
      { allowManifest: allow(['button'], { button: { variants: ['default', 'outline'] } }) }
    );
    expect(ok.ok).toBe(true);
  });
});

describe('literal-path renderIssues', () => {
  it('names the element in the issue path', () => {
    const run: DsRenderRun = {
      variant: null,
      mode: 'light',
      components: ['button'],
      pairs: [],
      literals: [
        {
          component: 'button',
          element: 'button.tx-button',
          property: 'color',
          value: 'rgb(255, 0, 0)',
        },
      ],
      checked: 1,
      axe: [],
      known: [],
      ok: false,
    };
    const issues = renderIssues(run);
    const literal = issues.find((issue) => issue.code === 'render-literal');
    expect(literal?.path).toContain('button.tx-button');
    expect(literal?.hint).toBe('button.tx-button');
  });
});

describe('baseline fingerprint and compareDsReport', () => {
  it('is stable for the same findings and fails when a new code appears', () => {
    const a = { findings: [{ code: 'unmapped', path: 'button' }] };
    const b = { findings: [{ path: 'button', code: 'unmapped' }] };
    expect(dsReportFingerprint(a)).toBe(dsReportFingerprint(b));
    const worse = {
      findings: [
        { code: 'unmapped', path: 'button' },
        { code: 'render-literal', path: '$.render["button"] button.tx-button' },
      ],
    };
    const compare = compareDsReport(a, worse);
    expect(compare.ok).toBe(false);
    expect(compare.added).toEqual([
      { code: 'render-literal', path: '$.render["button"] button.tx-button' },
    ]);
    expect(compareDsReport(worse, a).ok).toBe(true);
  });

  it('parses --baseline only with --locked --report', () => {
    expect(() => parseDsCliArgs(['check', 'a.json', '--baseline', 'old.json'])).toThrow(
      /--baseline needs --locked --report/
    );
    expect(
      parseDsCliArgs(['check', 'a.json', '--locked', '--report', '--baseline', 'old.json'])
    ).toMatchObject({ baseline: 'old.json', locked: true, report: true });
  });
});
