// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  activeSolutionRedirects,
  formatCloudflareRedirects,
  resolveSolutionRedirect,
  SOLUTION_REDIRECT_KEEP,
  SOLUTION_REDIRECTS,
  type SolutionRedirect,
  solutionRedirectGraphIssues,
} from '../../../../functions/_middleware.ts';

const ROOT = resolve('.');
const REDIRECTS_FILE = resolve('apps/website/public/_redirects');

function landingExists(to: string): boolean {
  const match = /^\/solutions\/([a-z0-9-]+)\/$/.exec(to);
  if (!match) return false;
  return existsSync(resolve(ROOT, 'apps/website/src/pages/solutions', match[1], 'index.astro'));
}

function activeLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

const enabled = SOLUTION_REDIRECTS.map((rule) => ({ ...rule, enabled: true }));

describe('Solution redirect map (ADR-028)', () => {
  it('lists the five *-page moves, keeps /workflows-page/json/, and ships no chains or loops', () => {
    expect(SOLUTION_REDIRECTS.map((rule) => rule.from)).toEqual([
      '/slides-page/',
      '/documents-page/',
      '/workflows-page/',
      '/canvas-page/',
      '/sheets-page/',
    ]);
    expect(SOLUTION_REDIRECTS.map((rule) => rule.to)).toEqual([
      '/solutions/slides/',
      '/solutions/documents/',
      '/solutions/workflows/',
      '/solutions/canvas/',
      '/solutions/sheets/',
    ]);
    expect(SOLUTION_REDIRECTS.every((rule) => rule.enabled === false)).toBe(true);
    expect(SOLUTION_REDIRECT_KEEP).toEqual(['/workflows-page/json/']);
    expect(solutionRedirectGraphIssues(SOLUTION_REDIRECTS)).toEqual([]);
    expect(solutionRedirectGraphIssues(enabled)).toEqual([]);
  });

  it('emits no redirect whose target page is missing, so the live map is empty until landings ship', () => {
    for (const rule of SOLUTION_REDIRECTS) {
      expect(landingExists(rule.to), rule.to).toBe(false);
    }
    expect(activeSolutionRedirects(SOLUTION_REDIRECTS, landingExists)).toEqual([]);
    expect(activeSolutionRedirects(enabled, landingExists)).toEqual([]);
    expect(activeSolutionRedirects(enabled, () => true)).toHaveLength(5);
  });

  it('keeps public/_redirects in sync with the active map (comments only today)', () => {
    const file = readFileSync(REDIRECTS_FILE, 'utf8');
    expect(activeLines(file)).toEqual(
      activeLines(
        formatCloudflareRedirects(activeSolutionRedirects(SOLUTION_REDIRECTS, landingExists))
      )
    );
    expect(file).toContain('/workflows-page/json/');
    expect(file).not.toMatch(/^\s*\/workflows-page\/json\//m);
  });

  it('does not redirect a kept path, even when the parent move is on', () => {
    const rules: SolutionRedirect[] = enabled;
    expect(resolveSolutionRedirect('/workflows-page/json/', '', { rules })).toBeNull();
    expect(resolveSolutionRedirect('/workflows-page/json', '?x=1', { rules })).toBeNull();
    expect(resolveSolutionRedirect('/workflows-page/json.md', '', { rules })).toBeNull();
  });

  it('resolves HTML, slash variants, query, and Markdown twins in one hop when a rule is on', () => {
    const rules: SolutionRedirect[] = [
      { from: '/slides-page/', to: '/solutions/slides/', enabled: true },
    ];
    expect(resolveSolutionRedirect('/slides-page/', '', { rules })).toEqual({
      location: '/solutions/slides/',
      status: 301,
    });
    expect(resolveSolutionRedirect('/slides-page', '?q=1', { rules })).toEqual({
      location: '/solutions/slides/?q=1',
      status: 301,
    });
    expect(resolveSolutionRedirect('/slides-page.md', '', { rules })).toEqual({
      location: '/solutions/slides.md',
      status: 301,
    });
    expect(
      resolveSolutionRedirect('/slides-page/', '', { rules, accept: 'text/markdown' })
    ).toEqual({ location: '/solutions/slides.md', status: 301 });
    expect(resolveSolutionRedirect('/slides-page/', '', { rules: SOLUTION_REDIRECTS })).toBeNull();
  });
});
