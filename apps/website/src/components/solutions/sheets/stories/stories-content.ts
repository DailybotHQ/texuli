/**
 * The Sheets signature stories and the evidence behind every claim. Copy comes from the
 * `@texuli/sheets` README and the Sheets audit; each story names capability ids from
 * `entries/sheets.ts`, and each claim cites a repository file that contains the named
 * marker. Collaboration is planned, so that story names the planned capability and the
 * shared block shows its planned chip.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const SHEETS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'What you can ship in a sheet',
  stories: [
    {
      id: 'formulas',
      title: 'Totals follow every edit',
      body: 'An owned engine parses formulas into the shared AST. Dependents recalculate. The language is closed: no reference from text, and nothing reaches the host except the clock you pass.',
      capabilities: ['formulas'],
      art: { slot: 'solution-sheets-story-1', variant: 'plate' },
    },
    {
      id: 'edit',
      title: 'Move rows without breaking formulas',
      body: 'Structural edits rewrite references. The workbook engine keeps computed values current. Values paint as text. There is no HTML sink.',
      capabilities: ['edit'],
      art: { slot: 'solution-sheets-story-2', variant: 'plate' },
    },
    {
      id: 'csv',
      title: 'Hand off CSV that stays inert',
      body: 'Import keeps formula-looking fields as text unless you opt in. Export neutralizes formula injection so a spreadsheet tool will not run them.',
      capabilities: ['csv'],
      art: { slot: 'solution-sheets-story-3', variant: 'plate' },
    },
    {
      id: 'collaboration',
      title: 'Work on it together, later',
      body: 'Collaboration on the document sync core is planned, not shipped. Localized formula display and native evaluation are planned too.',
      capabilities: ['collaboration'],
    },
  ],
};

export interface StoryClaim {
  readonly claim: string;
  readonly source: string;
  readonly marker: string;
}

export const SHEETS_STORY_EVIDENCE: Readonly<Record<string, readonly StoryClaim[]>> = {
  formulas: [
    {
      claim: 'Owned formula engine with incremental recalculation',
      source: 'packages/sheets/README.md',
      marker: 'owned formula engine',
    },
    {
      claim: 'Dependents recalculate',
      source: 'packages/sheets/README.md',
      marker: 'dependency graph with incremental recalculation',
    },
    {
      claim: 'Closed language, no INDIRECT or RAND',
      source: 'packages/sheets/README.md',
      marker: 'no `INDIRECT`, `OFFSET`, `LAMBDA`, `RAND`',
    },
    {
      claim: 'Formulas are tested',
      source: 'packages/sheets/tests/formula.test.ts',
      marker: 'parseFormula',
    },
    {
      claim: 'The landing demo uses a fictional project budget',
      source: 'apps/website/src/components/solutions/sheets/demo/fixtures/project-budget.ts',
      marker: 'Project budget',
    },
  ],
  edit: [
    {
      claim: 'Structural edits rewrite references',
      source: 'packages/sheets/README.md',
      marker: 'structural edits that rewrite references',
    },
    {
      claim: 'The workbook engine is tested',
      source: 'packages/sheets/tests/model.test.ts',
      marker: 'createWorkbook',
    },
    {
      claim: 'No HTML sink',
      source: 'packages/sheets/README.md',
      marker: 'there is no HTML sink',
    },
  ],
  csv: [
    {
      claim: 'CSV import and export neutralize formula injection',
      source: 'packages/sheets/README.md',
      marker: 'CSV import and export that neutralizes formula injection',
    },
    {
      claim: 'Import keeps formula-looking fields as text unless opted in',
      source: 'packages/sheets/README.md',
      marker: 'CSV import keeps `=…` fields as text unless the caller opts in',
    },
    {
      claim: 'CSV is tested',
      source: 'packages/sheets/tests/csv.test.ts',
      marker: 'csv',
    },
  ],
  collaboration: [
    {
      claim: 'Collaboration is planned, not shipped',
      source: 'packages/sheets/README.md',
      marker: 'collaboration on `@texuli/document/sync`',
    },
    {
      claim: 'The registry records no collaboration yet',
      source: 'apps/website/src/data/solutions/entries/sheets.ts',
      marker: 'No collaboration, localized formula display or native evaluation yet.',
    },
  ],
};
