/**
 * Copy for the Sheets "How it works" section. It follows workbook data through the
 * framework-free model, owned formula engine, accessible grid and CSV interface. Each
 * step names the registry package; `SHEETS_HOW_TRACE` ties the claims to exported
 * subpaths and registry capabilities for verification against the package manifest.
 * Facts come from the Sheets registry entry and package README.
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const SHEETS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From a workbook to a grid you can edit.',
  art: { slot: 'solution-sheets-how', variant: 'band' },
  steps: [
    {
      title: 'Model',
      body: 'Validate a workbook and keep every edit in a framework-free model.',
      package: '@texuli/sheets',
    },
    {
      title: 'Calculate',
      body: 'Evaluate formulas and recalculate every dependent cell.',
      package: '@texuli/sheets',
    },
    {
      title: 'Edit',
      body: 'Work the accessible grid and formula bar from the keyboard.',
      package: '@texuli/sheets',
    },
    {
      title: 'Exchange',
      body: 'Import and export CSV. Export neutralizes formula injection.',
      package: '@texuli/sheets',
    },
  ],
};

/** Per step (same order): the subpath export it uses and registry capability it supports. */
export const SHEETS_HOW_TRACE: readonly Readonly<{ subpath: string; capability: string }>[] = [
  { subpath: './model', capability: 'edit' },
  { subpath: './formula', capability: 'formulas' },
  { subpath: './view', capability: 'edit' },
  { subpath: './csv', capability: 'csv' },
];
