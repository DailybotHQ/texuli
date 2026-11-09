// @vitest-environment node
/**
 * Catalog widening, app set (T-widen-app, ADR-032): Tabs, Accordion, Composer,
 * mobile chrome, the existing sheet (bottom sheet), data-board (kanban) and
 * toaster (notice) are catalog ids the allow set governs. Host chrome is
 * never agent-emittable.
 */
import { describe, expect, it } from 'vitest';
import { emitTiers } from '../src/build/tiers.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';

const byId = new Map(
  ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).map((manifest) => [manifest.id, manifest])
);

describe('catalog widening: app set', () => {
  it('catalogues tabs, accordion, composer, mobile chrome, sheet, board and notice', () => {
    expect(byId.get('tabs')?.package).toBe('texuli');
    expect(byId.get('accordion')?.package).toBe('texuli');
    expect(byId.get('composer')?.package).toBe('@texuli/chat');
    expect(byId.get('mobile-header')?.package).toBe('texuli');
    expect(byId.get('bottom-nav')?.package).toBe('texuli');
    expect(byId.get('sheet')?.package).toBe('texuli');
    expect(byId.get('data-board')?.package).toBe('@texuli/data');
    expect(byId.get('toaster')?.label).toMatch(/toast/i);
  });

  it('keeps host chrome out of every emit tier while the allow set can still name it', () => {
    for (const id of ['composer', 'mobile-header', 'bottom-nav', 'sheet', 'tabs', 'accordion']) {
      const manifest = byId.get(id);
      expect(manifest, id).toBeDefined();
      expect(manifest?.agentEmittable, id).toBe(false);
      const group = ALL_MANIFEST_GROUPS.find((entry) =>
        entry.manifests.some((item) => item.id === id)
      );
      expect(emitTiers(manifest!, group!.name), id).toEqual([]);
    }
  });
});
