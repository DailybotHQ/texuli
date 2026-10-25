import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Card from '../src/components/card/Card.svelte';
import CardContent from '../src/components/card/CardContent.svelte';
import CardDescription from '../src/components/card/CardDescription.svelte';
import CardFooter from '../src/components/card/CardFooter.svelte';
import CardGrid from '../src/components/card/CardGrid.svelte';
import CardHeader from '../src/components/card/CardHeader.svelte';
import CardMedia from '../src/components/card/CardMedia.svelte';
import CardTitle from '../src/components/card/CardTitle.svelte';
import { CARD_VARIANTS } from '../src/components/card/variants.ts';

afterEach(cleanup);

const text = (value: string) =>
  createRawSnippet(() => ({
    render: () => `<span>${value}</span>`,
  }));

describe('Card', () => {
  it('renders elevated and flat variants', () => {
    for (const variant of CARD_VARIANTS) {
      const view = render(Card, { props: { variant, children: text('Body') } });
      const el = view.container.querySelector('[data-tx-card]');
      expect(el).toBeTruthy();
      expect(el?.getAttribute('data-variant')).toBe(variant);
      if (variant === 'flat') expect(el?.className).toContain('tx-card--flat');
      view.unmount();
    }
  });

  it('becomes a safe link when href is allowed', () => {
    const view = render(Card, {
      props: {
        href: 'https://example.com/docs',
        linkLabel: 'Open docs',
        children: text('Go'),
      },
    });
    const link = view.getByRole('link', { name: 'Open docs' });
    expect(link.getAttribute('href')).toBe('https://example.com/docs');
    expect(link.getAttribute('data-interactive')).toBe('true');
  });

  it('rejects unsafe href and stays a div', () => {
    const view = render(Card, {
      props: { href: 'javascript:alert(1)', children: text('Nope') },
    });
    expect(view.container.querySelector('a')).toBeNull();
    expect(view.container.querySelector('[data-tx-card]')?.tagName.toLowerCase()).toBe('div');
  });
});

describe('Card structure', () => {
  it('renders header title description content footer', () => {
    const header = render(CardHeader, { props: { children: text('H') } });
    expect(header.container.querySelector('[data-tx-card-header]')).toBeTruthy();
    header.unmount();

    const title = render(CardTitle, { props: { level: 2, children: text('Title') } });
    const h = title.container.querySelector('[data-tx-card-title]');
    expect(h?.tagName.toLowerCase()).toBe('h2');
    expect(title.getByText('Title')).toBeTruthy();
    title.unmount();

    const desc = render(CardDescription, { props: { children: text('More') } });
    expect(desc.container.querySelector('[data-tx-card-description]')?.textContent).toContain(
      'More'
    );
    desc.unmount();

    const content = render(CardContent, { props: { children: text('Body') } });
    expect(content.container.querySelector('[data-tx-card-content]')).toBeTruthy();
    content.unmount();

    const footer = render(CardFooter, { props: { children: text('Actions') } });
    expect(footer.container.querySelector('[data-tx-card-footer]')).toBeTruthy();
  });
});

describe('CardMedia', () => {
  it('renders img when src is safe and skips hostile schemes', () => {
    const ok = render(CardMedia, {
      props: { src: 'https://example.com/photo.jpg', alt: 'Harbor dock' },
    });
    const img = ok.container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
    expect(img?.getAttribute('alt')).toBe('Harbor dock');
    ok.unmount();

    const bad = render(CardMedia, {
      props: { src: 'javascript:alert(1)', alt: 'x' },
    });
    expect(bad.container.querySelector('img')).toBeNull();
  });
});

describe('CardGrid', () => {
  it('builds an auto-fill grid with a safe min width', () => {
    const view = render(CardGrid, {
      props: { minItemWidth: '12rem', gap: 'lg', children: text('c') },
    });
    const grid = view.container.querySelector('[data-tx-card-grid]') as HTMLElement;
    expect(grid.className).toContain('tx-card-grid--gap-lg');
    expect(grid.getAttribute('style')).toContain('12rem');
    view.unmount();

    const hostile = render(CardGrid, {
      props: { minItemWidth: '12rem; color: red', children: text('c') },
    });
    const style =
      hostile.container.querySelector('[data-tx-card-grid]')?.getAttribute('style') ?? '';
    expect(style).toContain('16rem');
    expect(style).not.toContain('color');
  });
});
