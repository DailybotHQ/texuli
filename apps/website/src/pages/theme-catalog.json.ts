import type { APIRoute } from 'astro';
import { buildThemeCatalog } from '../components/theme-switcher/library.ts';

/**
 * `/theme-catalog.json`: every library theme's switcher row, fetched by the
 * switcher after mount. Dark swatches live in `/theme-catalog-dark.json`,
 * fetched only while the site is dark.
 */
export const GET: APIRoute = async () =>
  new Response(
    JSON.stringify((await buildThemeCatalog()).map(({ swatchesDark: _dark, ...row }) => row)),
    {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );
