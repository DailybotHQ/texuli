import { designSystemStyle } from '@texuli/tokens/design-system/apply';
import type { APIRoute } from 'astro';
import { loadBrands } from '../../components/design-systems/brands.ts';

/**
 * `/design-systems/brands.css`: the three example brands' compiled light
 * variables, one `[data-tx-ds="<id>"]` rule each (`designSystemStyle`),
 * written at build time. A same-origin stylesheet: no inline style for the
 * CSP to hash and no compiler in the browser. The previews pin light mode
 * (`DesignSystemProvider` renders `data-tx-mode="light"`), so the dark
 * rules would never match; the page's report lists both modes.
 */
export const GET: APIRoute = async () => {
  const brands = await loadBrands();
  const css = brands
    .map((brand) => designSystemStyle(brand.compiled, { modes: ['light'] }))
    .join('\n');
  return new Response(`${css}\n`, { headers: { 'content-type': 'text/css; charset=utf-8' } });
};
