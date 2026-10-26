/**
 * Showcase index "start here" curation (PLAN_006 T-83, gallery punch list
 * row 1). The landing strip that would also point here is another lane's
 * file; inside the showcase area this module picks which screens lead the
 * index and why, failing closed when a curated id stops existing.
 */
import type { ShowcaseScreen } from './showcase.ts';

/** The screens a first-time visitor should see first, in lead order. */
export const HERO_IDS = ['dashboard', 'kanban', 'slide-deck'] as const;

/**
 * Why each hero screen proves something, in one line. Copy stays inside the
 * fictional Harbor Notes discipline (gallery punch list row 8).
 */
const HERO_WHY: Record<string, string> = {
  dashboard:
    'KPI cards, a widget grid and a chart over fictional Harbor Notes analytics — the density test.',
  kanban:
    'Board columns, filters and counts for fictional delivery work — data-heavy app chrome, all owned.',
  'slide-deck':
    'A paged product walkthrough built from the same components — one system, interfaces to decks.',
};

export interface HeroScreen {
  screen: ShowcaseScreen;
  href: string;
  why: string;
}

/** Resolve the curated hero ids against the real screen list, keeping lead order. */
export function heroScreens(screens: readonly ShowcaseScreen[]): HeroScreen[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  const heroes: HeroScreen[] = [];
  for (const id of HERO_IDS) {
    const screen = byId.get(id);
    const why = HERO_WHY[id];
    if (screen && why) heroes.push({ screen, href: `/showcase/${screen.id}/`, why });
  }
  return heroes;
}
