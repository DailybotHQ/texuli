/**
 * The Solutions registry (ADR-029): one entry per promoted Solution, in catalog order.
 * Every page, the catalog, the home band and the nav read this list.
 */
import { agentChat } from './entries/agent-chat.ts';
import { canvas } from './entries/canvas.ts';
import { dashboards } from './entries/dashboards.ts';
import { designSystems } from './entries/design-systems.ts';
import { documents } from './entries/documents.ts';
import { editor } from './entries/editor.ts';
import { forms } from './entries/forms.ts';
import { sheets } from './entries/sheets.ts';
import { slides } from './entries/slides.ts';
import { workflows } from './entries/workflows.ts';
import type { SolutionEntry, SolutionSlug } from './schema.ts';

export const SOLUTIONS: readonly SolutionEntry[] = [
  slides,
  documents,
  workflows,
  canvas,
  sheets,
  designSystems,
  dashboards,
  forms,
  agentChat,
  editor,
];

/** Looks up one Solution by slug. */
export function getSolution(slug: SolutionSlug): SolutionEntry {
  const entry = SOLUTIONS.find((s) => s.slug === slug);
  if (!entry) throw new Error(`unknown Solution "${slug}"`);
  return entry;
}
