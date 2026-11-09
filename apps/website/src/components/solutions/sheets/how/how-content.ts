/**
 * Copy for the Sheets "How it works" section. It follows workbook data through the
 * framework-free model, owned formula engine, accessible grid and CSV interface. Each
 * step names the registry package; `SHEETS_HOW_TRACE` ties the claims to exported
 * subpaths and registry capabilities for verification against the package manifest.
 * Facts come from the Sheets registry entry and package README.
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const SHEETS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From workbook model to accessible grid.',
  steps: [
    {
      title: 'Model',
      body: 'Validate a workbook document and keep edits in a framework-free sheet model.',
      package: '@texuli/sheets',
    },
    {
      title: 'Calculate',
      body: 'Evaluate formulas and recalculate dependent cells with the owned formula engine.',
      package: '@texuli/sheets',
    },
    {
      title: 'Edit',
      body: 'Use the accessible grid, formula bar, and keyboard controls to work with a sheet.',
      package: '@texuli/sheets',
    },
    {
      title: 'Exchange',
      body: 'Import and export CSV, with formula injection neutralized during export.',
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
