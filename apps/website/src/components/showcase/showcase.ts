/**
 * Complete-interface showcase catalog (static fictional Harbor Notes data).
 */

export interface ShowcaseScreen {
  /** URL segment under /showcase/ */
  id: string;
  title: string;
  description: string;
  /** Short label on the index card */
  blurb: string;
}

export const SHOWCASE_SCREENS: readonly ShowcaseScreen[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Analytics overview with KPIs and a widget grid.',
    blurb: 'KPIs and widgets',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Account and workspace preferences.',
    blurb: 'Account and workspace',
  },
  {
    id: 'inbox',
    title: 'Inbox',
    description: 'Threaded messages with filters and actions.',
    blurb: 'Messages and filters',
  },
  {
    id: 'kanban',
    title: 'Kanban',
    description: 'Board columns for Harbor Notes delivery work.',
    blurb: 'Board columns',
  },
  {
    id: 'docs',
    title: 'Docs',
    description: 'Documentation page with outline and prose.',
    blurb: 'Docs outline',
  },
  {
    id: 'landing',
    title: 'Landing',
    description: 'Marketing landing with hero and feature grid.',
    blurb: 'Marketing hero',
  },
  {
    id: 'checkout',
    title: 'Checkout',
    description: 'Order summary and payment form chrome.',
    blurb: 'Order and pay',
  },
  {
    id: 'media-studio',
    title: 'Media studio',
    description: 'Composition canvas chrome and export actions.',
    blurb: 'Compose and export',
  },
  {
    id: 'slide-deck',
    title: 'Slide deck',
    description: 'Presentation slides for a product walkthrough.',
    blurb: 'Slides',
  },
] as const;

export function showcasePath(id: string): string {
  return `/showcase/${id}/`;
}
