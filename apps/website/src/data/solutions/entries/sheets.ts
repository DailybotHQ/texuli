import type { SolutionEntry } from '../schema.ts';

/** Sheets: an embeddable spreadsheet with an owned formula engine (facts F-28). */
export const sheets: SolutionEntry = {
  slug: 'sheets',
  name: 'Sheets',
  status: 'in development',
  tagline: 'An embeddable spreadsheet with formulas and CSV.',
  summary:
    'A workbook model with an owned formula engine, dependency recalculation, structural edits, CSV import and export, and an accessible grid view.',
  route: '/solutions/sheets/',
  docs: '/guides/solutions/sheets/',
  replaces: '/sheets-page/',
  packages: [
    {
      name: '@texuli/sheets',
      subpaths: ['./formula', './model', './csv', './view'],
      role: 'Formula engine, workbook model, CSV and grid view',
    },
  ],
  capabilities: [
    {
      id: 'formulas',
      title: 'Formulas',
      summary: 'Evaluate formulas and recalculate their dependents.',
      status: 'in development',
    },
    {
      id: 'edit',
      title: 'Structural edits',
      summary: 'Change the structure of a workbook and keep formulas consistent.',
      status: 'in development',
    },
    {
      id: 'csv',
      title: 'CSV',
      summary: 'Import and export sheets as CSV.',
      status: 'in development',
    },
    {
      id: 'collaboration',
      title: 'Collaboration',
      summary: 'Edit one workbook from several replicas over document sync.',
      status: 'planned',
    },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'compose-desktop', status: 'planned', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'sheets',
    title: 'Plan a project budget',
    scenarios: ['project-budget'],
    limits: ['Runs in the browser on one fixture workbook; nothing is saved.'],
  },
  art: { hero: { slot: 'solution-sheets-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'No collaboration, localized formula display or native evaluation yet.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/sheets/' },
    { label: 'Current demo page', href: '/sheets-page/' },
    { label: '@texuli/sheets on npm', href: 'https://www.npmjs.com/package/@texuli/sheets' },
  ],
};
