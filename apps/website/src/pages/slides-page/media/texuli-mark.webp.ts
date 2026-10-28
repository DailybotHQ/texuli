import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';

/**
 * `/slides-page/media/texuli-mark.webp`: the brand isotype at a path the
 * flagship deck can reference. Deck media accepts relative paths without
 * `..` or a leading `/`, so an image for this page has to live under
 * `/slides-page/`. Built once at build time from `public/brand/` (the build
 * runs in the website package directory).
 */
export const GET: APIRoute = async () =>
  new Response(
    new Uint8Array(
      await readFile(resolve(process.cwd(), 'public/brand/texuli-isotype-light.webp'))
    ),
    { headers: { 'content-type': 'image/webp' } }
  );
