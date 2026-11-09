/**
 * Canvas landing content: per-section copy gathered into the content contract checked by
 * `SolutionLayout`. Section blocks remain the source of their copy and demos.
 */

import {
  CANVAS_AGENTS,
  CANVAS_NEXT,
  CANVAS_PLATFORMS,
  CANVAS_RECIPES,
} from '../../../components/solutions/canvas/extras/extras-content.ts';
import { CANVAS_HERO } from '../../../components/solutions/canvas/hero/hero-content.ts';
import { CANVAS_HOW } from '../../../components/solutions/canvas/how/how-content.ts';
import { canvasQuickstart } from '../../../components/solutions/canvas/quickstart/samples.ts';
import { CANVAS_STORIES } from '../../../components/solutions/canvas/stories/stories-content.ts';
import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const CANVAS_ENTRY = getSolution('canvas');

export const CANVAS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Sketch a launch plan',
  label: 'Canvas demo',
  tryThis: [
    'Select a shape, then move it with the arrow keys or the move controls.',
    'Add a priority note or select two shapes and connect them.',
    'Undo an edit, open View source, and Reset the starting example.',
  ],
};

const { entry: _entry, ...quickstart } = canvasQuickstart(CANVAS_ENTRY);

export const CANVAS_LANDING: SolutionLandingContent = {
  hero: CANVAS_HERO,
  demo: CANVAS_DEMO,
  stories: CANVAS_STORIES,
  how: CANVAS_HOW,
  quickstart,
  recipes: CANVAS_RECIPES,
  agents: CANVAS_AGENTS,
  platforms: CANVAS_PLATFORMS,
  next: CANVAS_NEXT,
};
