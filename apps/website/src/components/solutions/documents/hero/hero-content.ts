/**
 * Copy for the Documents landing hero. Facts come from the registry entry and the
 * Documents audit (the `@texuli/document` engine with operations and undo, Markdown,
 * pagination, DOCX and PDF writers and CRDT sync; `@texuli/pages` for editing, reading
 * and exports; `@texuli/editor` as the text surface). The status line is printed by
 * `SolutionHero` from `entry.status`, so the copy never states one, and paged-view
 * editing (planned) is not claimed. Calls to action point only at the landing's own
 * demo and quickstart sections.
 */

import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const DOCUMENTS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Documents',
  title: 'Documents you can edit, read and export.',
  lede: 'Edit block documents with undo, read them in a reader view, paginate them, export Markdown, DOCX and PDF, and merge edits from several replicas.',
  ctas: [
    { kind: 'primary', label: 'Edit the live report', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Start building', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
  ],
};
