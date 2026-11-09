import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL } from '../../src/components/foundation/site.ts';
import {
  BLUEPRINT_FIXTURE,
  BLUEPRINT_TRACE,
  blueprintComponents,
  blueprintDiagram,
} from '../../src/components/sections/native/blueprint/blueprint-content.ts';
import { nativeHeroStatus } from '../../src/components/sections/native/hero/hero-content.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const COMPONENT = readFileSync(
  resolve(WEBSITE, 'src/components/sections/native/blueprint/BlueprintDiagram.astro'),
  'utf8'
);
const fixtureText = readFileSync(resolve(REPO, BLUEPRINT_FIXTURE), 'utf8');
const fixture = JSON.parse(fixtureText);
const trace = JSON.parse(readFileSync(resolve(REPO, BLUEPRINT_TRACE), 'utf8')) as {
  golden: string;
};
const view = blueprintDiagram();

describe('One blueprint, many renderers', () => {
  it('shows a real golden fixture, unchanged, with its conformance trace', () => {
    expect(JSON.parse(view.json)).toEqual(fixture);
    expect(view.blueprintId).toBe(fixture.id);
    expect(view.specVersion).toBe(fixture.spec);
    expect(trace.golden).toBe('brand-report');
    expect(BLUEPRINT_FIXTURE).toMatch(/^packages\/spec\/fixtures\/golden\//);
  });

  it('lists the fixture components with their paint status from the parity data', () => {
    expect(view.components.map((c) => c.id)).toEqual(blueprintComponents(fixture.tree));
    const byId = new Map(NATIVE_COMPATIBILITY.components.map((c) => [c.id, c]));
    for (const c of view.components) {
      expect(c.web).toBe(byId.get(c.id)?.web);
      expect(c.composeDesktop).toBe(byId.get(c.id)?.composeDesktop);
    }
  });

  it('draws the four renderers with the native hero statuses; planned ones marked planned', () => {
    const statuses = nativeHeroStatus();
    expect(view.renderers.map((r) => [r.id, r.status])).toEqual(
      statuses.map((s) => [s.id, s.status])
    );
    const byId = Object.fromEntries(view.renderers.map((r) => [r.id, r]));
    expect(byId.web?.via).toBe('@texuli/player');
    expect(byId.web?.planned).toBe(false);
    expect(byId['compose-desktop']?.status).toBe('in development');
    expect(byId.android?.planned).toBe(true);
    expect(byId.ios?.planned).toBe(true);
    expect(view.summary).toContain(`spec ${fixture.spec}`);
    expect(view.summary).toContain('Android and iOS are planned');
  });

  it('links only to the fixture and trace in the repository', () => {
    expect(view.links.map((l) => l.href)).toEqual([
      `${REPOSITORY_URL}/blob/main/${BLUEPRINT_FIXTURE}`,
      `${REPOSITORY_URL}/blob/main/${BLUEPRINT_TRACE}`,
    ]);
    const copy = JSON.stringify({ title: view.title, lede: view.lede, summary: view.summary });
    expect(copy).not.toMatch(/production[- ]ready|write once|run anywhere|coming soon|PLAN_/i);
  });

  it('is static, accessible and sink-free', () => {
    expect(COMPONENT).not.toMatch(/client:|set:html|\{@html|innerHTML|<script/);
    expect(COMPONENT.match(/<h2\b/g)).toHaveLength(1);
    expect(COMPONENT).toContain('aria-labelledby={view.headingId}');
    expect(COMPONENT).toContain(
      '<figcaption class="native-blueprint__caption">{view.summary}</figcaption>'
    );
    expect(COMPONENT).toContain('<summary>View JSON blueprint</summary>');
    expect(COMPONENT).toContain('<code>{view.json}</code>');
    expect(COMPONENT).toContain("safeHref(link.href, 'developer')");
    expect(COMPONENT).toContain("'native-blueprint__node--planned': renderer.planned");
  });
});
