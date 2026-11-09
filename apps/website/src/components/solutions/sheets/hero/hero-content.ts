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
  lede: 'An owned formula engine, a keyboard grid, and CSV that will not inject formulas.',
  ctas: [
    { kind: 'primary', label: 'See it recalculate', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Start from code', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
  ],
};
