import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import LabelPropHarness from './fixtures/LabelPropHarness.svelte';

afterEach(cleanup);

/**
 * The plain-text `label` prop on Button, Badge and Kbd (audit G03): optional,
 * escaped text, and it replaces `children` when both are given.
 */
const COMPONENTS = [
  { component: 'button', selector: '[data-tx-button]' },
  { component: 'badge', selector: '[data-tx-badge]' },
  { component: 'kbd', selector: '[data-tx-kbd]' },
] as const;

function root(props: Record<string, unknown>, selector: string): HTMLElement {
  const { container } = render(LabelPropHarness, { props: props as never });
  const el = container.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

describe.each(COMPONENTS)('$component label prop', ({ component, selector }) => {
  it('renders the label as its text, not as an attribute', () => {
    const el = root({ component, label: 'Save changes' }, selector);
    expect(el.textContent?.trim()).toBe('Save changes');
    expect(el.hasAttribute('label')).toBe(false);
  });

  it('renders markup in the label as escaped text', () => {
    const el = root({ component, label: '<img src=x onerror=alert(1)>' }, selector);
    expect(el.textContent?.trim()).toBe('<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.children.length).toBe(0);
  });

  it('replaces children when both are given', () => {
    const el = root({ component, label: 'Shipped', text: 'Slot text' }, selector);
    expect(el.textContent?.trim()).toBe('Shipped');
    expect(el.querySelector('[data-slot]')).toBeNull();
  });

  it('keeps children when the label is missing or empty', () => {
    for (const label of [undefined, '']) {
      const el = root({ component, label, text: 'Slot text' }, selector);
      expect(el.querySelector('[data-slot]')?.textContent, String(label)).toBe('Slot text');
      cleanup();
    }
  });
});

describe('Button label while loading', () => {
  it('keeps the label in the hidden label span, like children', () => {
    const el = root(
      { component: 'button', label: 'Save changes', loading: true },
      '[data-tx-button]'
    );
    expect(el.querySelector('.tx-button__label--hidden')?.textContent).toBe('Save changes');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });
});
