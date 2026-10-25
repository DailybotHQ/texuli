import type { APIRoute, GetStaticPaths } from 'astro';
import { buildThemeCssFile, libraryThemeIds } from '../../components/perf/theme-build.ts';

/** `/theme-css/<id>.css`: one library theme's CSS, fetched only when a page shows or applies it. */
export const getStaticPaths: GetStaticPaths = async () =>
  (await libraryThemeIds()).map((id) => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) =>
  new Response(await buildThemeCssFile(String(params.id)), {
    headers: { 'content-type': 'text/css; charset=utf-8' },
  });
