import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { texuliEdgeOps } from '@texuli/tools/ops';
import { describe, expect, it } from 'vitest';
import { agentNoteMarkdown } from '../../src/components/docs/twin-notes.ts';
import { renderTwin } from '../../src/components/docs/twins.ts';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import { registryRoutes } from '../../src/lib/twins/solutions.ts';

const ORIGIN = 'https://texuli.com';
const REPOSITORY = 'https://github.com/DailybotHQ/texuli/blob/main';
const WEBSITE = resolve(import.meta.dirname, '../..');
const OPERATIONS = texuliEdgeOps
  .list({ runtimes: ['edge'] })
  .map(({ name, title }) => ({ name, title }));

const shippedSolutionRoutes = registryRoutes(siteRouteExists).filter(
  ({ kind }) => kind === 'solution'
);

describe('Solution Markdown twin parity', () => {
  it('covers every shipped Solution route in registry order', () => {
    expect(shippedSolutionRoutes.map(({ route }) => route)).toEqual(
      SOLUTIONS.filter((entry) => siteRouteExists(entry.route)).map((entry) => entry.route)
    );
  });

  for (const { route } of shippedSolutionRoutes) {
    const entry = SOLUTIONS.find((candidate) => candidate.route === route);
    if (!entry) throw new Error(`Missing registry entry for ${route}`);

    it(`${route} twin carries registry status, packages, docs and limits`, () => {
      const page = readFileSync(
        resolve(WEBSITE, `src/pages/solutions/${entry.slug}/index.astro`),
        'utf8'
      );
      expect(page, `${route} passes its registry entry to the page layout`).toContain(
        '<SolutionLayout'
      );
      expect(page, `${route} passes its registry entry to the page layout`).toMatch(
        /<SolutionLayout[\s\S]*?\{entry\}/
      );

      // The status is in the rendered page body. renderTwin and agentNoteMarkdown are
      // the same functions the build integration uses for the Markdown twin.
      const html = `<html lang="en"><body><main><h1>${entry.name}</h1><p>Status: ${entry.status}</p></main></body></html>`;
      const note = agentNoteMarkdown(route, OPERATIONS, ORIGIN);
      expect(note, route).toBeDefined();
      const markdown = renderTwin({
        route,
        html,
        facts: { title: entry.name, description: entry.tagline, language: 'en' },
        origin: ORIGIN,
        lastUpdated: '2026-11-08',
        note,
      });

      expect(markdown, route).toContain(`Status: ${entry.status}`);
      for (const pkg of entry.packages)
        expect(markdown, `${route} package ${pkg.name}`).toContain(
          `${REPOSITORY}/packages/${pkg.name === 'texuli' ? 'texuli' : pkg.name.slice('@texuli/'.length)}/README.md`
        );
      if (siteRouteExists(entry.docs)) expect(markdown, route).toContain(`${ORIGIN}${entry.docs}`);
      for (const limit of [...entry.demo.limits, ...entry.limits])
        expect(markdown, `${route} limit ${limit}`).toContain(limit);
    });
  }
});
