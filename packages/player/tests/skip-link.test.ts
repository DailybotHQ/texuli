import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Player from '../src/Player.svelte';

// Vitest does not apply imported CSS, so the real stylesheet is injected.
const css = readFileSync(join(process.cwd(), 'packages/player/src/player.css'), 'utf8');

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`No rule for ${selector}`);
  return Object.fromEntries(
    match[1]
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const index = declaration.indexOf(':');
        return [declaration.slice(0, index).trim(), declaration.slice(index + 1).trim()];
      })
  );
}

afterEach(() => {
  for (const style of document.head.querySelectorAll('style[data-skip-test]')) style.remove();
});

describe('skip link visibility', () => {
  it('has no visible box while unfocused, wherever the player sits', async () => {
    const style = document.createElement('style');
    style.dataset.skipTest = '';
    style.textContent = css;
    document.head.append(style);
    render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Page' } },
        loaders: { 'layout-page': layoutLoader },
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Page' }, { timeout: 5000 });
    const skip = screen.getByRole('link', { name: 'Skip past Blueprint preview' });
    const computed = getComputedStyle(skip);
    expect(computed.clipPath).toBe('inset(50%)');
    // The stylesheet sizes it with logical properties.
    expect(computed.getPropertyValue('inline-size')).toBe('1px');
    expect(computed.getPropertyValue('block-size')).toBe('1px');
    expect(computed.overflow).toBe('hidden');
    // No offset trick: nothing moves the box onto host content above the player.
    expect(computed.transform === '' || computed.transform === 'none').toBe(true);
  });

  it('declares a 1px clipped box unfocused and a normal box on focus', () => {
    const hidden = rule('.tx-player__skip');
    expect(hidden).toMatchObject({
      'inline-size': '1px',
      'block-size': '1px',
      overflow: 'hidden',
      'clip-path': 'inset(50%)',
    });
    expect(hidden.transform).toBeUndefined();
    const shown = rule('.tx-player__skip:focus,\n.tx-player__skip:focus-visible');
    expect(shown).toMatchObject({
      'inline-size': 'auto',
      'block-size': 'auto',
      overflow: 'visible',
      'clip-path': 'none',
    });
  });

  it('stays the first Tab stop', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Page' } },
        loaders: { 'layout-page': layoutLoader },
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Page' }, { timeout: 5000 });
    const first = container.querySelector('a[href], button, [tabindex]:not([tabindex="-1"])');
    expect(first?.classList.contains('tx-player__skip')).toBe(true);
  });
});
