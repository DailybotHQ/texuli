/**
 * The Sheets landing content (ADR-027, ADR-030): the per-section copy the Sheets blocks
 * already own, gathered into the `SolutionLandingContent` that `SolutionLayout` checks
 * against the registry entry. The underscore keeps this module out of Astro's routes.
 */

import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import {
  SHEETS_AGENTS,
  SHEETS_NEXT,
  SHEETS_PLATFORMS,
  SHEETS_RECIPES,
} from '../../../components/solutions/sheets/extras/extras-content.ts';
import { SHEETS_HERO } from '../../../components/solutions/sheets/hero/hero-content.ts';
import { SHEETS_HOW } from '../../../components/solutions/sheets/how/how-content.ts';
import { sheetsQuickstart } from '../../../components/solutions/sheets/quickstart/samples.ts';
import { SHEETS_STORIES } from '../../../components/solutions/sheets/stories/stories-content.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const SHEETS_ENTRY = getSolution('sheets');

export const SHEETS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Plan a project budget',
  label: 'Sheets demo',
  tryThis: [
    'Change a quantity or unit price; the row and grand totals recalculate.',
    'Toggle formulas to see the owned engine’s expressions as data.',
    'Add a line item, then reset to restore the fixture workbook.',
  ],
};

const { entry: _entry, ...quickstart } = sheetsQuickstart(SHEETS_ENTRY);

export const SHEETS_LANDING: SolutionLandingContent = {
  hero: SHEETS_HERO,
  demo: SHEETS_DEMO,
  stories: SHEETS_STORIES,
  how: SHEETS_HOW,
  quickstart,
  recipes: SHEETS_RECIPES,
  agents: SHEETS_AGENTS,
  platforms: SHEETS_PLATFORMS,
  next: SHEETS_NEXT,
};
