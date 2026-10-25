/**
 * Examples that are full-page layouts (own main/nav/headings). On the listing
 * they stay inert with a link to the isolated preview; they never mount inside
 * the docs shell iframe slot as a competing document tree is enough isolation
 * but listing still avoids loading heavy shells until the preview opens.
 */
export const FULL_PAGE_EXAMPLE_IDS: readonly string[] = Object.freeze([
  'layout-blog-content',
  'layout-docs-content',
  'layout-editorial-content',
  'layouts-auth-settings',
  'layouts-dashboard',
  'layouts-marketing',
  'layouts-mobile-drawer',
  'layouts-mobile-rtl',
  'layouts-mobile-tabs',
  'texuli-app-layouts',
  'texuli-sidebar',
  'data-activity',
]);

export function isFullPageExample(id: string): boolean {
  return FULL_PAGE_EXAMPLE_IDS.includes(id);
}

/** Build the same-origin preview URL for an example. */
export function examplePreviewHref(
  base: string,
  id: string,
  opts: { mode?: 'light' | 'dark'; dir?: 'ltr' | 'rtl'; embed?: boolean } = {}
): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const params = new URLSearchParams();
  if (opts.mode && opts.mode !== 'light') params.set('mode', opts.mode);
  if (opts.dir && opts.dir !== 'ltr') params.set('dir', opts.dir);
  // Iframe hosts pass embed: true → embed=1 (inert isolation). Solo tabs omit or embed: false.
  if (opts.embed === true) params.set('embed', '1');
  else if (opts.embed === false) params.set('embed', '0');
  const q = params.toString();
  const path = `${root}/examples/preview/${encodeURIComponent(id)}/`;
  return q ? `${path}?${q}` : path;
}
