import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

/*
 * The invalid-draft notice quotes agent values (ids, paths, text). A long
 * unbroken value must wrap inside the notice at 360 px instead of pushing
 * it past the viewport. Vitest does not apply imported CSS, so the real
 * stylesheet is injected.
 */

const css = readFileSync(join(process.cwd(), 'packages/player/src/player.css'), 'utf8');

afterEach(() => {
  cleanup();
  for (const style of document.head.querySelectorAll('style[data-notice-test]')) style.remove();
});

describe('the invalid-draft notice', () => {
  it('wraps long values anywhere, with logical sizing, inside a 360 px host', async () => {
    const style = document.createElement('style');
    style.dataset.noticeTest = '';
    style.textContent = css;
    document.head.append(style);
    const host = document.createElement('div');
    host.style.inlineSize = '360px';
    document.body.append(host);
    const long = `unknown-${'x'.repeat(400)}`;
    const { container } = render(Player, {
      target: host,
      props: { blueprint: { id: long, props: {} }, loaders: PLAYER_LOADERS },
    });
    await tick();
    const notice = container.querySelector<HTMLElement>('.tx-player__notice');
    expect(notice).not.toBeNull();
    const computed = getComputedStyle(notice as HTMLElement);
    expect(computed.overflowWrap).toBe('anywhere');
    expect(['0', '0px']).toContain(computed.getPropertyValue('min-inline-size'));
    host.remove();
  });
});
