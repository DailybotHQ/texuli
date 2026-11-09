/// <reference types="node" />
/**
 * Interactive card (T-card-interactive, ADR-032): one stretched primary link,
 * nested actions separately focusable and clickable, hover from tokens.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { cardManifest } from '../../catalog/src/manifests/display/index.ts';
import { checkDesignSystemAllow } from '../../spec/src/design-system/allow.ts';
import Card from '../src/components/card/Card.svelte';

afterEach(() => cleanup());

const text = (value: string) =>
  createRawSnippet(() => ({
    render: () => `<span>${value}</span>`,
  }));

const actions = createRawSnippet(() => ({
  render: () =>
    `<span><button type="button" data-card-action="pin">Pin</button><button type="button" data-card-action="menu">Menu</button></span>`,
}));

const catalog = {
  components: [
    {
      id: 'card',
      axes: { variant: { values: ['elevated', 'flat'] } },
      states: ['hover', 'focus-visible'],
    },
  ],
};

const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};

describe('interactive Card', () => {
  it('keeps nested actions outside the stretched link, in tab order after it', () => {
    const view = render(Card, {
      props: {
        href: 'https://example.com/item',
        linkLabel: 'Open item',
        children: text('Harbor dock'),
        actions,
      },
    });
    const root = view.container.querySelector('[data-tx-component="card"]') as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe('div');
    expect(root.className).toContain('tx-card--interactive');
    expect(root.getAttribute('data-tx-variant')).toBe('elevated');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('https://example.com/item');
    expect(links[0]?.getAttribute('aria-label')).toBe('Open item');
    expect(links[0]?.className).toContain('tx-card__link');

    const pin = view.container.querySelector('[data-card-action="pin"]') as HTMLButtonElement;
    const menu = view.container.querySelector('[data-card-action="menu"]') as HTMLButtonElement;
    expect(pin).toBeTruthy();
    expect(menu).toBeTruthy();
    expect(links[0]?.contains(pin)).toBe(false);
    expect(links[0]?.contains(menu)).toBe(false);
    expect(pin.closest('.tx-card__actions')).toBeTruthy();

    const tabbable = [...view.container.querySelectorAll('a, button')];
    expect(tabbable.map((node) => node.tagName)).toEqual(['A', 'BUTTON', 'BUTTON']);
    expect(tabbable[0]).toBe(links[0]);
    expect(tabbable[1]).toBe(pin);
    expect(tabbable[2]).toBe(menu);
  });

  it('lets nested actions receive clicks without wrapping them in the link', () => {
    const view = render(Card, {
      props: {
        href: 'https://example.com/item',
        linkLabel: 'Open item',
        children: text('Harbor dock'),
        actions,
      },
    });
    const pin = view.container.querySelector('[data-card-action="pin"]') as HTMLButtonElement;
    const clicks: string[] = [];
    pin.addEventListener('click', (event) => {
      event.preventDefault();
      clicks.push('pin');
    });
    fireEvent.click(pin);
    expect(clicks).toEqual(['pin']);
  });

  it('paints hover from card tokens and lists the actions slot on the catalog id', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'packages/texuli/src/components/card/card.css'),
      'utf8'
    );
    expect(css).toContain('--tx-card-hover-elevation');
    expect(css).toContain('--tx-card-hover-border');
    expect(css).toContain('.tx-card__link::after');
    expect(css).toContain('--tx-card-actions-z');
    expect(css).toMatch(/inset:\s*0/);
    expect(cardManifest.props.some((prop) => prop.name === 'actions' && prop.kind === 'slot')).toBe(
      true
    );
    expect(cardManifest.states).toEqual(['hover', 'focus-visible']);
    expect(
      checkDesignSystemAllow(
        {
          format: 'texuli/design-system',
          formatVersion: 1,
          id: 'harborline',
          version: '1.0.0',
          name: 'Harborline',
          allow: { card: { variants: ['elevated', 'flat'] } },
        },
        catalog
      ).ok
    ).toBe(true);
  });

  it('announces one named primary link and named actions (axe)', async () => {
    const { container } = render(Card, {
      props: {
        href: 'https://example.com/item',
        linkLabel: 'Open item',
        children: text('Harbor dock'),
        actions,
      },
    });
    const result = await axe.run(container, {
      runOnly: { type: 'rule', values: ['link-name', 'button-name', 'nested-interactive'] },
    });
    expect(
      result.violations.map(
        (item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(' | ')}`
      )
    ).toEqual([]);
  });
});
