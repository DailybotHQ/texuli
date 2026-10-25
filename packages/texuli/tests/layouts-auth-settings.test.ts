// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_SETTINGS_LAYOUTS,
  registerAuthSettingsLayouts,
  unregisterAuthSettingsLayouts,
} from '../src/layouts/auth-settings/index.ts';
import { LAYOUT_REGISTRY } from '../src/layouts/host/registry.ts';
import AuthSettingsHarness from './fixtures/AuthSettingsHarness.svelte';

afterEach(() => {
  cleanup();
  unregisterAuthSettingsLayouts();
});

describe('registerAuthSettingsLayouts', () => {
  it('registers lazy auth-split and wizard host entries', () => {
    expect(LAYOUT_REGISTRY['auth-split']).toBeUndefined();
    registerAuthSettingsLayouts();
    expect(AUTH_SETTINGS_LAYOUTS).toEqual(['auth-split', 'wizard']);
    expect(typeof LAYOUT_REGISTRY['auth-split']?.load).toBe('function');
    expect(typeof LAYOUT_REGISTRY.wizard?.load).toBe('function');
    unregisterAuthSettingsLayouts();
    expect(LAYOUT_REGISTRY['auth-split']).toBeUndefined();
    expect(LAYOUT_REGISTRY.wizard).toBeUndefined();
  });
});

describe('AuthSplitLayout', () => {
  it('renders the form column and brand panel copy', () => {
    render(AuthSettingsHarness, { props: { view: 'auth' } });
    expect(screen.getByRole('main').getAttribute('data-tx-layout')).toBe('auth-split');
    expect(screen.getByLabelText('Sign in')).toBeTruthy();
    expect(screen.getByText('Continue with email')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Harbor Labs' })).toBeTruthy();
    expect(screen.getByText('Ship prototypes with the team.')).toBeTruthy();
  });

  it('keeps brand copy optional with no product defaults', () => {
    render(AuthSettingsHarness, { props: { view: 'auth-bare' } });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('Sign in form')).toBeTruthy();
  });

  it('honors RTL direction on the frame', () => {
    const { container } = render(AuthSettingsHarness, { props: { view: 'auth', dir: 'rtl' } });
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
    expect(container.querySelector('[data-tx-auth-split]')).toBeTruthy();
  });
});

describe('WizardLayout', () => {
  it('renders steps and advances with Next', async () => {
    render(AuthSettingsHarness, { props: { view: 'wizard' } });
    expect(screen.getByRole('main').getAttribute('data-tx-layout')).toBe('wizard');
    expect(screen.getByRole('heading', { name: 'Set up Harbor' })).toBeTruthy();
    expect(screen.getByText('Profile body')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Team body')).toBeTruthy();
    });
  });
});

describe('SettingsLayout', () => {
  it('switches sections and remounts detail content', async () => {
    render(AuthSettingsHarness, { props: { view: 'settings' } });
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
    expect(screen.getByText('Profile panel')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: /Security/ }));
    await waitFor(() => {
      expect(screen.getByText('Security panel')).toBeTruthy();
    });
    expect(screen.queryByText('Profile panel')).toBeNull();
  });

  it('moves between list and detail on a phone-width mode', async () => {
    render(AuthSettingsHarness, { props: { view: 'settings', startWithList: true } });
    const root = document.querySelector('[data-tx-settings-layout]');
    expect(root?.getAttribute('data-mode')).toBe('list');

    await fireEvent.click(screen.getByRole('button', { name: /Profile/ }));
    await waitFor(() => {
      expect(root?.getAttribute('data-mode')).toBe('detail');
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => {
      expect(root?.getAttribute('data-mode')).toBe('list');
    });
  });

  it('renders RTL settings without structural breakage', () => {
    const { container } = render(AuthSettingsHarness, {
      props: { view: 'settings', dir: 'rtl' },
    });
    expect(container.querySelector('[dir="rtl"] [data-tx-settings-layout]')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /Settings sections/i })).toBeTruthy();
  });
});
