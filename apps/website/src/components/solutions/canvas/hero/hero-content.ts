/**
 * Canvas landing hero copy. The registry supplies the in-development status and hero art
 * slot. Claims follow the Canvas package README: the editor, keyboard tree and SVG/PNG
 * export are part of the package. CTAs point to this landing's demo and quickstart.
 */
import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const CANVAS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Canvas',
  title: 'A canvas for sketches, diagrams and ideas.',
  lede: 'Arrange shapes, text and connectors, edit with a keyboard-friendly tree, and export your board as SVG or PNG.',
  ctas: [
    { kind: 'primary', label: 'Try the canvas', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Start building', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
  ],
};
