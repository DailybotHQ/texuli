/**
 * Family differentiators for the component pages (T-81, punch-list row 3).
 *
 * The T-06 census found leads that answer "what is it" in one line but never
 * "why this family here". These notes are per family — the catalog's five
 * groups — not hand-written per page. Every claim names a mechanism the
 * repository proves today: the catalog's sink-free renderer and URL policy,
 * the core overlay texels, the --tx-* token contract, logical CSS, and the
 * manifest-generated tables and MCP exposure of the same data. No invented
 * numbers, no release-status claims.
 */

export interface FamilyNote {
  /** Short differentiator, also reused as the page's meta description tail. */
  headline: string;
  /** One short paragraph shown under the page lead. */
  body: string;
}

export const FAMILY_NOTES: Readonly<Record<string, FamilyNote>> = Object.freeze({
  content: {
    headline: 'Agent-safe content rendering, built in.',
    body:
      'Content ids render through the catalog’s sink-free renderer — no HTML sinks — and ' +
      'every link or image source passes the URL policy. The props, examples and guidance ' +
      'below come from the same closed manifest set the MCP server exposes to agents.',
  },
  display: {
    headline: 'One token contract, every theme.',
    body:
      'Display components take color, radius, density and state styling from the --tx-* ' +
      'token contract — the same variables the theme strip below overrides — so a theme ' +
      'swap re-colors them without per-component fixes.',
  },
  forms: {
    headline: 'Forms with the wiring documented, not guessed.',
    body:
      'Form controls take labels, descriptions and error text through props, and their ' +
      'keyboard and screen-reader behavior is documented in the accessibility notes below ' +
      '— generated from the manifest, not hand-maintained. The repository’s behavior suite ' +
      'holds the underlying patterns on Chromium, WebKit and a Pixel 7.',
  },
  layouts: {
    headline: 'Logical CSS, so right-to-left mirrors correctly.',
    body:
      'Layouts compose with logical CSS properties (inline-size, inset-inline-start), so ' +
      'right-to-left locales mirror without component changes, and full-page layouts ' +
      'render real landmarks (main, banner, contentinfo).',
  },
  overlays: {
    headline: 'Overlay behavior from owned texels.',
    body:
      'Positioning, focus scope, inertness, scroll lock and Escape are framework-free ' +
      'core texels, composed opt-in per component — a tooltip never pays for a dialog’s ' +
      'modal behavior, and Escape closes the topmost layer only.',
  },
});

/**
 * Navigation ids the catalog files under `overlays` (PLAN_014): they are not
 * overlays, so their pages carry the navigation note instead.
 */
export const NAVIGATION_IDS: ReadonlySet<string> = new Set([
  'navigation-menu',
  'breadcrumb',
  'pagination',
  'sidebar',
  'app-nav',
]);

export const NAVIGATION_NOTE: FamilyNote = Object.freeze({
  headline: 'Navigation landmarks that mark where you are.',
  body:
    'Navigation components render a labelled nav landmark and mark the current page or ' +
    'item with aria-current, so assistive technology announces where you are.',
});

/**
 * The note for one catalog group folder name, or `undefined` for an unknown
 * group. Pass the component id to get the navigation note for the
 * navigation ids filed under `overlays`.
 */
export function familyNote(group: string, id?: string): FamilyNote | undefined {
  if (id && NAVIGATION_IDS.has(id)) return NAVIGATION_NOTE;
  return FAMILY_NOTES[group];
}
