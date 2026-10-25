/**
 * Unit tests for live demo prop state helpers and marker registry.
 */
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGES } from '../../apps/website/src/components/component-pages/load-manifests.ts';
import { LIVE_CATALOG_IDS, LIVE_MARKERS } from '../../apps/website/src/components/live/markers.ts';
import {
  editableProps,
  formatLiveCode,
  initialProps,
  type LivePropSchema,
} from '../../apps/website/src/components/live/props-state.ts';

const schema: LivePropSchema[] = [
  { name: 'variant', kind: 'enum', enumValues: ['default', 'outline'], default: 'default' },
  { name: 'disabled', kind: 'boolean', default: false },
  { name: 'label', kind: 'string' },
  { name: 'count', kind: 'number', default: 3 },
  { name: 'onClick', kind: 'event' },
  { name: 'children', kind: 'slot' },
];

describe('site live components props-state', () => {
  it('exposes only editable prop kinds', () => {
    expect(editableProps(schema).map((p) => p.name)).toEqual([
      'variant',
      'disabled',
      'label',
      'count',
    ]);
  });

  it('seeds props from example then defaults', () => {
    const values = initialProps(schema, {
      id: 'outline',
      title: 'Outline',
      props: { variant: 'outline', label: 'Save' },
    });
    expect(values.variant).toBe('outline');
    expect(values.label).toBe('Save');
    expect(values.disabled).toBe(false);
    expect(values.count).toBe(3);
  });

  it('formats a live code sample from props', () => {
    const code = formatLiveCode('texuli/button', 'Button', {
      variant: 'outline',
      disabled: true,
      size: 'sm',
    });
    expect(code).toContain("import { Button } from 'texuli/button'");
    expect(code).toContain('variant={"outline"}');
    expect(code).toContain('disabled');
  });
});

describe('live markers registry', () => {
  it('covers every catalog component id exactly once', () => {
    const catalog = COMPONENT_PAGES.map((p) => p.id).sort((a, b) => a.localeCompare(b, 'en'));
    expect([...LIVE_CATALOG_IDS]).toEqual(catalog);
    expect(Object.keys(LIVE_MARKERS).sort((a, b) => a.localeCompare(b, 'en'))).toEqual(catalog);
  });
});
