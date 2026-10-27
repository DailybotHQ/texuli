/**
 * Component-page stage seeds: a live demo never repeats a landmark the page
 * chrome already names. Regression: once the first demo mounted on load
 * again, `/component-pages/breadcrumb/` showed the live Breadcrumb under its
 * library default name, "Breadcrumb", next to the docs-shell trail of the
 * same name (BaseLayout, 7996bbd7): axe `landmark-unique` in every mode.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGES } from '../src/components/component-pages/load-manifests.ts';
import { initialProps } from '../src/components/live/props-state.ts';
import {
  PAGE_STAGE_SEEDS,
  STAGE_CONTROLS,
  seededExampleProps,
} from '../src/components/live/stage-controls.ts';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const layout = readFileSync(resolve(srcDir, 'layouts/BaseLayout.astro'), 'utf8');
const body = readFileSync(
  resolve(srcDir, 'components/component-pages/ComponentPageBody.astro'),
  'utf8'
);

const breadcrumb = COMPONENT_PAGES.find((entry) => entry.id === 'breadcrumb');
const editable = new Set(['string', 'number', 'boolean', 'enum']);
const schemaOf = (entry: NonNullable<typeof breadcrumb>) =>
  entry.props
    .filter((prop) => editable.has(prop.kind))
    .map((prop) => ({
      name: prop.name,
      kind: prop.kind,
      ...(prop.enumValues ? { enumValues: prop.enumValues } : {}),
      ...(prop.default !== undefined ? { default: prop.default } : {}),
    }));

describe('page stage seeds', () => {
  it('the docs-shell trail owns the "Breadcrumb" navigation name', () => {
    expect(layout).toContain('<nav class="crumbs" aria-label="Breadcrumb"');
  });

  it('the live Breadcrumb starts under a different name than the page trail', () => {
    expect(breadcrumb).toBeDefined();
    if (!breadcrumb) return;
    // The library default is the very name the page trail carries.
    const label = breadcrumb.props.find((prop) => prop.name === 'label');
    expect(label?.default).toBe('Breadcrumb');
    const [first] = breadcrumb.examples;
    expect(first).toBeDefined();
    if (!first) return;
    const values = initialProps(schemaOf(breadcrumb), {
      id: first.id,
      title: first.title,
      props: seededExampleProps('breadcrumb', first.props),
    });
    expect(values.label).toBe('Project breadcrumb');
    expect(values.label).not.toBe('Breadcrumb');
    // The example's own fixtures still reach the stage.
    expect(values.items).toEqual(first.props.items);
  });

  it('an example value still wins over the page seed', () => {
    expect(seededExampleProps('breadcrumb', { label: 'Trail' })).toEqual({ label: 'Trail' });
    expect(seededExampleProps('button', { size: 'sm' })).toEqual({ size: 'sm' });
  });

  it('every seed targets a real page, with examples, and a prop its panel edits', () => {
    for (const [id, seed] of Object.entries(PAGE_STAGE_SEEDS)) {
      const entry = COMPONENT_PAGES.find((page) => page.id === id);
      expect(entry, id).toBeDefined();
      // The seed rides the example props, so the page must ship one.
      expect(entry?.examples.length ?? 0, id).toBeGreaterThanOrEqual(1);
      for (const name of Object.keys(seed)) {
        expect(STAGE_CONTROLS[id], `${id}.${name}`).toContain(name);
      }
    }
  });

  it('the component page passes the seeded props to every example demo', () => {
    expect(body).toContain('props: seededExampleProps(entry.id, example.props)');
  });
});
