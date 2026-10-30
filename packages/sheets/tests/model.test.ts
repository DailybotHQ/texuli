// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createSheet,
  createWorkbook,
  displayValue,
  inputText,
  loadUntrustedSheet,
  parseSheetInput,
  SHEET_LIMITS,
  type SheetDocument,
  type SheetInput,
  validateSheet,
  type Workbook,
} from '../src/model/index.ts';

function book(cells: Record<string, SheetInput>, extra: SheetDocument['sheets'] = []): Workbook {
  return createWorkbook({
    format: 'texuli-sheet',
    formatVersion: 1,
    meta: { title: 'Budget' },
    sheets: [{ id: 's1', name: 'Budget', rows: 20, columns: 6, cells }, ...extra],
  });
}

/** The display text of A1-addressed cells on sheet `s1`. */
function show(workbook: Workbook, ...addresses: string[]): string[] {
  return addresses.map((address) => {
    const col = address.charCodeAt(0) - 65;
    const row = Number(address.slice(1)) - 1;
    return displayValue(workbook.value('s1', row, col));
  });
}

describe('workbook', () => {
  it('computes values, text, booleans and formulas across sheets', () => {
    const workbook = book(
      {
        A1: 'Rent',
        B1: 1200,
        A2: 'Food',
        B2: 450.5,
        B3: '=SUM(B1:B2)',
        B4: "=B3*'Q1 plan'!A1",
        C1: true,
        C2: "'=not a formula",
        C3: '=C1',
      },
      [{ id: 'q1', name: 'Q1 plan', rows: 5, columns: 5, cells: { A1: 3 } }]
    );
    expect(show(workbook, 'A1', 'B3', 'B4', 'C1', 'C2', 'C3')).toEqual([
      'Rent',
      '1650.5',
      '4951.5',
      'TRUE',
      '=not a formula',
      'TRUE',
    ]);
    expect(workbook.input('s1', 1, 2)).toBe("'=not a formula");
    expect(workbook.title).toBe('Budget');
  });

  it('recalculates only the dirty subgraph of an edit', () => {
    // 1,000 independent formulas, plus a chain of three that reads A1.
    const cells: Record<string, SheetInput> = {
      A1: 1,
      B1: '=A1*2',
      C1: '=B1+1',
      D1: '=SUM(A1:A3)',
    };
    const workbook = createWorkbook({
      format: 'texuli-sheet',
      formatVersion: 1,
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          rows: 1000,
          columns: 6,
          cells: Object.fromEntries([
            ...Object.entries(cells),
            ...Array.from({ length: 1000 }, (_, i) => [`F${i + 1}`, `=E${i + 1}+1`]),
          ]),
        },
      ],
    });
    expect(workbook.lastPass.evaluated).toBe(1003);
    const pass = workbook.setInput('s1', 0, 0, 5);
    expect(pass.evaluated).toBe(3);
    expect(pass.changed.map((cell) => `${cell.row}:${cell.col}`).sort()).toEqual([
      '0:0',
      '0:1',
      '0:2',
      '0:3',
    ]);
    expect([
      workbook.value('s1', 0, 1),
      workbook.value('s1', 0, 2),
      workbook.value('s1', 0, 3),
    ]).toEqual([10, 11, 5]);
    // A cell inside a range dirties the formula reading the range, not its neighbors.
    expect(workbook.setInput('s1', 2, 0, 4).evaluated).toBe(1);
    expect(workbook.value('s1', 0, 3)).toBe(9);
    // A cell nothing reads costs no evaluation.
    expect(workbook.setInput('s1', 500, 3, 'x').evaluated).toBe(0);
  });

  it('evaluates in dependency order whatever the sheet order', () => {
    const workbook = book({ A1: '=A2+1', A2: '=A3+1', A3: '=A4+1', A4: 1 });
    expect(show(workbook, 'A1', 'A2', 'A3')).toEqual(['4', '3', '2']);
    workbook.setInput('s1', 3, 0, 10);
    expect(show(workbook, 'A1')).toEqual(['13']);
  });

  it('reports cycles as #CYCLE! (and what reads them), and recovers when a cycle breaks', () => {
    const workbook = book({ A1: '=B1+1', B1: '=A1+1', C1: '=A1*2', D1: '=D1', E1: 5, F1: '=E1' });
    expect(show(workbook, 'A1', 'B1', 'C1', 'D1', 'F1')).toEqual([
      '#CYCLE!',
      '#CYCLE!',
      '#CYCLE!',
      '#CYCLE!',
      '5',
    ]);
    expect(workbook.lastPass.cycles).toBe(3);
    const pass = workbook.setInput('s1', 0, 1, 10);
    expect(pass.cycles).toBe(0);
    expect(show(workbook, 'A1', 'B1', 'C1')).toEqual(['11', '10', '22']);
    // A cycle made by an edit is found on the dirty subgraph.
    workbook.setInput('s1', 0, 1, '=C1');
    expect(show(workbook, 'A1', 'B1', 'C1')).toEqual(['#CYCLE!', '#CYCLE!', '#CYCLE!']);
    // A range that includes its own cell is a cycle too.
    workbook.setInput('s1', 9, 0, '=SUM(A1:A10)');
    expect(show(workbook, 'A10')).toEqual(['#CYCLE!']);
  });

  it('shows parse errors in the cell, keeps the text, and explains them', () => {
    const workbook = book({ A1: '=SUM(', A2: '=NOPE(1)', A3: '=A1+1', A4: '=Z99' });
    expect(show(workbook, 'A1', 'A2', 'A3', 'A4')).toEqual([
      '#VALUE!',
      '#NAME?',
      '#VALUE!',
      '#REF!',
    ]);
    expect(workbook.input('s1', 0, 0)).toBe('=SUM(');
    expect(workbook.diagnostics('s1', 0, 0)[0]?.code).toBe('syntax');
    workbook.setInput('s1', 0, 0, '=2');
    expect(show(workbook, 'A1', 'A3')).toEqual(['2', '3']);
  });

  it('rewrites references when rows and columns are inserted or deleted', () => {
    const workbook = book({
      A1: 1,
      A2: 2,
      A3: 3,
      B1: '=SUM(A1:A3)',
      B2: '=A3*10',
      B3: '=$A$2',
      C1: '=SUM(A:A)',
      D1: '=B1',
    });
    workbook.insertRows('s1', 1, 2); // two rows before row 2
    expect(workbook.input('s1', 0, 1)).toBe('=SUM(A1:A5)');
    expect(workbook.input('s1', 3, 1)).toBe('=A5*10');
    expect(workbook.input('s1', 4, 1)).toBe('=$A$4');
    expect(workbook.value('s1', 0, 1)).toBe(6);
    workbook.setInput('s1', 1, 0, 100); // inside the grown range
    expect(workbook.value('s1', 0, 1)).toBe(106);
    expect(workbook.value('s1', 0, 2)).toBe(106);

    workbook.deleteRows('s1', 4, 1); // the row B2 read through $A$4… now A5 was "3"
    expect(workbook.input('s1', 3, 1)).toBe('=#REF!*10');
    expect(displayValue(workbook.value('s1', 3, 1))).toBe('#REF!');
    expect(workbook.input('s1', 0, 1)).toBe('=SUM(A1:A4)');

    workbook.insertColumns('s1', 0);
    expect(workbook.input('s1', 0, 2)).toBe('=SUM(B1:B4)');
    expect(workbook.input('s1', 0, 4)).toBe('=C1');
    workbook.deleteColumns('s1', 1);
    expect(workbook.input('s1', 0, 1)).toBe('=SUM(#REF!)');
    expect(workbook.input('s1', 0, 2)).toBe('=SUM(#REF!)');
    expect(workbook.sheet('s1')?.columnIds.length).toBe(6);
  });

  it('keeps row and column ids stable across structural edits', () => {
    const workbook = book({ A1: 1 });
    const before = workbook.sheet('s1')?.rowIds.slice() ?? [];
    workbook.insertRows('s1', 0);
    const after = workbook.sheet('s1')?.rowIds ?? [];
    expect(after.slice(1)).toEqual(before);
    expect(after[0]).not.toBe(before[0]);
    expect(workbook.value('s1', 1, 0)).toBe(1);
  });

  it('renames, adds and removes sheets with the formulas that read them', () => {
    const workbook = book({ A1: '=Data!A1*2', A2: "=SUM('Data'!A1:B2)" }, [
      { id: 'd', name: 'Data', rows: 3, columns: 3, cells: { A1: 4, B2: 1 } },
    ]);
    expect(show(workbook, 'A1', 'A2')).toEqual(['8', '5']);
    workbook.renameSheet('d', 'Raw data');
    expect(workbook.input('s1', 0, 0)).toBe("='Raw data'!A1*2");
    expect(workbook.input('s1', 1, 0)).toBe("=SUM('Raw data'!A1:B2)");
    expect(show(workbook, 'A1')).toEqual(['8']);
    expect(workbook.renameSheet('d', 'Budget').evaluated).toBe(0); // the name is taken
    workbook.setInput('s1', 2, 0, '=Later!A1');
    expect(show(workbook, 'A3')).toEqual(['#REF!']);
    const id = workbook.addSheet('Later');
    workbook.setInput(id, 0, 0, 9);
    expect(show(workbook, 'A3')).toEqual(['9']);
    workbook.removeSheet('d');
    expect(workbook.input('s1', 0, 0)).toBe('=#REF!*2');
    expect(show(workbook, 'A1')).toEqual(['#REF!']);
  });

  it('round-trips through toDocument', () => {
    const source = createSheet({ rows: 4, columns: 3, title: 'Plan' });
    const workbook = createWorkbook(source);
    workbook.setInputs([
      { sheet: 'sheet1', row: 1, col: 0, input: 2 },
      { sheet: 'sheet1', row: 0, col: 2, input: '=A2*3' },
      { sheet: 'sheet1', row: 0, col: 0, input: 'Label' },
    ]);
    const doc = workbook.toDocument();
    expect(doc.sheets[0]?.cells).toEqual({ A1: 'Label', C1: '=A2*3', A2: 2 });
    expect(Object.keys(doc.sheets[0]?.cells ?? {})).toEqual(['A1', 'C1', 'A2']);
    expect(validateSheet(doc).ok).toBe(true);
    expect(createWorkbook(doc).value('sheet1', 0, 2)).toBe(6);
    workbook.setInput('sheet1', 0, 0, null);
    expect(workbook.toDocument().sheets[0]?.cells).toEqual({ C1: '=A2*3', A2: 2 });
  });

  it('reads typed input as people expect', () => {
    const cases: [string, SheetInput][] = [
      ['', null],
      ['12', 12],
      [' -3.5 ', -3.5],
      ['40%', 0.4],
      ['1e3', 1000],
      ['true', true],
      ['FALSE', false],
      ['=A1', '=A1'],
      ["'007", "'007"],
      ['12 apples', '12 apples'],
      ['1,000', '1,000'],
    ];
    for (const [text, input] of cases) {
      expect(parseSheetInput(text), text).toBe(input);
    }
    expect(inputText(true)).toBe('TRUE');
    expect(inputText(0.1 + 0.2)).toBe('0.3');
  });
});

describe('validateSheet', () => {
  const base = (sheets: unknown[]): unknown => ({
    format: 'texuli-sheet',
    formatVersion: 1,
    sheets,
  });
  const tab = (extra: Record<string, unknown> = {}) => ({
    id: 's1',
    name: 'Sheet1',
    rows: 5,
    columns: 5,
    ...extra,
  });

  it('accepts a valid sheet as a frozen, normalized copy', () => {
    const result = validateSheet(base([tab({ cells: { a1: 1, B2: '=a1+1', C3: null } })]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sheet.sheets[0]?.cells).toEqual({ A1: 1, B2: '=a1+1' });
    expect(Object.isFrozen(result.sheet.sheets[0])).toBe(true);
  });

  it('refuses each kind of bad input with its code', () => {
    const cases: [unknown, string][] = [
      ['a sheet', 'not-an-object'],
      [{ format: 'texuli-html', formatVersion: 1, sheets: [tab()] }, 'format'],
      [{ ...(base([tab()]) as object), script: 'alert(1)' }, 'unknown-member'],
      [base([]), 'missing-member'],
      [base([tab({ id: 'bad id' })]), 'bad-id'],
      [base([tab(), tab()]), 'duplicate-id'],
      [base([tab(), tab({ id: 's2', name: 'SHEET1' })]), 'duplicate-name'],
      [base([tab({ name: 'a/b' })]), 'bad-name'],
      [base([tab({ rows: 0 })]), 'bad-size'],
      [base([tab({ columns: SHEET_LIMITS.columns + 1 })]), 'bad-size'],
      [base([tab({ cells: { F1: 1 } })]), 'bad-address'],
      [base([tab({ cells: { $A$1: 1 } })]), 'bad-address'],
      [base([tab({ cells: { A1: { html: '<b>' } } })]), 'bad-input'],
      [base([tab({ cells: { A1: Number.NaN } })]), 'bad-input'],
      [base([tab({ cells: { A1: 'evil\u202Etxt' } })]), 'unsafe-text'],
      [base([tab({ cells: { A1: '=SUM(' } })]), 'formula'],
      [base([tab({ cells: { A1: '=INDIRECT("B1")' } })]), 'formula'],
      [base([tab({ cells: { A1: '=Missing!A1' } })]), 'formula'],
      [
        base(
          Array.from({ length: SHEET_LIMITS.sheets + 1 }, (_, i) =>
            tab({ id: `s${i}`, name: `S${i}` })
          )
        ),
        'too-many',
      ],
      [base([tab({ extra: 1 })]), 'unknown-member'],
    ];
    for (const [input, code] of cases) {
      const result = validateSheet(input);
      expect(result.ok, code).toBe(false);
      expect(
        result.issues.map((issue) => issue.code),
        JSON.stringify(input).slice(0, 80)
      ).toContain(code);
    }
  });

  it('warns about formulas that read past the edge, without failing', () => {
    const result = validateSheet(base([tab({ cells: { A1: '=Z99' } })]));
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => [issue.code, issue.severity])).toEqual([
      ['formula', 'warning'],
    ]);
  });

  it('loads untrusted JSON text with a size cap', () => {
    expect(loadUntrustedSheet('{').ok).toBe(false);
    expect(loadUntrustedSheet(JSON.stringify(createSheet())).ok).toBe(true);
    expect(loadUntrustedSheet(' '.repeat(SHEET_LIMITS.jsonBytes + 1)).issues[0]?.code).toBe(
      'too-large'
    );
  });
});
