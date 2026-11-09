/**
 * The Workflows landing content (ADR-027, ADR-030): the per-section copy the Workflows
 * blocks already own, gathered into the `SolutionLandingContent` that `SolutionLayout`
 * checks against the registry entry. The underscore keeps this module out of Astro's routes.
 */

import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import {
  WORKFLOWS_AGENTS,
  WORKFLOWS_NEXT,
  WORKFLOWS_PLATFORMS,
  WORKFLOWS_RECIPES,
} from '../../../components/solutions/workflows/extras/extras-content.ts';
import { WORKFLOWS_HERO } from '../../../components/solutions/workflows/hero/hero-content.ts';
import { WORKFLOWS_HOW } from '../../../components/solutions/workflows/how/how-content.ts';
import { workflowsQuickstart } from '../../../components/solutions/workflows/quickstart/samples.ts';
import { WORKFLOWS_STORIES } from '../../../components/solutions/workflows/stories/stories-content.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const WORKFLOWS_ENTRY = getSolution('workflows');

export const WORKFLOWS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Edit an approval flow',
  label: 'Workflows demo',
  tryThis: [
    'Start the demo, then select a step or change its label.',
    'Add a notification step, or arrange the graph from left to right.',
    'Use Reset example to return to the starting approval flow.',
  ],
};

const { entry: _entry, ...quickstart } = workflowsQuickstart(WORKFLOWS_ENTRY);

export const WORKFLOWS_LANDING: SolutionLandingContent = {
  hero: WORKFLOWS_HERO,
  demo: WORKFLOWS_DEMO,
  stories: WORKFLOWS_STORIES,
  how: WORKFLOWS_HOW,
  quickstart,
  recipes: WORKFLOWS_RECIPES,
  agents: WORKFLOWS_AGENTS,
  platforms: WORKFLOWS_PLATFORMS,
  next: WORKFLOWS_NEXT,
};
