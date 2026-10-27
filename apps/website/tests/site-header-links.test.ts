/**
 * T-84 (routed from T-79 core row 9): the landing header carries a GitHub
 * door next to the platform doors, through the URL policy at the developer
 * tier, from the same repository constant the footer uses. It hides up to
 * 64rem (the `data-repo-door` hook) and the platform doors hide up to 48rem,
 * so phones keep only the logo and Docs (site-ia.spec.ts pins 6 desktop / 2
 * phone links; site-responsive.spec.ts walks the breakpoints).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL } from '../src/components/foundation/site.ts';

const foundation = join(import.meta.dirname, '..', 'src', 'components', 'foundation');
const header = readFileSync(join(foundation, 'SiteHeader.astro'), 'utf8');
const footer = readFileSync(join(foundation, 'SiteFooter.astro'), 'utf8');

describe('landing header GitHub door', () => {
  it('points at the public repository', () => {
    expect(REPOSITORY_URL).toBe('https://github.com/DailybotHQ/texuli');
  });

  it('renders the repository link through safeHref at the developer tier', () => {
    expect(header).toContain("safeHref(REPOSITORY_URL, 'developer')");
    expect(header).toMatch(/class="platform-links"[^>]*>\s*<a[^>]*href=\{repositoryHref\}/);
  });

  it('shares the repository constant with the footer instead of a second literal', () => {
    expect(footer).toContain('REPOSITORY_URL');
    expect(footer).not.toContain("'https://github.com/DailybotHQ/texuli'");
  });
});
