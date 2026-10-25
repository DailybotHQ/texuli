import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeFrameOptions } from '../src/embed/protocol.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

// Vitest runs from the repository root, and does not apply imported CSS.
const css = readFileSync(join(process.cwd(), 'packages/player/src/player.css'), 'utf8');
/** The stylesheet without comments, for rule-level checks. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

const page = (children: unknown[] = []) => ({
  id: 'layout-page',
  props: { title: 'Motion' },
  children,
});

/** A controllable stand-in for `window.matchMedia('(prefers-reduced-motion: reduce)')`. */
function mockReducedMotion(initial: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => media as unknown as MediaQueryList);
  return {
    set(matches: boolean) {
      media.matches = matches;
      for (const listener of listeners) listener();
    },
  };
}

async function paint(extra: Record<string, unknown> = {}, children: unknown[] = []) {
  const view = render(Player, {
    props: { blueprint: page(children), loaders: PLAYER_LOADERS, ...extra },
  });
  await screen.findByRole('heading', { level: 1, name: 'Motion' }, { timeout: 5000 });
  await tick();
  return view;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const style of document.head.querySelectorAll('style[data-motion-test]')) style.remove();
  document.body.innerHTML = '';
});

describe('motion policy in the stylesheet', () => {
  it('times every player-owned transition and animation with the motion tokens', () => {
    const declarations = [
      ...rules.matchAll(/(?:^|[;{\s])(transition|animation)(?:-duration)?\s*:\s*([^;}]+)/g),
    ];
    expect(declarations.length).toBeGreaterThan(0);
    for (const [, property, value] of declarations) {
      if (value?.includes('0.01ms !important')) continue; // the reduced-motion override itself
      // A literal duration may only appear as a var() fallback.
      const outsideVars = value?.replace(/var\([^)]*\)/g, '') ?? '';
      expect(outsideVars, `${property}: ${value}`).not.toMatch(/\d+m?s\b/);
      expect(value, `${property}: ${value}`).toMatch(/var\(--tx-motion-(fast|base|slow)/);
    }
  });

  it('scopes the reduced-motion override to the player and zeroes every motion token', () => {
    const blocks = [
      ...rules.matchAll(/([^{}]*\{[^{}]*--tx-motion-base:\s*0ms !important[^{}]*\})/g),
    ].map((m) => m[1] ?? '');
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      const selectors = (block.split('{')[0] ?? '').split(',').map((selector) => selector.trim());
      for (const selector of selectors) expect(selector.startsWith('.tx-player')).toBe(true);
      for (const token of [
        '--tx-motion-fast: 0ms',
        '--tx-motion-slow: 0ms',
        'animation-duration: 0.01ms',
        'transition-duration: 0.01ms',
        'scroll-behavior: auto',
      ]) {
        expect(block).toContain(token);
      }
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tx-player,/);
  });
});

describe('motion policy on the player root', () => {
  it('follows prefers-reduced-motion live in auto mode', async () => {
    const media = mockReducedMotion(false);
    const { container } = await paint();
    const root = container.querySelector('[data-tx-player]') as HTMLElement;
    expect(root.hasAttribute('data-tx-motion')).toBe(false);
    media.set(true);
    await tick();
    expect(root.getAttribute('data-tx-motion')).toBe('reduce');
    media.set(false);
    await tick();
    expect(root.hasAttribute('data-tx-motion')).toBe(false);
  });

  it('reduces motion when the host asks, whatever the user setting', async () => {
    mockReducedMotion(false);
    const { container } = await paint({ motion: 'reduce' });
    expect(container.querySelector('[data-tx-player]')?.getAttribute('data-tx-motion')).toBe(
      'reduce'
    );
  });

  it('zeroes the motion tokens and durations for everything painted inside', async () => {
    const style = document.createElement('style');
    style.dataset.motionTest = '';
    style.textContent = `${css}\n.motion-probe { transition: opacity var(--tx-motion-base, 200ms) ease; animation-duration: 3s; }`;
    document.head.append(style);
    const { container } = await paint({ motion: 'reduce' }, [
      { id: 'layout-card', props: { title: 'Card' } },
    ]);
    await waitFor(() => expect(container.querySelector('.tx-player-layout--card')).not.toBeNull());
    const card = container.querySelector('.tx-player-layout--card') as HTMLElement;
    card.classList.add('motion-probe');
    const computed = getComputedStyle(card);
    expect(computed.getPropertyValue('--tx-motion-base').trim()).toBe('0ms');
    expect(computed.getPropertyValue('--tx-motion-fast').trim()).toBe('0ms');
    expect(computed.animationDuration).toBe('0.01ms');
    expect(computed.transitionDuration).toBe('0.01ms');
  });

  it('never animates blueprint-declared motion in the document flow', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: {
          id: 'layout-deck',
          props: { title: 'Motion deck' },
          children: [
            {
              id: 'deck-slide',
              props: { slideId: 'one', title: 'Fades', transition: 'fade-up' },
              children: [
                {
                  id: 'blocks-text',
                  props: {
                    block: {
                      type: 'list',
                      items: [{ text: 'Revealed' }],
                      step: 1,
                      reveal: 'fade-up',
                    },
                  },
                },
              ],
            },
          ],
        },
        loaders: PLAYER_LOADERS,
      },
    });
    expect(await screen.findByText('Revealed', {}, { timeout: 5000 })).toBeTruthy();
    expect(
      container.querySelector(
        '[data-transition], [data-reveal], [style*="animation"], [style*="transition"]'
      )
    ).toBeNull();
    expect(
      screen.getByText('Revealed').closest('[hidden], [aria-hidden="true"], [inert]')
    ).toBeNull();
  });

  it('carries the motion option across the frame protocol', () => {
    expect(sanitizeFrameOptions({ motion: 'reduce' })).toEqual({ motion: 'reduce' });
    expect(sanitizeFrameOptions({ motion: 'wild' })).toEqual({});
  });
});
