import type { APIRoute } from 'astro';
import { buildGalleryThemeCards } from '../components/gallery-themes/build.ts';

/** `/theme-gallery.json`: every library theme's gallery card, fetched by the gallery after mount. */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildGalleryThemeCards()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
