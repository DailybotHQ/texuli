import type { APIRoute, GetStaticPaths } from 'astro';
import { buildExplorerThemeFile, libraryThemeIds } from '../../components/perf/theme-build.ts';

/** `/theme-data/<id>.json`: the color explorer payload of one theme, fetched when it is selected. */
export const getStaticPaths: GetStaticPaths = async () =>
  (await libraryThemeIds()).map((id) => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) =>
  new Response(JSON.stringify((await buildExplorerThemeFile(String(params.id))) ?? null), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
