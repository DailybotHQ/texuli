import { DECK_OUTLINE_IDS, type DeckOutlineId, generateDeckFromBrief } from '../authoring/index.ts';
import type { Deck } from '../model/index.ts';

export type DeckTemplateId = DeckOutlineId | 'review';
export interface DeckTemplate {
  id: DeckTemplateId;
  label: string;
  description: string;
}
export const DECK_TEMPLATES: readonly DeckTemplate[] = Object.freeze([
  { id: 'pitch', label: 'Pitch', description: 'A source-led story from problem to ask.' },
  {
    id: 'review',
    label: 'Review',
    description: 'A review of outcomes, risks, evidence and next decisions.',
  },
  {
    id: 'qbr',
    label: 'Quarterly review',
    description: 'A balanced quarter review with evidence and next priorities.',
  },
  {
    id: 'launch',
    label: 'Launch',
    description: 'Audience, product promise, launch plan and risks.',
  },
  { id: 'status', label: 'Status', description: 'Progress, blockers, decisions and next period.' },
  {
    id: 'training',
    label: 'Training',
    description: 'Learning outcomes, demonstration, practice and checks.',
  },
  { id: 'lesson', label: 'Lesson', description: 'A compact lesson with example and practice.' },
  {
    id: 'report',
    label: 'Report',
    description: 'Question, method, findings, limits and recommendations.',
  },
  {
    id: 'talk',
    label: 'Talk',
    description: 'A memorable talk with one central idea and useful takeaways.',
  },
]);

/** Generate a validated deck from a built-in outline; all content is clearly marked as draft guidance. */
export function createDeckTemplate(id: DeckTemplateId, title?: string): Deck {
  if (!(DECK_OUTLINE_IDS as readonly string[]).includes(id) && id !== 'review')
    throw new TypeError(`Unknown deck template "${id}".`);
  const outline: DeckOutlineId = id === 'review' ? 'qbr' : id;
  return generateDeckFromBrief({
    outline,
    brief: `${id} draft`,
    ...(title ? { title } : { title: `${id[0]?.toUpperCase()}${id.slice(1)} draft` }),
  }).deck;
}
