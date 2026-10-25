/**
 * Starter drafts: an empty page, or one of the player fixture blueprints
 * from the examples registry (`@texuli/examples`: a weekly report, an
 * operations dashboard and a planning deck, all fictional). The registry is
 * loaded only when a starter is picked, so the builder's first paint does
 * not carry it. A starter goes through the same check as a JSON commit
 * before it replaces the draft.
 */
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { EMPTY_BLUEPRINT } from '../model.ts';

export const STARTER_IDS = ['empty', 'report', 'dashboard', 'deck'] as const;
export type StarterId = (typeof STARTER_IDS)[number];

export interface Starter {
  id: StarterId;
  label: string;
  summary: string;
}

export const STARTERS: readonly Starter[] = Object.freeze([
  { id: 'empty', label: 'Empty page', summary: 'A page layout with nothing in it.' },
  {
    id: 'report',
    label: 'Weekly report',
    summary: 'A document with a summary, KPIs, a line chart and a callout.',
  },
  {
    id: 'dashboard',
    label: 'Operations dashboard',
    summary: 'A page with KPIs and a grid of chart cards.',
  },
  {
    id: 'deck',
    label: 'Planning deck',
    summary: 'A deck of four card slides: agenda, progress, burn-down and a decision.',
  },
]);

export function isStarterId(value: string): value is StarterId {
  return (STARTER_IDS as readonly string[]).includes(value);
}

/** The starter's draft, as a fresh copy (never the registry's own object). */
export async function loadStarter(id: StarterId): Promise<CatalogTreeInput> {
  if (id === 'empty') return structuredClone(EMPTY_BLUEPRINT);
  const examples = await import('@texuli/examples');
  const source =
    id === 'report'
      ? examples.reportBlueprint
      : id === 'dashboard'
        ? examples.dashboardBlueprint
        : examples.deckBlueprint;
  return JSON.parse(JSON.stringify(source)) as CatalogTreeInput;
}
