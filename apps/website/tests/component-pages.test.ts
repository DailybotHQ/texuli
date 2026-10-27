// @vitest-environment node
/**
 * Component pages (T-81): every page keeps its live stage, examples, editable
 * controls and guidance sections (a page that loses one fails here instead of
 * silently thinning); every family has its differentiator note; the theme
 * strip shows real library themes; and stage seeds keep live demos from
 * repeating a landmark name the page chrome owns (axe `landmark-unique`: the
 * live Breadcrumb once rendered as "Breadcrumb" beside the docs-shell trail).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FAMILY_NOTES, familyNote } from '../src/components/component-pages/family-notes.ts';
import {
  a11yLines,
  COMPONENT_PAGES,
  componentPagesByGroup,
} from '../src/components/component-pages/load-manifests.ts';
import {
  libraryThemeCount,
  loadStripThemes,
  STRIP_THEME_IDS,
  STRIP_VARS,
  stripVarsStyle,
} from '../src/components/component-pages/themes-sample.ts';
import { initialProps } from '../src/components/live/props-state.ts';
import {
  PAGE_STAGE_SEEDS,
  STAGE_CONTROLS,
  seededExampleProps,
} from '../src/components/live/stage-controls.ts';
import { stageFor } from '../src/components/live/stage-map.ts';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const readSource = (fromSrc: string) => readFileSync(resolve(srcDir, fromSrc), 'utf8');
const EDITABLE = new Set(['string', 'number', 'boolean', 'enum']);

describe('component pages', () => {
  it('every page keeps a stage, an example, valid controls, guidance and a family note', () => {
    expect(COMPONENT_PAGES.length).toBeGreaterThan(100);
    const groups = [...componentPagesByGroup().keys()].sort();
    expect(groups).toEqual(['content', 'display', 'forms', 'layouts', 'overlays']);
    expect(Object.keys(FAMILY_NOTES).sort()).toEqual(groups);
    expect(familyNote('not-a-group')).toBeUndefined();

    for (const entry of COMPONENT_PAGES) {
      const id = `"${entry.id}"`;
      const stage = stageFor(entry.id);
      expect(stage?.from, `${id} has no stage`).toContain('/');
      expect(entry.examples.length, `${id} lost its examples`).toBeGreaterThanOrEqual(1);
      expect(Object.hasOwn(STAGE_CONTROLS, entry.id), `${id} not in STAGE_CONTROLS`).toBe(true);
      const editable = new Set(
        entry.props.filter((prop) => EDITABLE.has(prop.kind)).map((prop) => prop.name)
      );
      for (const control of STAGE_CONTROLS[entry.id] ?? []) {
        expect(editable.has(control), `${id} controls non-editable "${control}"`).toBe(true);
      }
      expect(entry.useWhen.length, `${id} has no useWhen`).toBeGreaterThanOrEqual(1);
      expect(entry.dontUseWhen.length, `${id} has no dontUseWhen`).toBeGreaterThanOrEqual(1);
      expect(a11yLines(entry.a11y).length, `${id} has empty a11y notes`).toBeGreaterThanOrEqual(1);
      expect(familyNote(entry.group)?.headline, `${id} has no family note`).toBeTruthy();
    }
  });

  it('the theme strip shows the curated library themes with real engine token values', async () => {
    const themes = await loadStripThemes();
    expect(themes.map((theme) => theme.id)).toEqual([...STRIP_THEME_IDS]);
    expect(new Set(STRIP_THEME_IDS).size).toBe(3);
    for (const theme of themes) {
      expect(theme.name).not.toBe(theme.id);
      expect(['AA', 'AAA']).toContain(theme.contrastLevel);
      for (const name of STRIP_VARS) {
        const value = theme.vars[name];
        expect(value, `${theme.id} misses ${name}`).toBeTruthy();
        if (name === '--tx-radius') expect(value, `${theme.id} ${name}`).toMatch(/(rem|px)$/);
        else expect(value, `${theme.id} ${name}`).toMatch(/^#/);
      }
    }
    expect(new Set(themes.map((theme) => theme.mode))).toEqual(new Set(['light', 'dark']));
    expect(await libraryThemeCount()).toBeGreaterThanOrEqual(210);
    expect(stripVarsStyle({ '--tx-background': '#ffffff', '--tx-radius': '0.5rem' })).toBe(
      '--tx-background:#ffffff;--tx-radius:0.5rem'
    );
  });

  it('stage seeds rename the live Breadcrumb away from the page trail, and examples still win', () => {
    expect(readSource('layouts/BaseLayout.astro')).toContain(
      '<nav class="crumbs" aria-label="Breadcrumb"'
    );
    expect(readSource('components/component-pages/ComponentPageBody.astro')).toContain(
      'props: seededExampleProps(entry.id, example.props)'
    );
    const breadcrumb = COMPONENT_PAGES.find((entry) => entry.id === 'breadcrumb');
    const first = breadcrumb?.examples[0];
    if (!breadcrumb || !first) throw new Error('the breadcrumb page lost its first example');
    expect(breadcrumb.props.find((prop) => prop.name === 'label')?.default).toBe('Breadcrumb');
    const schema = breadcrumb.props
      .filter((prop) => EDITABLE.has(prop.kind))
      .map((prop) => ({
        name: prop.name,
        kind: prop.kind,
        ...(prop.enumValues ? { enumValues: prop.enumValues } : {}),
        ...(prop.default !== undefined ? { default: prop.default } : {}),
      }));
    const values = initialProps(schema, {
      id: first.id,
      title: first.title,
      props: seededExampleProps('breadcrumb', first.props),
    });
    expect(values.label).toBe('Project breadcrumb');
    expect(values.items).toEqual(first.props.items);
    expect(seededExampleProps('breadcrumb', { label: 'Trail' })).toEqual({ label: 'Trail' });
    expect(seededExampleProps('button', { size: 'sm' })).toEqual({ size: 'sm' });

    for (const [id, seed] of Object.entries(PAGE_STAGE_SEEDS)) {
      const entry = COMPONENT_PAGES.find((page) => page.id === id);
      expect(entry?.examples.length ?? 0, id).toBeGreaterThanOrEqual(1);
      for (const name of Object.keys(seed))
        expect(STAGE_CONTROLS[id], `${id}.${name}`).toContain(name);
    }
  });
});
