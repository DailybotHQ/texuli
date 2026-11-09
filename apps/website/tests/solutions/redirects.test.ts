import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveSolutionRedirect,
  SOLUTION_REDIRECT_KEEP,
  SOLUTION_REDIRECTS,
  solutionRedirectGraphIssues,
} from '../../../../functions/_middleware.ts';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';

const REDIRECTS = readFileSync(resolve(import.meta.dirname, '../../public/_redirects'), 'utf8');
const active = REDIRECTS.split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));

describe('the applied Solution redirect map (ADR-028, first wave)', () => {
  it('moves every replaced *-page route to its landing, both slash forms, as one 301 hop', () => {
    const expected = SOLUTIONS.flatMap((entry) => {
      const from = entry.replaces ?? '';
      return [
        [from.slice(0, -1), entry.route, '301'],
        [from, entry.route, '301'],
      ];
    });
    expect(active).toEqual(expected);
    for (const [, to] of active) expect(siteRouteExists(to ?? ''), to).toBe(true);
  });

  it('has no chains or loops and never moves a kept path', () => {
    expect(solutionRedirectGraphIssues(SOLUTION_REDIRECTS)).toEqual([]);
    const sources = new Set(active.map(([from]) => from));
    for (const [, to] of active) expect(sources.has(to)).toBe(false);
    for (const kept of SOLUTION_REDIRECT_KEEP) {
      expect(sources.has(kept)).toBe(false);
      expect(resolveSolutionRedirect(kept, '', {})).toBeNull();
    }
  });

  it('redirects the Markdown twin of each moved page to the landing twin, keeping the query', () => {
    for (const entry of SOLUTIONS) {
      const from = entry.replaces ?? '';
      const twin = `${entry.route.slice(0, -1)}.md`;
      expect(resolveSolutionRedirect(`${from.slice(0, -1)}.md`, '', {})).toEqual({
        location: twin,
        status: 301,
      });
      expect(resolveSolutionRedirect(from, '?a=1', {})).toEqual({
        location: `${entry.route}?a=1`,
        status: 301,
      });
    }
  });
});
