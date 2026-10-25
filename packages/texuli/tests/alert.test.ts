import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Alert from '../src/components/alert/Alert.svelte';
import Banner from '../src/components/alert/Banner.svelte';
import Callout from '../src/components/alert/Callout.svelte';
import { ALERT_TONES, alertRole, alertSurfaceClass } from '../src/components/alert/tones.ts';

afterEach(() => cleanup());

describe('tones helpers', () => {
  it('maps error to alert role and others to status', () => {
    expect(alertRole('error')).toBe('alert');
    expect(alertRole('info')).toBe('status');
    expect(alertRole('success')).toBe('status');
  });

  it('composes layout and tone classes with consumer class last', () => {
    expect(alertSurfaceClass({ layout: 'banner', tone: 'warning', class: 'extra' })).toBe(
      'tx-alert tx-alert--layout-banner tx-alert--warning extra'
    );
    for (const tone of ALERT_TONES) {
      expect(alertSurfaceClass({ tone })).toContain(`tx-alert--${tone}`);
    }
  });
});

describe('Alert', () => {
  it('renders title, text and info status role by default', () => {
    render(Alert, {
      props: { title: 'Heads up', text: 'Something changed in the workspace.' },
    });
    const root = screen.getByRole('status');
    expect(root.getAttribute('data-tx-tone')).toBe('info');
    expect(root.getAttribute('data-tx-layout')).toBe('alert');
    expect(screen.getByText('Heads up')).toBeTruthy();
    expect(screen.getByText('Something changed in the workspace.')).toBeTruthy();
  });

  it('uses role=alert for error tone', () => {
    render(Alert, {
      props: { tone: 'error', title: 'Failed', text: 'Could not save.' },
    });
    expect(screen.getByRole('alert').getAttribute('data-tx-tone')).toBe('error');
  });

  it('fires dismiss with a labelled control', async () => {
    const onDismiss = vi.fn();
    render(Alert, {
      props: {
        title: 'Tip',
        text: 'You can dismiss this.',
        dismissible: true,
        dismissLabel: 'Dismiss tip',
        onDismiss,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders an action button that invokes onAction', async () => {
    const onAction = vi.fn();
    render(Alert, {
      props: {
        title: 'Update available',
        actionLabel: 'Review',
        onAction,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('filters unsafe action href through the button URL policy', () => {
    render(Alert, {
      props: {
        title: 'Link',
        actionLabel: 'Open',
        actionHref: 'javascript:alert(1)',
      },
    });
    // Unsafe href becomes a button without navigation.
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
  });
});

describe('Callout and Banner', () => {
  it('uses callout layout', () => {
    render(Callout, { props: { title: 'Note', text: 'Callout body', tone: 'brand' } });
    const root = screen.getByRole('status');
    expect(root.getAttribute('data-tx-layout')).toBe('callout');
    expect(root.className).toContain('tx-alert--layout-callout');
  });

  it('uses banner layout', () => {
    render(Banner, {
      props: { title: 'Maintenance', text: 'Window starts at 02:00.', tone: 'warning' },
    });
    const root = screen.getByRole('status');
    expect(root.getAttribute('data-tx-layout')).toBe('banner');
    expect(root.className).toContain('tx-alert--layout-banner');
  });
});
