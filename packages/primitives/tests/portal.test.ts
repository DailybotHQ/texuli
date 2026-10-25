import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { Portal } from '../src/portal/index.ts';
import PortalHarness from './PortalHarness.svelte';

afterEach(cleanup);

function portalRoot(doc: Document): HTMLElement | null {
  return doc.querySelector('[data-tx-portal]');
}

describe('Portal', () => {
  it('exports Portal as a component', () => {
    expect(typeof Portal).toBe('function');
  });

  it('moves the portal root to document.body by default', () => {
    const view = render(PortalHarness, { props: { message: 'Hello portal' } });
    const doc = view.container.ownerDocument;
    const root = portalRoot(doc);
    expect(root?.textContent).toContain('Hello portal');
    expect(root?.closest('[data-origin]')).toBeNull();
    expect(root?.parentElement).toBe(doc.body);
    expect(root?.hasAttribute('data-portaled')).toBe(true);
  });

  it('moves the portal root to a reactive custom target', async () => {
    const view = render(PortalHarness);
    const doc = view.container.ownerDocument;
    await fireEvent.click(view.getByRole('button', { name: /Use frame target/i }));
    const root = portalRoot(doc);
    const frame = doc.querySelector('[data-custom-target]');
    expect(root?.parentElement).toBe(frame);
  });

  it('keeps content in place when disabled', () => {
    const view = render(PortalHarness, { props: { disabled: true } });
    const content = view.container.querySelector('[data-origin] [data-portaled-content]');
    expect(content).toBeTruthy();
    expect(content?.closest('[data-tx-portal]')?.parentElement).not.toBe(
      view.container.ownerDocument.body
    );
  });
});
