/**
 * The Documents landing content (ADR-027, ADR-030): the per-section copy the Documents
 * blocks already own, gathered into the `SolutionLandingContent` that `SolutionLayout`
 * checks against the registry entry. The underscore keeps this module out of Astro's routes.
 */

import {
  DOCUMENTS_AGENTS,
  DOCUMENTS_NEXT,
  DOCUMENTS_PLATFORMS,
  DOCUMENTS_RECIPES,
} from '../../../components/solutions/documents/extras/extras-content.ts';
import { DOCUMENTS_HERO } from '../../../components/solutions/documents/hero/hero-content.ts';
import { DOCUMENTS_HOW } from '../../../components/solutions/documents/how/how-content.ts';
import { documentsQuickstart } from '../../../components/solutions/documents/quickstart/samples.ts';
import { DOCUMENTS_STORIES } from '../../../components/solutions/documents/stories/stories-content.ts';
import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const DOCUMENTS_ENTRY = getSolution('documents');

export const DOCUMENTS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Edit a real report',
  label: 'Documents demo',
  tryThis: [
    'Start the demo, then rename the report title or add a block.',
    'Undo and redo your edits, or switch between editing and reading.',
    'Use Reset example to return to the starting report.',
  ],
};

const { entry: _entry, ...quickstart } = documentsQuickstart(DOCUMENTS_ENTRY);

export const DOCUMENTS_LANDING: SolutionLandingContent = {
  hero: DOCUMENTS_HERO,
  demo: DOCUMENTS_DEMO,
  stories: DOCUMENTS_STORIES,
  how: DOCUMENTS_HOW,
  quickstart,
  recipes: DOCUMENTS_RECIPES,
  agents: DOCUMENTS_AGENTS,
  platforms: DOCUMENTS_PLATFORMS,
  next: DOCUMENTS_NEXT,
};
