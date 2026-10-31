/**
 * /design-systems/ page copy that tests read too (PLAN_011 T-site-0100): the
 * release status in one place (the release task of 0.10.0 set it to the
 * published release; docs/RELEASE.md is the source) and the four preview
 * surfaces.
 */
/** The surfaces every brand is applied to. */
export type Surface = 'dashboard' | 'slide' | 'document' | 'email';

/** The honest status: design systems shipped in 0.10.0, a pre-1.0 release. */
export const DS_STATUS =
  'Design systems shipped in 0.10.0 and are on npm in the 0.11 line (texuli@^0.11.0 and @texuli/tokens@^0.11.0), a pre-1.0 release: under 0.x a new minor may contain breaking changes. Earlier lines have the theme engine and token contract v2, but not the design-system document, its compiler or the texuli ds commands.';

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
