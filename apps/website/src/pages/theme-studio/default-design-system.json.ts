import { compileDesignSystem } from '@texuli/tokens/design-system/compile';
import type { APIRoute } from 'astro';
import { seedDocument } from '../../components/theme-studio/ds-studio.ts';

/**
 * `/theme-studio/default-design-system.json`: the studio's starting document
 * and its compiled form, built once at build time. The island fetches it
 * after mount, so the first preview, contrast report and diff need no
 * compiler; the compiler loads only when the visitor starts editing.
 */
export const GET: APIRoute = () => {
  const document = seedDocument();
  const compiled = compileDesignSystem(document, { trust: 'untrusted' });
  if (!compiled.ok) {
    throw new Error(
      `The studio's default design system does not compile: ${compiled.errors[0]?.code}`
    );
  }
  return new Response(JSON.stringify({ document, compiled }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
