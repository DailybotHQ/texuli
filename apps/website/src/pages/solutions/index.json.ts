/**
 * `/solutions/index.json` — the Solutions registry facts as JSON (ADR-029), prerendered at
 * build time from `solutionsIndexDocument` (`lib/twins/solutions.ts`), so there is no
 * committed file to drift. Lists only Solutions and products whose pages exist.
 */
import { SITE_URL } from '../../lib/constances';
import { solutionsIndexDocument } from '../../lib/twins/solutions.ts';

export function GET(): Response {
  return new Response(`${JSON.stringify(solutionsIndexDocument(SITE_URL), null, 2)}\n`, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
