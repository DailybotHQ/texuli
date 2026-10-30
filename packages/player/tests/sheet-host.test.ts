/**
 * @vitest-environment happy-dom
 */

import { cleanup, render, waitFor, within } from '@testing-library/svelte';
import { spreadsheetManifest } from '@texuli/catalog/manifests/sheets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSheetPlayerHost } from '../../sheets/src/host/index.ts';
import { DEFAULT_PLAYER_LABELS } from '../src/labels.ts';
import Player from '../src/Player.svelte';
import {
  type DraftSheetCheck,
  SHEET_HOST_PACKAGE,
  type SheetPlayerHost,
  type SheetPlayerHostRequest,
} from '../src/sheet-host.ts';

/**
 * The sheet host seam (spec 0.8.0, ADR-015): a `spreadsheet` node is
 * checked with the host's `checkSheet` (every formula parsed) and painted
 * through its `present`; without a host it is refused (`sheet-unchecked`)
 * and nothing of the sheet paints. The player never imports
 * `@texuli/sheets`; only this test reaches the real adapter, by path.
 */

afterEach(cleanup);

const BUDGET = spreadsheetManifest.examples?.[0]?.props.sheet as {
  meta: { title: string };
  sheets: { cells: Record<string, unknown> }[];
};

function sheetTree(sheet: unknown = BUDGET, extra: Record<string, unknown> = {}) {
  return {
    id: 'layout-page',
    props: { title: 'Offsite' },
    children: [{ id: 'spreadsheet', props: { sheet, ...extra } }],
  };
}

function withFormula(formula: string) {
  const first = BUDGET.sheets[0] as { cells: Record<string, unknown> };
  return { ...BUDGET, sheets: [{ ...first, cells: { ...first.cells, E1: formula } }] };
}

function paint(blueprint: unknown, props: Record<string, unknown> = {}) {
  const codes: string[] = [];
  const result = render(Player, {
    props: {
      blueprint,
      label: 'Sheet preview',
      onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
        for (const d of event.diagnostics) if (d.severity === 'error') codes.push(d.code);
      },
      ...props,
    },
  });
  return { ...result, codes };
}

/** A recording host around the real sheet check; `present` paints a marker. */
function recordingHost() {
  const real = createSheetPlayerHost();
  const requests: SheetPlayerHostRequest[] = [];
  const stop = vi.fn();
  const checkSheet: DraftSheetCheck = (sheet, tier) => real.checkSheet(sheet, tier);
  const host: SheetPlayerHost = {
    checkSheet,
    present(request) {
      requests.push(request);
      const marker = document.createElement('p');
      marker.setAttribute('data-test-sheet', '');
      marker.textContent = (request.sheet as { meta: { title: string } }).meta.title;
      request.target?.append(marker);
      return () => {
        marker.remove();
        stop();
      };
    },
  };
  return { host, requests, stop };
}

describe('the sheet host seam', () => {
  it('names the package that owns the sheet view', () => {
    expect(SHEET_HOST_PACKAGE).toBe('@texuli/sheets');
  });

  it('hands a valid sheet to the host, which paints it in place, and cleans up on unmount', async () => {
    const { host, requests, stop } = recordingHost();
    const { container, codes } = paint(sheetTree(BUDGET, { label: 'Budget' }), {
      sheetHost: host,
    });
    await waitFor(() => expect(requests).toHaveLength(1), { timeout: 10_000 });
    expect(requests[0]).toMatchObject({ tier: 'untrusted', sheetLabel: 'Budget' });
    expect(requests[0]?.label).toBe('Sheet preview');
    expect(requests[0]?.active).toBe(true);
    const surface = container.querySelector('[data-tx-player-spreadsheet]');
    expect(requests[0]?.target).toBe(surface);
    expect(surface?.querySelector('[data-test-sheet]')?.textContent).toBe('Team offsite budget');
    expect(codes).toEqual([]);
    cleanup();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('refuses a spreadsheet without a host, and a sheet with a bad formula with one: nothing paints', async () => {
    const bare = paint(sheetTree());
    await waitFor(() => expect(bare.codes).toContain('sheet-unchecked'));
    expect(bare.container.querySelector('[data-tx-player-spreadsheet]')).toBeNull();
    expect(bare.container.querySelector('[role="grid"]')).toBeNull();
    cleanup();
    for (const formula of ['=INDIRECT("A1")', '=SUM(A1:', '=WEBSERVICE("https://example.com")']) {
      const { host, requests } = recordingHost();
      const { container, codes } = paint(sheetTree(withFormula(formula)), { sheetHost: host });
      await waitFor(() => expect(codes, formula).toContain('sheet-schema'));
      expect(requests, formula).toHaveLength(0);
      expect(container.querySelector('[data-test-sheet]'), formula).toBeNull();
      cleanup();
    }
  });

  it('previews a refused spreadsheet as its title and a notice, never its cells', async () => {
    const { container } = paint(sheetTree(), { invalidPolicy: 'preview' });
    await waitFor(
      () => expect(container.querySelector('[data-tx-player-spreadsheet-fallback]')).not.toBeNull(),
      { timeout: 10_000 }
    );
    const fallback = container.querySelector('[data-tx-player-spreadsheet-fallback]');
    expect(fallback?.getAttribute('aria-label')).toBe('Team offsite budget');
    expect(fallback?.textContent).toContain(DEFAULT_PLAYER_LABELS.sheetNeedsHost);
    expect(fallback?.textContent).not.toContain('Venue');
  });

  it('paints through the real @texuli/sheets host: a read-only grid with computed totals', {
    timeout: 30_000,
  }, async () => {
    const { container, codes } = paint(sheetTree(), { sheetHost: createSheetPlayerHost() });
    await waitFor(
      () =>
        expect(
          container.querySelector('[data-tx-player-spreadsheet] [role="grid"]')
        ).not.toBeNull(),
      { timeout: 20_000 }
    );
    const grid = await within(container).findByRole('grid', { name: /Team offsite budget/ });
    expect(grid.closest('[data-tx-player-spreadsheet]')).not.toBeNull();
    // D6 = SUM(D2:D4) = 1200 + 444 + 156.
    await waitFor(() => expect(grid.textContent).toContain('1800'));
    expect(codes).toEqual([]);
  });
});
