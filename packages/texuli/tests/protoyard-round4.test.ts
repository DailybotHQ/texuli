import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { IMPORTS_BY_ID } from '../../catalog/src/manifest/imports-map.ts';
import { boxManifest } from '../../catalog/src/manifests/display/index.ts';
import { BOX_FILLS, BOX_SURFACES, Box } from '../src/components/typography/index.ts';
import { colorRefInk, colorRefVar, DATA_COLORS, ROLE_COLORS } from '../src/internal/color-ref.ts';

const css = readFileSync(
  resolve(process.cwd(), 'packages/texuli/src/components/typography/typography.css'),
  'utf8'
);
const SOFT_SURFACES = {
  success: ['--tx-success-soft', '--tx-success-soft-foreground'],
  warning: ['--tx-warning-soft', '--tx-warning-soft-foreground'],
  destructive: ['--tx-destructive-soft', '--tx-destructive-soft-foreground'],
  info: ['--tx-info-soft', '--tx-info-soft-foreground'],
  'primary-soft': ['--tx-primary-soft', '--tx-primary-soft-foreground'],
} as const;

afterEach(() => cleanup());

describe('Protoyard round 4 Box data and soft-tone fills', () => {
  it('publishes token fills as a tone axis and surfaces as the variant axis/imports', () => {
    expect(BOX_FILLS).toEqual(['none', ...DATA_COLORS, ...ROLE_COLORS]);
    expect(boxManifest.axes).toMatchObject({ tone: 'fill', variant: 'surface' });
    expect(boxManifest.props.find((prop) => prop.name === 'fill')).toMatchObject({
      kind: 'enum',
      enumValues: [...BOX_FILLS],
      default: 'none',
    });
    expect(boxManifest.props.find((prop) => prop.name === 'surface')?.enumValues).toEqual([
      ...BOX_SURFACES,
    ]);
    const imports = IMPORTS_BY_ID.box.flatMap((entry) => entry.exports);
    expect(imports).toEqual(expect.arrayContaining(['BOX_FILLS', 'BOX_SURFACES', 'ColorRef']));
  });

  it.each(['chart-3', 'destructive'] as const)(
    'renders %s through the shared ColorRef fill and AA ink helpers',
    (fill) => {
      const { container } = render(Box, { props: { fill, surface: 'muted' } });
      const root = container.firstElementChild as HTMLElement;

      expect(root.dataset.txTone).toBe(fill);
      expect(root.dataset.txVariant).toBe('muted');
      expect(root.style.getPropertyValue('--tx-box-fill')).toBe(colorRefVar(fill));
      expect(root.style.getPropertyValue('--tx-box-ink')).toBe(colorRefInk(fill));
    }
  );

  it.each(Object.entries(SOFT_SURFACES))(
    'renders the %s soft surface using its fill token and AA foreground token',
    (surface, [fillToken, inkToken]) => {
      const { container } = render(Box, { props: { surface } });
      const root = container.firstElementChild as HTMLElement;

      expect(root.dataset.txVariant).toBe(surface);
      expect(root.classList.contains(`tx-box--surface-${surface}`)).toBe(true);
      expect(css).toContain(`background-color: var(${fillToken}, Canvas)`);
      expect(css).toContain(`color: var(${inkToken}, CanvasText)`);
    }
  );

  it('rejects arbitrary data fill values without emitting custom colors', () => {
    const { container } = render(Box, { props: { fill: 'red; color: hotpink' as never } });
    const root = container.firstElementChild as HTMLElement;

    expect(root.dataset.txTone).toBe('none');
    expect(root.style.getPropertyValue('--tx-box-fill')).toBe('');
    expect(root.style.getPropertyValue('--tx-box-ink')).toBe('');
  });
});
