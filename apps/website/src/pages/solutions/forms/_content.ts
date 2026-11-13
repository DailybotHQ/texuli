import {
  FORMS_AGENTS,
  FORMS_NEXT,
  FORMS_PLATFORMS,
  FORMS_RECIPES,
} from '../../../components/solutions/forms/extras/extras-content.ts';
import { FORMS_HERO } from '../../../components/solutions/forms/hero/hero-content.ts';
import { FORMS_HOW } from '../../../components/solutions/forms/how/how-content.ts';
import { formsQuickstart } from '../../../components/solutions/forms/quickstart/samples.ts';
import { FORMS_STORIES } from '../../../components/solutions/forms/stories/stories-content.ts';
import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const FORMS_ENTRY = getSolution('forms');

export const FORMS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Edit a schema, then try the form',
  label: 'Forms demo',
  tryThis: [
    'In the intake, choose “In person” to reveal the visit step.',
    'Edit a field and watch the draft notice update; this demo keeps drafts in memory.',
    'Open the visual builder, add or reorder a field, and inspect its preview and JSON.',
  ],
};

const { entry: _entry, ...quickstart } = formsQuickstart(FORMS_ENTRY);

export const FORMS_LANDING: SolutionLandingContent = {
  hero: FORMS_HERO,
  demo: FORMS_DEMO,
  stories: FORMS_STORIES,
  how: FORMS_HOW,
  quickstart,
  recipes: FORMS_RECIPES,
  agents: FORMS_AGENTS,
  platforms: FORMS_PLATFORMS,
  next: FORMS_NEXT,
};
