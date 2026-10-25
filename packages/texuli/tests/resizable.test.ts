import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resizableGroupClass,
  resizableHandleClass,
  resizablePanelClass,
} from '../src/components/resizable/index.ts';
import ResizableHarness from './fixtures/ResizableHarness.svelte';

afterEach(() => cleanup());

const handle = (name = 'Resize navigation') => screen.getByRole('separator', { name });
const press = (key: string) => fireEvent.keyDown(handle(), { key });

describe('resizable class composers', () => {
  it('compose base, variant and consumer classes in order', () => {
    expect(resizableGroupClass()).toBe('tx-resizable tx-resizable--plain');
    expect(resizableGroupClass({ variant: 'bordered', class: 'mine' })).toBe(
      'tx-resizable tx-resizable--bordered mine'
    );
    expect(resizableHandleClass({ size: 'sm' })).toBe(
      'tx-resizable__handle tx-resizable__handle--sm'
    );
    expect(resizableHandleClass()).toBe('tx-resizable__handle tx-resizable__handle--md');
    expect(resizablePanelClass({ class: 'x' })).toBe('tx-resizable__panel x');
  });
});

describe('ResizablePanelGroup', () => {
  it('renders a plain group with panels and a handle, keeping consumer classes', () => {
    render(ResizableHarness);
    const group = screen.getByTestId('group');
    expect(group.className).toContain('tx-resizable tx-resizable--plain consumer-group');
    expect(group.dataset.direction).toBe('horizontal');
    expect(group.hasAttribute('data-tx-resizable')).toBe(true);
    const panels = group.querySelectorAll('.tx-resizable__panel');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.classList.contains('consumer-panel')).toBe(true);
    expect(screen.getByText('Navigation')).toBeTruthy();
    const separator = handle();
    expect(separator.className).toContain(
      'tx-resizable__handle tx-resizable__handle--md consumer-handle'
    );
    expect(separator.hasAttribute('data-tx-resizable-handle')).toBe(true);
  });

  it('renders the bordered variant', () => {
    render(ResizableHarness, { props: { variant: 'bordered' } });
    expect(screen.getByTestId('group').classList.contains('tx-resizable--bordered')).toBe(true);
  });

  it('stacks panels vertically', () => {
    render(ResizableHarness, { props: { direction: 'vertical' } });
    expect(screen.getByTestId('group').dataset.direction).toBe('vertical');
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal');
  });
});

describe('ResizableHandle', () => {
  it('is a named, focusable APG window splitter separator', () => {
    render(ResizableHarness);
    const separator = handle();
    expect(separator.getAttribute('tabindex')).toBe('0');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.getAttribute('aria-valuenow')).toBe('30');
    expect(separator.getAttribute('aria-valuemin')).toBe('0');
    expect(separator.getAttribute('aria-valuemax')).toBe('60');
    expect(separator.getAttribute('aria-controls')).toBe('nav-pane');
    expect(separator.dataset.state).toBe('inactive');
  });

  it('defaults its name to "Resize" and takes a translated label', () => {
    const { unmount } = render(ResizableHarness, {
      props: { defaultLabel: true },
    });
    expect(handle('Resize')).toBeTruthy();
    unmount();
    render(ResizableHarness, { props: { label: 'Redimensionar navegación' } });
    expect(handle('Redimensionar navegación')).toBeTruthy();
  });

  it('shows a decorative grip by default, and can hide it', () => {
    const { unmount } = render(ResizableHarness);
    const grip = handle().querySelector('.tx-resizable__grip');
    expect(grip?.getAttribute('aria-hidden')).toBe('true');
    unmount();
    render(ResizableHarness, { props: { withGrip: false } });
    expect(handle().querySelector('.tx-resizable__grip')).toBeNull();
  });

  it('takes a small size', () => {
    render(ResizableHarness, { props: { size: 'sm' } });
    expect(handle().classList.contains('tx-resizable__handle--sm')).toBe(true);
  });

  it('resizes with the keyboard and reports the layout', async () => {
    const onLayoutChange = vi.fn();
    render(ResizableHarness, { props: { onLayoutChange } });
    await press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('40');
    expect(onLayoutChange).toHaveBeenLastCalledWith([40, 60]);
    await press('Home');
    expect(handle().getAttribute('aria-valuenow')).toBe('20');
  });

  it('grows the first panel with ArrowLeft in RTL', async () => {
    render(ResizableHarness, { props: { dir: 'rtl' } });
    await press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('40');
  });

  it('collapses a collapsible panel with Enter and marks it collapsed', async () => {
    const onCollapse = vi.fn();
    render(ResizableHarness, { props: { onCollapse } });
    await press('Enter');
    const panel = document.getElementById('nav-pane') as HTMLElement;
    expect(panel.dataset.state).toBe('collapsed');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('is disabled with the group: no Tab stop, no keyboard resize', async () => {
    render(ResizableHarness, { props: { disabled: true } });
    const separator = handle();
    expect(separator.hasAttribute('tabindex')).toBe(false);
    expect(separator.getAttribute('aria-disabled')).toBe('true');
    expect(separator.hasAttribute('data-disabled')).toBe(true);
    await press('ArrowRight');
    expect(separator.getAttribute('aria-valuenow')).toBe('30');
  });

  it('restores and saves the layout through storage', async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
    };
    const { unmount } = render(ResizableHarness, { props: { storage } });
    await press('ArrowRight');
    expect([...saved.values()].join()).toContain('40');
    unmount();
    render(ResizableHarness, { props: { storage } });
    expect(handle().getAttribute('aria-valuenow')).toBe('40');
  });
});
