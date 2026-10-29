/**
 * /output-page/preview/ — the weekly digest as the email
 * `@texuli/tools/email` writes, served as its own static document so
 * /output-page/ can show it in an `<iframe sandbox>` (no scripts, no same
 * origin) without any HTML sink in the site: the HTML is produced at build
 * time by the package, which escapes every value by construction, and is
 * written to dist as a file. The CSP integration gives it its own policy
 * (hashes for its inline style attributes, nothing else). The only change
 * here is a fixed `noindex` meta, so it stays out of the sitemap.
 */
import { renderEmail } from '@texuli/tools/email';
import type { APIRoute } from 'astro';
import { EMAIL_OPTIONS, WEEKLY_DIGEST } from '../../../components/output-site/drafts.ts';

export const prerender = true;

export const GET: APIRoute = () => {
  const result = renderEmail(WEEKLY_DIGEST, EMAIL_OPTIONS);
  if (!result.ok) {
    throw new Error(
      `The weekly digest did not render: ${result.diagnostics.map((entry) => entry.code).join(', ')}`
    );
  }
  const html = result.html.replace('<head>', '<head><meta name="robots" content="noindex">');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
