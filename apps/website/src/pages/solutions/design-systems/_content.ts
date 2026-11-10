/**
 * The Design systems landing content (ADR-027, ADR-030, ADR-033; PLAN_017 story.md): the
 * per-section copy the Design systems blocks own, gathered into the `SolutionLandingContent`
 * that `SolutionLayout` checks against the registry entry. The underscore keeps this module
 * out of Astro's routes.
 */
import { DESIGN_SYSTEMS_DEMO } from '../../../components/solutions/design-systems/demo/demo-content.ts';
import {
  DESIGN_SYSTEMS_AGENTS,
  DESIGN_SYSTEMS_NEXT,
  DESIGN_SYSTEMS_PLATFORMS,
  DESIGN_SYSTEMS_RECIPES,
} from '../../../components/solutions/design-systems/extras/extras-content.ts';
import { DESIGN_SYSTEMS_HERO } from '../../../components/solutions/design-systems/hero/hero-content.ts';
import { DESIGN_SYSTEMS_HOW } from '../../../components/solutions/design-systems/how/how-content.ts';
import { designSystemsQuickstart } from '../../../components/solutions/design-systems/quickstart/samples.ts';
import { DESIGN_SYSTEMS_STORIES } from '../../../components/solutions/design-systems/stories/stories-content.ts';
import type { SolutionLandingContent } from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const DESIGN_SYSTEMS_ENTRY = getSolution('design-systems');

const { entry: _entry, ...quickstart } = designSystemsQuickstart(DESIGN_SYSTEMS_ENTRY);

export const DESIGN_SYSTEMS_LANDING: SolutionLandingContent = {
  hero: DESIGN_SYSTEMS_HERO,
  demo: DESIGN_SYSTEMS_DEMO,
  stories: DESIGN_SYSTEMS_STORIES,
  how: DESIGN_SYSTEMS_HOW,
  quickstart,
  recipes: DESIGN_SYSTEMS_RECIPES,
  agents: DESIGN_SYSTEMS_AGENTS,
  platforms: DESIGN_SYSTEMS_PLATFORMS,
  next: DESIGN_SYSTEMS_NEXT,
};
