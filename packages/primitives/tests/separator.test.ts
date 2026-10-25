import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { Separator, SeparatorRoot, separatorAttributes } from '../src/separator/index.ts';
import ChildFixture from './separator-child-fixture.svelte';

afterEach(cleanup);

const root = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-separator-root]') as HTMLElement;

describe('separatorAttributes', () => {
  it('is a horizontal semantic separator by default (ARIA default orientation, so none written)', () => {
    expect(separatorAttributes()).toEqual({
      role: 'separator',
      'data-orientation': 'horizontal',
      'data-separator-root': '',
    });
  });

  it('writes aria-orientation only for a vertical semantic separator', () => {
    expect(separatorAttributes({ orientation: 'vertical' })).toEqual({
      role: 'separator',
      'aria-orientation': 'vertical',
      'data-orientation': 'vertical',
      'data-separator-root': '',
    });
  });

  it('hides a decorative separator from assistive technology, in either orientation', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      expect(separatorAttributes({ orientation, decorative: true })).toEqual({
        role: 'none',
        'data-orientation': orientation,
        'data-separator-root': '',
      });
    }
  });

  it('treats an unknown orientation as horizontal', () => {
    expect(
      separatorAttributes({ orientation: 'diagonal' as never }).role === 'separator' &&
        separatorAttributes({ orientation: 'diagonal' as never })['data-orientation']
    ).toBe('horizontal');
  });
});

describe('Separator.Root', () => {
  it('renders a semantic separator the accessibility tree exposes', () => {
    const view = render(Separator.Root);
    const separator = view.getByRole('separator');
    expect(separator.hasAttribute('aria-orientation')).toBe(false);
    expect(separator.dataset.orientation).toBe('horizontal');
    expect(separator.childElementCount).toBe(0);
  });

  it('says it is vertical', () => {
    const view = render(Separator.Root, { props: { orientation: 'vertical' } });
    expect(view.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
  });

  it('is not announced when decorative', () => {
    const view = render(SeparatorRoot, { props: { decorative: true } });
    expect(view.queryByRole('separator')).toBeNull();
    const node = root(view.container);
    expect(node.getAttribute('role')).toBe('none');
    expect(node.hasAttribute('aria-orientation')).toBe(false);
  });

  it('passes other attributes through but keeps its role and orientation authoritative', () => {
    const view = render(Separator.Root, {
      props: {
        class: 'rule',
        id: 'section-break',
        'data-testid': 'rule',
        // A consumer cannot override the semantics through attributes.
        'aria-orientation': 'vertical',
      } as never,
    });
    const node = view.getByTestId('rule');
    expect(node.className).toBe('rule');
    expect(node.id).toBe('section-break');
    expect(node.getAttribute('role')).toBe('separator');
    expect(node.hasAttribute('aria-orientation')).toBe(false);
  });

  it('binds ref to the element', () => {
    let ref: HTMLElement | null = null;
    render(Separator.Root, {
      props: {
        get ref() {
          return ref;
        },
        set ref(value) {
          ref = value;
        },
      },
    });
    expect(ref).toBeInstanceOf(HTMLElement);
    expect((ref as HTMLElement | null)?.getAttribute('role')).toBe('separator');
  });

  it('renders a child snippet with its props spread on the consumer element', () => {
    const view = render(ChildFixture);
    const custom = view.getByTestId('custom');
    expect(custom.tagName).toBe('HR');
    expect(custom.getAttribute('role')).toBe('separator');
    expect(custom.getAttribute('aria-orientation')).toBe('vertical');
    expect(custom.className).toBe('rule');
    expect(view.container.querySelectorAll('[data-separator-root]')).toHaveLength(1);
  });
});
