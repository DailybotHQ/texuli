import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { SPEC_PROP_REFS } from '../src/contract.ts';
import type { Schema } from '../src/dialect.ts';
import { validateBlueprint } from '../src/validate.ts';
import { json } from './helpers.ts';

/**
 * Spec 0.8.0 (ADR-012, ADR-015): the `spreadsheet` catalog id with its
 * `$defs.sheet` shape. The contract checks the envelope of the sheet (format,
 * version, members, the tab cap and each tab's sizes); cell inputs and the
 * formula grammar are `@texuli/sheets/model`'s, run by `validateDraft`.
 */
const documents = {
  blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
  catalog: json<SpecCatalog>('catalog/components.json'),
};
const fixture = json<{ blueprint: { tree: { props: { sheet: Record<string, unknown> } } } }>(
  'fixtures/invalid/sheet-format.json'
).blueprint;
const tab = (fixture.tree.props.sheet.sheets as Record<string, unknown>[])[0] as Record<
  string,
  unknown
>;
const sheet = { ...fixture.tree.props.sheet, format: 'texuli-sheet' };
const codes = (value: unknown) =>
  validateBlueprint(
    { ...fixture, tree: { ...fixture.tree, props: { ...fixture.tree.props, sheet: value } } },
    documents
  ).diagnostics.map((d) => d.code);

describe('spec 0.8.0: spreadsheets', () => {
  it('lists the spreadsheet id with its sheet prop', () => {
    expect(SPEC_PROP_REFS).toContain('sheet');
    const entry = documents.catalog.components.find((component) => component.id === 'spreadsheet');
    expect(entry?.emit).toContain('untrusted');
    expect(entry?.props.find((prop) => prop.name === 'sheet')?.schema).toEqual({
      $ref: '#/$defs/sheet',
    });
  });

  it('accepts a sheet envelope and refuses another format, extra members and bad sizes', () => {
    expect(codes(sheet)).toEqual([]);
    const cases: [string, unknown][] = [
      ['another format', { ...sheet, format: 'texuli-xlsx' }],
      ['another version', { ...sheet, formatVersion: 2 }],
      ['a script member', { ...sheet, script: 'alert(1)' }],
      ['no tabs', { ...sheet, sheets: [] }],
      [
        '17 tabs',
        { ...sheet, sheets: Array.from({ length: 17 }, (_, i) => ({ ...tab, id: `t${i}` })) },
      ],
      ['a macro on a tab', { ...sheet, sheets: [{ ...tab, macro: 'Sub Run()' }] }],
      ['too many rows', { ...sheet, sheets: [{ ...tab, rows: 10_001 }] }],
      ['fractional columns', { ...sheet, sheets: [{ ...tab, columns: 2.5 }] }],
      ['no name', { ...sheet, sheets: [{ ...tab, name: undefined }] }],
      ['text', 'a sheet'],
    ];
    for (const [label, value] of cases) expect(codes(value), label).toEqual(['prop-type']);
  });
});
