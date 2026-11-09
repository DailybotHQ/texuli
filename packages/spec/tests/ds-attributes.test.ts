import { describe, expect, it } from 'vitest';
import {
  DS_COLOR_ATTRIBUTE,
  DS_COMPONENT_ATTRIBUTE,
  DS_DENSITY_ATTRIBUTE,
  DS_SIZE_ATTRIBUTE,
  DS_TONE_ATTRIBUTE,
  DS_VARIANT_ATTRIBUTE,
  dsRootAttributes,
} from '../src/design-system/index.ts';

describe('@texuli/spec/design-system root attributes', () => {
  it('exports the stable component and axis attribute names', () => {
    expect([
      DS_COMPONENT_ATTRIBUTE,
      DS_VARIANT_ATTRIBUTE,
      DS_SIZE_ATTRIBUTE,
      DS_TONE_ATTRIBUTE,
      DS_DENSITY_ATTRIBUTE,
      DS_COLOR_ATTRIBUTE,
    ]).toEqual([
      'data-tx-component',
      'data-tx-variant',
      'data-tx-size',
      'data-tx-tone',
      'data-tx-density',
      'data-tx-color',
    ]);
  });

  it('always identifies the component root and includes only provided axes', () => {
    expect(dsRootAttributes('button')).toEqual({ 'data-tx-component': 'button' });
    expect(dsRootAttributes('button', { variant: 'outline', size: 'sm' })).toEqual({
      'data-tx-component': 'button',
      'data-tx-variant': 'outline',
      'data-tx-size': 'sm',
    });
  });

  it('includes every optional axis without changing the values', () => {
    expect(
      dsRootAttributes('button', {
        variant: 'subtle',
        size: 'lg',
        tone: 'danger',
        density: 'compact',
        color: 'chart-3',
      })
    ).toEqual({
      'data-tx-component': 'button',
      'data-tx-variant': 'subtle',
      'data-tx-size': 'lg',
      'data-tx-tone': 'danger',
      'data-tx-density': 'compact',
      'data-tx-color': 'chart-3',
    });
  });

  it('omits the category color default', () => {
    expect(dsRootAttributes('badge', { color: 'none' })).toEqual({ 'data-tx-component': 'badge' });
  });

  it.each(['made-up-component', '', '../button'])('refuses a non-catalog id: %s', (id) => {
    expect(() => dsRootAttributes(id)).toThrow('Unknown Texuli catalog component id');
  });

  it('refuses non-string ids at runtime without coercing them', () => {
    expect(() => dsRootAttributes({ toString: () => 'button' } as unknown as string)).toThrow(
      'Unknown Texuli catalog component id'
    );
  });
});
