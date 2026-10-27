/**
 * T-81 — punch-list row 5: the live-demo stage gate for component pages.
 *
 * The T-06 census could not see which of the 133 demo stages were thin; this
 * gate pins the census's measured baseline as a regression test: every
 * component page resolves a stage family, ships at least one example, is
 * present in the stage-controls table, and carries the guidance sections the
 * template renders (a11y, useWhen, dontUseWhen). A component that loses its
 * stage, its examples or its guidance now fails here instead of silently
 * thinning the page. Thin-stage example needs are routed to T-85's
 * registration list, not fixed here.
 */
import { describe, expect, it } from 'vitest';
import { a11yLines, COMPONENT_PAGES } from '../src/components/component-pages/load-manifests.ts';
import { STAGE_CONTROLS } from '../src/components/live/stage-controls.ts';
import { stageFor } from '../src/components/live/stage-map.ts';

describe('every component page keeps its live stage', () => {
  it('resolves a stage family for all pages', () => {
    expect(COMPONENT_PAGES.length).toBeGreaterThan(100);
    for (const entry of COMPONENT_PAGES) {
      const stage = stageFor(entry.id);
      expect(stage, `no stage for "${entry.id}"`).toBeDefined();
      expect(stage?.from).toContain('/');
      expect(stage?.name.length).toBeGreaterThan(0);
    }
  });

  it('ships at least one curated example per page', () => {
    for (const entry of COMPONENT_PAGES) {
      expect(entry.examples.length, `"${entry.id}" lost its examples`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has a stage-controls row for every page (possibly empty)', () => {
    for (const entry of COMPONENT_PAGES) {
      expect(
        Object.hasOwn(STAGE_CONTROLS, entry.id),
        `"${entry.id}" is missing from STAGE_CONTROLS`
      ).toBe(true);
      const editable = new Set(
        entry.props
          .filter((prop) => ['string', 'number', 'boolean', 'enum'].includes(prop.kind))
          .map((prop) => prop.name)
      );
      for (const control of STAGE_CONTROLS[entry.id] ?? []) {
        expect(
          editable.has(control),
          `"${entry.id}" controls prop "${control}" that its manifest does not offer as editable`
        ).toBe(true);
      }
    }
  });
});

describe('every component page keeps its guidance sections', () => {
  it('populates use-when and don’t-use-when on all pages', () => {
    for (const entry of COMPONENT_PAGES) {
      expect(entry.useWhen.length, `"${entry.id}" has no useWhen`).toBeGreaterThanOrEqual(1);
      expect(entry.dontUseWhen.length, `"${entry.id}" has no dontUseWhen`).toBeGreaterThanOrEqual(
        1
      );
    }
  });

  it('populates the accessibility notes on all pages', () => {
    for (const entry of COMPONENT_PAGES) {
      expect(
        a11yLines(entry.a11y).length,
        `"${entry.id}" has empty a11y notes`
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
