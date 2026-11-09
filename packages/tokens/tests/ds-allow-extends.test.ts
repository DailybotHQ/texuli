import { designSystemContentHash } from '@texuli/spec/design-system';
import { describe, expect, it } from 'vitest';
import { type CompiledDesignSystem, compileDesignSystem } from '../src/design-system/compile.ts';

const minimal = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'child',
  version: '1.0.0',
  name: 'Child',
  color: { brand: { seed: '#4f46e5' } },
};

const parent = {
  ...minimal,
  id: 'parent',
  name: 'Parent',
  allow: {
    button: { variants: ['default', 'outline'], sizes: ['sm', 'md'], states: ['hover'] },
    card: { variants: ['elevated'] },
  },
  library: [
    {
      id: 'pricing-card',
      name: 'Pricing card',
      purpose: 'A fictional pricing panel.',
      version: '0.3.0',
      status: 'draft',
      composes: ['card', 'button'],
    },
  ],
};

const ok = (result: ReturnType<typeof compileDesignSystem>): CompiledDesignSystem => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
};

describe('design-system allow inheritance', () => {
  it('inherits entries, replaces explicitly listed axes, and preserves the source content hash', () => {
    const child = {
      ...minimal,
      extends: 'parent@1.0.0',
      allow: {
        button: { variants: ['outline'], states: [] },
        badge: { variants: ['default'] },
      },
    };

    const compiled = ok(
      compileDesignSystem(child, {
        resolve: (ref) => (ref === 'parent@1.0.0' ? parent : undefined),
        trust: 'developer',
      })
    );

    expect(compiled.allowManifest.allow).toEqual({
      badge: { variants: ['default'] },
      button: { variants: ['outline'], sizes: ['sm', 'md'], states: [] },
      card: { variants: ['elevated'] },
    });
    expect(compiled.allowManifest.library).toEqual([
      { id: 'pricing-card', version: '0.3.0', status: 'draft' },
    ]);
    expect(compiled.allowManifest.version).toBe(child.version);
    expect(compiled.allowManifest.contentHash).toBe(designSystemContentHash(child));
  });

  it('applies variant and patch precedence after extends, with null removal and array replacement', () => {
    const child = {
      ...minimal,
      extends: 'parent@1.0.0',
      allow: { button: { variants: ['outline', 'ghost'] } },
      variants: {
        narrow: {
          allow: {
            button: { variants: ['outline'] },
            card: { variants: [] },
            badge: { variants: ['default'] },
          },
        },
      },
    };

    const compiled = ok(
      compileDesignSystem(child, {
        resolve: (ref) => (ref === 'parent@1.0.0' ? parent : undefined),
        variant: 'narrow',
        patches: [
          {
            allow: {
              button: { variants: ['default'] },
              badge: { variants: [] },
              card: null,
            },
          },
        ],
        trust: 'developer',
      })
    );

    expect(compiled.allowManifest.allow).toEqual({
      badge: { variants: [] },
      button: { variants: ['default'], sizes: ['sm', 'md'], states: ['hover'] },
    });
  });
});
