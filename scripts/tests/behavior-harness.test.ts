// @vitest-environment node
/**
 * The behavior suite's pure rules (tests/behavior/harness/limits.ts and
 * rows.ts): the open-to-focus limits, row ids, and which rows run where.
 * The browser half of the harness self test is tests/behavior/harness/self.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  checkOpenToFocus,
  DEFAULT_OPEN_TO_FOCUS_P75_MS,
  OPEN_TO_FOCUS_P75_MS,
  openToFocusLimit,
  p75,
  perfEnabled,
} from '../../tests/behavior/harness/limits.ts';
import {
  defineRows,
  PHONE,
  PHONE_HOST,
  rowsFor,
  runsOn,
  type ScenarioRow,
} from '../../tests/behavior/harness/rows.ts';

describe('behavior harness limits', () => {
  it('p75 is the nearest-rank 75th percentile', () => {
    expect(p75([5])).toBe(5);
    expect(p75([4, 1, 3, 2])).toBe(3);
    expect(p75([10, 20, 30, 40, 50, 60, 70, 80])).toBe(60);
    expect(() => p75([])).toThrow(/at least one sample/);
  });

  it('open-to-focus is checked against an absolute limit per primitive', () => {
    expect(openToFocusLimit('no-such-primitive')).toBe(DEFAULT_OPEN_TO_FOCUS_P75_MS);
    for (const [primitive, limit] of Object.entries(OPEN_TO_FOCUS_P75_MS)) {
      expect(openToFocusLimit(primitive)).toBe(limit);
      expect(limit).toBeGreaterThanOrEqual(50);
    }
    const limit = openToFocusLimit('sample');
    expect(checkOpenToFocus('sample', [limit, limit, limit, limit]).ok).toBe(true);
    const over = checkOpenToFocus('sample', [1, 1, limit + 1, limit + 1]);
    expect(over).toEqual({ primitive: 'sample', p75: limit + 1, limit, ok: false });
  });

  it('timing is asserted only with TEXULI_PERF=1', () => {
    expect(perfEnabled({})).toBe(false);
    expect(perfEnabled({ TEXULI_PERF: '0' })).toBe(false);
    expect(perfEnabled({ TEXULI_PERF: '1' })).toBe(true);
  });
});

describe('behavior harness rows', () => {
  it('rows have unique slug ids', () => {
    const run = async () => {};
    expect(() => defineRows([{ id: 'Bad Id', title: 'x', run }])).toThrow(/lowercase slug/);
    expect(() =>
      defineRows([
        { id: 'a', title: 'x', run },
        { id: 'a', title: 'y', run },
      ])
    ).toThrow(/duplicate/);
  });

  it('desktop rows run on Chromium and WebKit; phone rows only in the Chromium project, on the Pixel 7 profile', () => {
    const row = (id: string, title: string, extra: Partial<ScenarioRow> = {}): ScenarioRow => ({
      id,
      title,
      async run() {},
      ...extra,
    });
    const rows = defineRows([
      row('keyboard', 'arrows move focus'),
      row('tap', 'a tap selects a day'),
      row('branch', 'opens', {
        async run({ project }) {
          if (project === 'webkit') return;
        },
      }),
      row('touch-only', 'selects', { projects: [PHONE] }),
      row('desktop-only', 'a tap is ignored', { projects: ['chromium', 'webkit'] }),
    ]);
    const ids = (list: readonly ScenarioRow[]) => list.map((r) => r.id);

    expect(PHONE_HOST).toBe('chromium');
    for (const project of ['chromium', 'webkit']) {
      expect(ids(rows.filter((r) => runsOn(r, project)))).toEqual([
        'keyboard',
        'tap',
        'branch',
        'desktop-only',
      ]);
    }
    expect(ids(rows.filter((r) => runsOn(r, PHONE)))).toEqual(['tap', 'branch', 'touch-only']);

    const chromium = rowsFor(rows, 'chromium');
    expect(ids(chromium.desktop)).toEqual(['keyboard', 'tap', 'branch', 'desktop-only']);
    expect(ids(chromium.phone)).toEqual(['tap', 'branch', 'touch-only']);
    expect(ids(rowsFor(rows, 'webkit').phone)).toEqual([]);
  });
});
