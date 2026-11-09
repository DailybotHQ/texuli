import { describe, expect, it } from 'vitest';
import {
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
    ]).toEqual([
      'data-tx-component',
      'data-tx-variant',
      'data-tx-size',
      'data-tx-tone',
      'data-tx-density',
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
      })
    ).toEqual({
      'data-tx-component': 'button',
      'data-tx-variant': 'subtle',
      'data-tx-size': 'lg',
      'data-tx-tone': 'danger',
      'data-tx-density': 'compact',
    });
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
