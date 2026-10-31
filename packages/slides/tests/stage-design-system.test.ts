/**
 * ADR-024: a standalone deck (`@texuli/deck` model v2) names its design
 * system with `designSystem`, and the stage applies it the way the player
 * applies a blueprint's: a `ref` through the host's `designSystems.resolve`
 * (never a fetch), an inline document compiled lazily at the stage's tier,
 * the variables and scope attributes on the stage root in place of the deck
 * theme's, the component defaults to the texuli components on the slides,
 * and a visible notice (the deck theme still paints) when nothing resolves
 * or the compiler refuses it. It never throws.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { compileDesignSystem } from '@texuli/tokens/design-system/compile';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeckStage from '../src/stage/DeckStage.svelte';
import { clearDeckHash } from './scenario.ts';

const SPEC = join(import.meta.dirname, '../../spec');
const read = (path: string) => JSON.parse(readFileSync(join(SPEC, path), 'utf8'));
const harbor = (read('fixtures/golden/brand-deck.json') as { designSystem: { inline: object } })
  .designSystem.inline as Record<string, unknown>;
const minimal = read('fixtures/design-systems/minimal.json') as Record<string, unknown>;
const outlined = {
  ...harbor,
  components: { button: { radius: 'full', defaults: { variant: 'outline', size: 'sm' } } },
};
const TIMEOUT = { timeout: 30_000 };

const poll = {
  type: 'poll',
  id: 'q1',
  question: 'Which fictional harbor is busiest?',
  options: [
    { id: 'north', label: 'North Pier' },
    { id: 'south', label: 'South Basin' },
  ],
};

const deck = (designSystem?: unknown, extra: Record<string, unknown> = {}) => ({
  formatVersion: 2,
  meta: { title: 'Harbor review' },
  slides: [{ id: 'one', layout: 'free', title: 'One', blocks: [poll] }],
  ...(designSystem === undefined ? {} : { designSystem }),
  ...extra,
});

afterEach(() => {
  cleanup();
  clearDeckHash();
});

function paint(input: unknown, props: Record<string, unknown> = {}) {
  const onDesignSystem = vi.fn();
  const view = render(DeckStage, {
    props: { deck: input, loadTheme: null, syncHash: false, onDesignSystem, ...props },
  });
  const root = () => view.container.querySelector<HTMLElement>('.tx-deck-stage') as HTMLElement;
  return { ...view, root, onDesignSystem };
}

async function settled(root: () => HTMLElement): Promise<string | null> {
  await waitFor(
    () => expect(root().getAttribute('data-tx-deck-design-system')).toMatch(/^(applied|refused)$/),
    { timeout: 20_000 }
  );
  return root().getAttribute('data-tx-deck-design-system');
}

const submit = async () => {
  const button = await screen.findByRole('button', { name: /submit|vote/i }, { timeout: 10_000 });
  return button;
};

describe('the stage applies a deck design system', () => {
  it(
    'compiles an inline document, writes its tokens and attributes on the stage root and hands its defaults to the slides',
    TIMEOUT,
    async () => {
      const { root, onDesignSystem } = paint(deck({ inline: outlined }));
      expect(await settled(root)).toBe('applied');
      expect(root().getAttribute('data-tx-ds')).toBe('harbor');
      expect(root().hasAttribute('data-tx-scope')).toBe(true);
      expect(root().getAttribute('data-tx-mode')).toBe('light');
      expect(root().style.getPropertyValue('--tx-primary')).toBe('#0f766e');
      expect(onDesignSystem).toHaveBeenCalledWith({
        status: 'applied',
        id: 'harbor',
        source: 'inline',
      });
      expect(root().querySelector('[data-tx-deck-design-system-notice]')).toBeNull();
      // The poll's submit button takes the design system's default variant and size.
      const button = await submit();
      await waitFor(() => expect(button.className).toContain('tx-button--outline'));
      expect(button.className).toContain('tx-button--sm');
      // An explicit prop wins: the reset button is `secondary` in the block.
      await fireEvent.click(screen.getByRole('radio', { name: 'North Pier' }));
      await fireEvent.click(button);
      const reset = await screen.findByRole('button', { name: /reset|change|again/i });
      expect(reset.className).toContain('tx-button--secondary');
      expect(reset.className).toContain('tx-button--sm');
    }
  );

  it(
    'resolves a reference through the host, in the host mode, from a document or a compiled copy',
    TIMEOUT,
    async () => {
      const resolve = vi.fn((ref: string) => (ref === 'harbor@1.2.0' ? harbor : undefined));
      const a = paint(deck({ ref: 'harbor@1.2.0' }), { designSystems: { resolve, mode: 'dark' } });
      expect(await settled(a.root)).toBe('applied');
      expect(resolve).toHaveBeenCalledWith('harbor@1.2.0');
      expect(a.root().getAttribute('data-tx-mode')).toBe('dark');
      expect(a.onDesignSystem).toHaveBeenCalledWith({
        status: 'applied',
        id: 'harbor',
        source: 'ref',
      });
      cleanup();

      const compiled = compileDesignSystem(harbor);
      if (!compiled.ok) throw new Error('harbor compiles');
      const cached = JSON.parse(JSON.stringify(compiled));
      const b = paint(deck({ ref: 'harbor@1.2.0' }), {
        designSystems: { resolve: async () => cached },
      });
      expect(await settled(b.root)).toBe('applied');
      expect(b.root().style.getPropertyValue('--tx-primary')).toBe(
        compiled.vars.light?.['--tx-primary']
      );
    }
  );

  it(
    'keeps the deck theme with a visible notice when nothing resolves or the document is refused',
    TIMEOUT,
    async () => {
      const cases: [string, unknown, Record<string, unknown>, string][] = [
        ['no resolver', { ref: 'harbor@1.2.0' }, {}, 'design-system-unresolved'],
        [
          'resolver throws',
          { ref: 'harbor@1.2.0' },
          {
            designSystems: {
              resolve: () => {
                throw new Error('offline');
              },
            },
          },
          'design-system-refused',
        ],
        [
          'wrong document',
          { ref: 'harbor@1.2.0' },
          { designSystems: { resolve: () => minimal } },
          'design-system-refused',
        ],
        [
          'contrast refused',
          {
            inline: {
              ...minimal,
              color: {
                brand: { seed: '#4f46e5' },
                roles: { light: { foreground: '#ffffff', background: '#ffffff' } },
              },
            },
          },
          {},
          'aa-text',
        ],
        [
          'data URL at the untrusted tier',
          {
            inline: { ...minimal, assets: { favicon: `data:image/png;base64,${'A'.repeat(64)}` } },
          },
          {},
          'url-refused',
        ],
      ];
      for (const [name, designSystem, props, code] of cases) {
        const seed = { kind: 'embedded', theme: { id: 'fallback', light: {}, dark: {} } };
        const { root, onDesignSystem } = paint(
          deck(designSystem, { style: { theme: seed } }),
          props
        );
        expect(await settled(root), name).toBe('refused');
        expect(onDesignSystem.mock.calls[0]?.[0], name).toMatchObject({ status: 'refused', code });
        const notice = root().querySelector('[data-tx-deck-design-system-notice]');
        expect(notice?.getAttribute('role'), name).toBe('status');
        expect(notice?.textContent, name).toContain('Showing the deck theme');
        expect(root().hasAttribute('data-tx-ds'), name).toBe(false);
        expect(root().hasAttribute('data-tx-scope'), name).toBe(false);
        // The deck theme still owns the root, and the slides still paint.
        expect(root().getAttribute('data-tx-theme'), name).toBe('fallback');
        expect(root().querySelector('[data-slide-id="one"]'), name).not.toBeNull();
        cleanup();
      }
    }
  );

  it(
    'restores the deck theme and the library defaults when the design system goes, and costs nothing without one',
    TIMEOUT,
    async () => {
      const { root, rerender, onDesignSystem } = paint(deck({ inline: outlined }));
      expect(await settled(root)).toBe('applied');
      const button = await submit();
      await waitFor(() => expect(button.className).toContain('tx-button--outline'));
      await rerender({ deck: deck() });
      await waitFor(() => expect(root().hasAttribute('data-tx-deck-design-system')).toBe(false));
      expect(root().hasAttribute('data-tx-ds')).toBe(false);
      expect(root().hasAttribute('data-tx-scope')).toBe(false);
      expect(root().style.getPropertyValue('--tx-primary')).toBe('');
      const plain = await submit();
      await waitFor(() => expect(plain.className).toContain('tx-button--default'));
      expect(plain.className).toContain('tx-button--md');
      expect(onDesignSystem).toHaveBeenCalledTimes(1);
    }
  );
});
