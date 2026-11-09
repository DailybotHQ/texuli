import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { boxManifest } from '../../catalog/src/manifests/display/index.ts';
import { BOX_FILLS, Box } from '../src/components/typography/index.ts';
import { colorRefInk, colorRefVar, DATA_COLORS, ROLE_COLORS } from '../src/internal/color-ref.ts';

afterEach(() => cleanup());

describe('Box token-reference fill', () => {
  it('uses the shared closed color references and publishes them as a tone axis', () => {
    expect(BOX_FILLS).toEqual(['none', ...DATA_COLORS, ...ROLE_COLORS]);
    expect(boxManifest.axes?.tone).toBe('fill');
    expect(boxManifest.axes?.variant).toBe('surface');
    expect(boxManifest.props.find((prop) => prop.name === 'fill')).toMatchObject({
      kind: 'enum',
      enumValues: [...BOX_FILLS],
      default: 'none',
    });
  });

  it.each(['chart-3', 'destructive'] as const)(
    'renders %s through the shared token and foreground resolvers',
    (fill) => {
      const { container } = render(Box, { props: { fill, surface: 'muted' } });
      const root = container.firstElementChild as HTMLElement;

      expect(root.dataset.txTone).toBe(fill);
      expect(root.dataset.txVariant).toBe('muted');
      expect(root.style.getPropertyValue('--tx-box-fill')).toBe(colorRefVar(fill));
      expect(root.style.getPropertyValue('--tx-box-ink')).toBe(colorRefInk(fill));
    }
  );

  it('rejects arbitrary values and keeps the surface fill when no valid reference is given', () => {
    const { container } = render(Box, { props: { fill: 'red; color: hotpink' as never } });
    const root = container.firstElementChild as HTMLElement;

    expect(root.dataset.txTone).toBe('none');
    expect(root.style.getPropertyValue('--tx-box-fill')).toBe('');
    expect(root.style.getPropertyValue('--tx-box-ink')).toBe('');
  });
});
