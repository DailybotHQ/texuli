/**
 * /design-systems/ page copy that tests read too (PLAN_011 T-site-0100): the
 * release status in one place (the release task changes it when 0.10.0 is
 * published; docs/RELEASE.md is the source) and the four preview surfaces.
 */
/** The surfaces every brand is applied to. */
export type Surface = 'dashboard' | 'slide' | 'document' | 'email';

/** The honest status: design systems are in the 0.10.0 release, which is in development. */
export const DS_STATUS =
  'Design systems are in development for 0.10.0 on the release/0.10.0 branch and ship when 0.10.0 is published. Installs today use the 0.9 line (texuli@^0.9.0 and @texuli/tokens@^0.9.0), which has token contract v2, component tokens and design defaults, the plumbing design systems build on, but not the design-system document, its compiler or the texuli ds commands.';

export interface SurfaceEntry {
  id: Surface;
  title: string;
  note: string;
}

export const DS_SURFACES: readonly SurfaceEntry[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    note: 'Stat cards, a bar chart on the chart palette and a table: density, radius, elevation and type scale all move with the brand.',
  },
  {
    id: 'slide',
    title: 'Deck slide',
    note: 'A title slide on the brand fill, with the on-fill text color the compiler holds to the contrast target.',
  },
  {
    id: 'document',
    title: 'Document page',
    note: 'Title, lead, list, quote, callout and badges, set in the type roles of each brand.',
  },
  {
    id: 'email',
    title: 'Email',
    note: 'An email composition; the real email HTML comes from @texuli/tools/email with the same design system.',
  },
];
