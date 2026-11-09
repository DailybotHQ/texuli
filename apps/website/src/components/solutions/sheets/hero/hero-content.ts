/**
 * Sheets landing hero copy. The registry supplies the in-development status and hero art
 * slot. Claims follow the Sheets package README: an owned formula engine, accessible grid
 * editing and CSV import/export. CTAs point to this landing's demo and quickstart.
 */
import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const SHEETS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Sheets',
  title: 'A spreadsheet with formulas built to recalculate.',
  lede: 'Model a workbook with an owned formula engine, edit its grid with keyboard controls, and move data in or out as CSV.',
  ctas: [
    { kind: 'primary', label: 'Explore the budget', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Start building', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
  ],
};
