// @vitest-environment happy-dom
import { waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { createSheetPlayerHost } from '../src/host/index.ts';
import { createSheet } from '../src/model/index.ts';

const request = (sheet: unknown, target: HTMLElement | null) => ({
  sheet,
  sheetLabel: 'Quarter plan',
  tier: 'untrusted' as const,
  label: 'Player',
  active: true,
  target,
});

describe('createSheetPlayerHost', () => {
  it('checks sheets as a draft check: formulas included, the tier loosens nothing', () => {
    const host = createSheetPlayerHost();
    const sheet = createSheet({ rows: 3, columns: 2 });
    expect(host.checkSheet(sheet, 'untrusted').ok).toBe(true);
    for (const tier of ['developer', 'untrusted'] as const) {
      const bad = { ...sheet, sheets: [{ ...sheet.sheets[0], cells: { A1: '=INDIRECT("B1")' } }] };
      const result = host.checkSheet(bad, tier);
      expect(result.ok, tier).toBe(false);
      expect(result.issues[0]?.code).toBe('formula');
    }
  });

  it('mounts a read-only view for a valid sheet, nothing for an invalid one, and cleans up', async () => {
    const host = createSheetPlayerHost();
    const target = document.createElement('div');
    document.body.append(target);
    const sheet = createSheet({ rows: 2, columns: 2 });
    const tab = sheet.sheets[0] as (typeof sheet.sheets)[number];
    const cleanup = host.present(
      request({ ...sheet, sheets: [{ ...tab, cells: { A1: 2, B1: '=A1*21' } }] }, target)
    );
    const grid = await waitFor(() => {
      const found = target.querySelector('[role="grid"]');
      if (!found) throw new Error('not mounted');
      return found;
    });
    expect(grid.getAttribute('aria-label') ?? grid.textContent).toBeTruthy();
    expect(target.textContent).toContain('42');
    expect(target.querySelector('[aria-readonly="true"]')).not.toBeNull();
    cleanup?.();
    expect(target.querySelector('[role="grid"]')).toBeNull();

    const empty = document.createElement('div');
    expect(host.present(request({ format: 'texuli-html' }, empty))).toBeUndefined();
    expect(host.present(request(sheet, null))).toBeUndefined();
    expect(empty.childElementCount).toBe(0);
  });
});
