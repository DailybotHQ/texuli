/**
 * FIX-ref: every listed styled root exposes bind:ref to the rendered element.
 */
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RefHarness from './fixtures/RefHarness.svelte';
import type { RefKind } from './fixtures/ref-kind.ts';

const KINDS: readonly { kind: RefKind; attr: string }[] = [
  { kind: 'button', attr: 'data-tx-button' },
  { kind: 'icon-button', attr: 'data-tx-button' },
  { kind: 'card', attr: 'data-tx-card' },
  { kind: 'card-header', attr: 'data-tx-card-header' },
  { kind: 'card-content', attr: 'data-tx-card-content' },
  { kind: 'card-footer', attr: 'data-tx-card-footer' },
  { kind: 'card-title', attr: 'data-tx-card-title' },
  { kind: 'card-description', attr: 'data-tx-card-description' },
  { kind: 'label', attr: 'data-tx-label' },
  { kind: 'checkbox', attr: 'data-tx-choice-field' },
  { kind: 'switch', attr: 'data-tx-choice-field' },
  { kind: 'input', attr: 'data-tx-input' },
  { kind: 'textarea', attr: 'data-tx-textarea' },
  { kind: 'badge', attr: 'data-tx-badge' },
  { kind: 'kbd', attr: 'data-tx-kbd' },
  { kind: 'separator', attr: 'data-tx-separator' },
  { kind: 'progress', attr: 'data-tx-progress' },
  { kind: 'skeleton', attr: 'data-tx-skeleton' },
  { kind: 'avatar', attr: 'data-tx-avatar' },
  { kind: 'alert', attr: 'data-tx-alert' },
  { kind: 'callout', attr: 'data-tx-alert' },
];

afterEach(() => {
  cleanup();
});

describe('styled component bind:ref', () => {
  it.each(KINDS)('bind:ref on $kind points at the root ($attr)', async ({ kind, attr }) => {
    const box: { current: HTMLElement | null } = { current: null };
    const view = render(RefHarness, {
      props: {
        kind,
        get ref() {
          return box.current;
        },
        set ref(value: HTMLElement | null) {
          box.current = value;
        },
      },
    });

    await vi.waitFor(() => {
      expect(box.current).toBeInstanceOf(HTMLElement);
    });

    const el = box.current as HTMLElement;
    const marked = view.container.querySelector(`[${attr}]`);
    expect(marked).toBeTruthy();
    // Root ref is the marked element, or a solo wrapper that contains it.
    expect(el === marked || (marked !== null && el.contains(marked as Node))).toBe(true);

    view.unmount();
    await vi.waitFor(() => {
      expect(box.current).toBeNull();
    });
  });
});
