import { describe, expect, it } from 'vitest';
import { checkBlueprintAllow } from '../src/design-system/index.ts';

const manifest = {
  allow: {
    card: {
      variants: ['outlined'],
      sizes: ['md'],
      tones: ['neutral'],
      densities: ['comfortable'],
      states: ['disabled'],
    },
  },
};

describe('checkBlueprintAllow', () => {
  it('reports every disallowed component and axis at its node path', () => {
    const result = checkBlueprintAllow(
      {
        format: 'texuli-blueprint',
        tree: {
          id: 'layout-page',
          children: [
            {
              id: 'card',
              props: {
                variant: 'solid',
                size: 'lg',
                tone: 'danger',
                density: 'compact',
                disabled: true,
                loading: true,
              },
            },
            { id: 'button', props: { variant: 'ghost' } },
          ],
        },
      },
      manifest
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map(({ code, path }) => [code, path])).toEqual([
      ['unknown-component', '$.tree.id'],
      ['unknown-variant', '$.tree.children[0].props.variant'],
      ['unknown-size', '$.tree.children[0].props.size'],
      ['unknown-tone', '$.tree.children[0].props.tone'],
      ['unknown-density', '$.tree.children[0].props.density'],
      ['unknown-state', '$.tree.children[0].props.loading'],
      ['unknown-component', '$.tree.children[1].id'],
    ]);
  });

  it('accepts an allowed tree and does not lock documents without an allow set', () => {
    const blueprint = {
      id: 'card',
      props: {
        variant: 'outlined',
        size: 'md',
        tone: 'neutral',
        density: 'comfortable',
        state: 'email',
        disabled: true,
      },
    };
    expect(checkBlueprintAllow(blueprint, manifest)).toEqual({ ok: true, errors: [] });
    expect(checkBlueprintAllow({ id: 'button' }, {})).toEqual({ ok: true, errors: [] });
  });

  it('fails closed when a locked styling axis or state is dynamically bound', () => {
    const result = checkBlueprintAllow(
      {
        id: 'card',
        props: {
          variant: { $state: 'variantChoice' },
          loading: { $state: 'loadingChoice' },
        },
      },
      manifest
    );
    expect(result.errors.map(({ code, path }) => [code, path])).toEqual([
      ['unknown-variant', '$.props.variant'],
      ['unknown-state', '$.props.loading'],
    ]);
  });

  it('does not treat inherited object keys as allowed component ids', () => {
    expect(checkBlueprintAllow({ id: '__proto__' }, manifest).errors).toEqual([
      {
        code: 'unknown-component',
        path: '$.id',
        message: 'Component is not allowed by the design system.',
      },
    ]);
  });
});
