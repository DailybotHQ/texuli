import type { APIRoute } from 'astro';
import { buildThemeCatalog } from '../components/theme-switcher/library.ts';

/** `/theme-catalog-dark.json`: each theme's dark swatches, fetched by the switcher only in dark mode. */
export const GET: APIRoute = async () =>
  new Response(
    JSON.stringify(
      (await buildThemeCatalog())
        .filter((row) => row.swatchesDark)
        .map((row) => ({ id: row.id, swatches: row.swatchesDark }))
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8' } }
  );
