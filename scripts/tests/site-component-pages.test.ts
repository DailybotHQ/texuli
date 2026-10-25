/**
 * Unit tests for the texuli.com component-pages generator loaders.
 */
import { describe, expect, it } from 'vitest';
import {
  a11yLines,
  COMPONENT_PAGES,
  componentPagePath,
  componentPager,
  componentPagesByGroup,
  formatExampleProps,
  getComponentPage,
  keyboardRows,
} from '../../apps/website/src/components/component-pages/load-manifests.ts';

describe('site component pages loader', () => {
  it('loads a closed non-empty catalog sorted by id', () => {
    expect(COMPONENT_PAGES.length).toBeGreaterThan(20);
    const ids = COMPONENT_PAGES.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b, 'en')));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves known display components with required sections', () => {
    const badge = getComponentPage('badge');
    expect(badge).toBeDefined();
    expect(badge?.group).toBe('display');
    expect(badge?.label).toBeTruthy();
    expect(badge?.props.length).toBeGreaterThan(0);
    expect(badge?.useWhen.length).toBeGreaterThan(0);
    expect(badge?.dontUseWhen.length).toBeGreaterThan(0);
    expect(a11yLines(badge!.a11y).length).toBeGreaterThan(0);
  });

  it('builds paths and a linear pager', () => {
    expect(componentPagePath('badge')).toBe('/component-pages/badge/');
    const first = COMPONENT_PAGES[0]!;
    const second = COMPONENT_PAGES[1]!;
    const last = COMPONENT_PAGES[COMPONENT_PAGES.length - 1]!;
    expect(componentPager(first.id).prev).toBeUndefined();
    expect(componentPager(first.id).next?.id).toBe(second.id);
    expect(componentPager(last.id).next).toBeUndefined();
    expect(componentPager(last.id).prev?.id).toBe(COMPONENT_PAGES[COMPONENT_PAGES.length - 2]!.id);
  });

  it('groups pages without sharing mutable arrays', () => {
    const byGroup = componentPagesByGroup();
    expect(byGroup.size).toBeGreaterThanOrEqual(5);
    for (const group of ['content', 'display', 'forms', 'layouts', 'overlays']) {
      expect(byGroup.has(group), group).toBe(true);
      expect(byGroup.get(group)!.length).toBeGreaterThan(0);
    }
  });

  it('formats props and extracts keyboard rows from a11y prose', () => {
    expect(formatExampleProps({ variant: 'success' })).toContain('"variant"');
    const rows = keyboardRows('Press Enter or Escape to dismiss. Tab moves focus.');
    expect(rows.some((r) => /Enter/i.test(r.key))).toBe(true);
    const fallback = keyboardRows('Color is never the only cue.');
    expect(fallback).toHaveLength(1);
    expect(fallback[0]!.key).toBe('—');
  });
});
