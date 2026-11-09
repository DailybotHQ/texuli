/**
 * Canvas landing hero copy. The registry supplies the in-development status and hero art
 * slot. Claims follow the Canvas package README: the editor, keyboard tree and SVG/PNG
 * export are part of the package. CTAs point to this landing's demo and quickstart.
 */
import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const CANVAS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Canvas',
  title: 'Give every idea room to connect.',
  lede: 'Shape ideas into a board, move through it with the keyboard, then export SVG or PNG. Your app owns persistence, image hosting and collaboration transport.',
  ctas: [
    { kind: 'primary', label: 'Sketch a launch plan', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Build with Canvas', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
  ],
};
