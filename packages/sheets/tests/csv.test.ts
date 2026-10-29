// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CSV_LIMITS,
  csvToSheet,
  isRiskyCsvText,
  parseCsv,
  sheetToCsv,
  toCsv,
} from '../src/csv/index.ts';
import { createWorkbook, displayValue } from '../src/model/index.ts';

describe('parseCsv', () => {
  it('reads RFC 4180 fields, quotes, line breaks and the usual leniencies', () => {
    const cases: [string, string[][], ',' | ';' | '\t'][] = [
      ['a,b,c', [['a', 'b', 'c']], ','],
      [
        'a,b\r\nc,d\r\n',
        [
          ['a', 'b'],
          ['c', 'd'],
        ],
        ',',
      ],
      [
        'a,b\nc,d',
        [
          ['a', 'b'],
          ['c', 'd'],
        ],
        ',',
      ],
      ['a\rb', [['a'], ['b']], ','],
      ['"a,b",c', [['a,b', 'c']], ','],
      ['"say ""hi""",x', [['say "hi"', 'x']], ','],
      ['"two\nlines",x', [['two\nlines', 'x']], ','],
      ['a,,c,', [['a', '', 'c', '']], ','],
      [',', [['', '']], ','],
      ['""', [['']], ','],
      ['﻿a,b', [['a', 'b']], ','],
      ['a;b', [['a', 'b']], ';'],
      ['a\tb', [['a', 'b']], '\t'],
      ['5" screen,x', [['5" screen', 'x']], ','],
      ['', [], ','],
    ];
    for (const [text, rows, delimiter] of cases) {
      const result = parseCsv(text, { delimiter });
      expect(result.ok, JSON.stringify(text)).toBe(true);
      if (result.ok) expect(result.rows, JSON.stringify(text)).toEqual(rows);
    }
  });

  it('stops at the first cap or malformed quote it meets', () => {
    const cases: [string, string][] = [
      ['"open', 'unterminated-quote'],
      ['a\n"b,c\nd', 'unterminated-quote'],
      [`${'x'.repeat(CSV_LIMITS.field + 1)}`, 'field-too-long'],
      [`"${'x'.repeat(CSV_LIMITS.field + 1)}"`, 'field-too-long'],
      [','.repeat(CSV_LIMITS.columns), 'too-many-columns'],
      ['a\n'.repeat(CSV_LIMITS.rows + 1), 'too-many-rows'],
    ];
    for (const [text, code] of cases) {
      const result = parseCsv(text);
      expect(result.ok, code).toBe(false);
      if (!result.ok) expect(result.issue.code).toBe(code);
    }
    expect(parseCsv('a\n"b').ok || '').toBe('');
    const line = parseCsv('a\nb\n"c');
    expect(line.ok ? 0 : line.issue.line).toBe(3);
  });
});

describe('CSV export', () => {
  it('neutralizes text a spreadsheet would run as a formula, and keeps numbers', () => {
    const cases: [unknown, string][] = [
      ['=HYPERLINK("https://evil.example","x")', `"'=HYPERLINK(""https://evil.example"",""x"")"`],
      ['+1+2', "'+1+2"],
      ['-2+3', "'-2+3"],
      ['@SUM(A1)', "'@SUM(A1)"],
      ['\t=1', "'\t=1"],
      ['\r=1', `"'\r=1"`],
      ['＝1+1', "'＝1+1"],
      ['safe text', 'safe text'],
      ['a=b', 'a=b'],
      [-5, '-5'],
      [0.1 + 0.2, '0.3'],
      [true, 'TRUE'],
      [null, ''],
      [{ error: '#DIV/0!' }, '#DIV/0!'],
    ];
    for (const [value, field] of cases) {
      expect(toCsv([[value as never]]), JSON.stringify(value)).toBe(field);
      if (typeof value === 'string')
        expect(isRiskyCsvText(value)).toBe(field.replace(/^"/, '').startsWith("'"));
    }
    expect(toCsv([['=1']], { neutralize: false })).toBe('=1');
    expect(toCsv([['a', 'b'], ['c']], { delimiter: ';', newline: '\n' })).toBe('a;b\nc');
  });

  it('exports computed values (or inputs, neutralized) trimmed to the used range', () => {
    const workbook = createWorkbook({
      format: 'texuli-sheet',
      formatVersion: 1,
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          rows: 10,
          columns: 10,
          cells: {
            A1: 'Item',
            B1: 'Cost',
            A2: 'Desk, oak',
            B2: 120,
            B3: '=SUM(B2:B2)*2',
            A3: '-tax',
          },
        },
      ],
    });
    expect(sheetToCsv(workbook, 's1')).toBe('Item,Cost\r\n"Desk, oak",120\r\n\'-tax,240');
    expect(sheetToCsv(workbook, 's1', { values: 'inputs', newline: '\n' })).toBe(
      'Item,Cost\n"Desk, oak",120\n\'-tax,\'=SUM(B2:B2)*2'
    );
    expect(sheetToCsv(workbook, 'missing')).toBe('');
  });
});

describe('csvToSheet', () => {
  it('imports typed values and keeps formulas as text unless asked', () => {
    const text = 'Item,Cost,Paid\nDesk,120,TRUE\nTax,=B2*0.1,false\n';
    const plain = csvToSheet(text);
    expect(plain.ok).toBe(true);
    if (!plain.ok) return;
    expect(plain.sheet.sheets[0]?.cells).toMatchObject({
      B2: 120,
      C2: true,
      B3: "'=B2*0.1",
      C3: false,
    });
    const workbook = createWorkbook(plain.sheet);
    expect(displayValue(workbook.value('sheet1', 2, 1))).toBe('=B2*0.1');

    const live = csvToSheet(text, { formulas: true, name: 'Costs', title: 'Office' });
    expect(live.ok).toBe(true);
    if (!live.ok) return;
    expect(createWorkbook(live.sheet).value('sheet1', 2, 1)).toBe(12);

    const raw = csvToSheet('12,TRUE', { types: false });
    expect(raw.ok && raw.sheet.sheets[0]?.cells).toEqual({ A1: '12', B1: 'TRUE' });
  });

  it('round-trips export and import without ever running exported text', () => {
    const source = createWorkbook({
      format: 'texuli-sheet',
      formatVersion: 1,
      sheets: [
        {
          id: 's1',
          name: 'S',
          rows: 3,
          columns: 2,
          cells: { A1: "'=cmd|'/C calc'!A0", A2: 'note', B2: 4 },
        },
      ],
    });
    const back = csvToSheet(sheetToCsv(source, 's1'), { formulas: true });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const workbook = createWorkbook(back.sheet);
    expect(workbook.value('sheet1', 0, 0)).toBe("=cmd|'/C calc'!A0");
    expect(workbook.value('sheet1', 1, 1)).toBe(4);
  });

  it('refuses malformed CSV and unsafe text through the sheet validator', () => {
    expect(csvToSheet('"open').ok).toBe(false);
    expect(csvToSheet('"open').csv?.code).toBe('unterminated-quote');
    const bidi = csvToSheet('a‮b');
    expect(bidi.ok).toBe(false);
    expect(bidi.issues[0]?.code).toBe('unsafe-text');
  });
});
