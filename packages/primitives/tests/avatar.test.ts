import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AvatarFallback from '../src/avatar/AvatarFallback.svelte';
import AvatarImage from '../src/avatar/AvatarImage.svelte';
import AvatarRoot from '../src/avatar/AvatarRoot.svelte';
import { Avatar } from '../src/avatar/index.ts';
import AvatarHarness from './fixtures/AvatarHarness.svelte';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** 1×1 PNG (valid developer data URI). */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('Avatar', () => {
  it('exports Avatar.Root / Image / Fallback namespace', () => {
    expect(Avatar.Root).toBe(AvatarRoot);
    expect(Avatar.Image).toBe(AvatarImage);
    expect(Avatar.Fallback).toBe(AvatarFallback);
  });

  it('shows fallback while loading and the image once loaded', async () => {
    const onLoadingStatusChange = vi.fn();
    const view = render(AvatarHarness, {
      props: {
        src: PNG,
        srcTrust: 'developer',
        delayMs: 0,
        alt: 'Ada Example',
        onLoadingStatusChange,
      },
    });
    const img = view.container.querySelector('[data-tx-avatar-image]') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    // happy-dom may already mark data URIs complete; force a load if still loading.
    if (
      view.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state') ===
      'loading'
    ) {
      expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeTruthy();
      await fireEvent.load(img as HTMLImageElement);
    }
    await waitFor(() => {
      expect(
        view.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')
      ).toBe('loaded');
    });
    expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeNull();
    expect(img?.getAttribute('alt')).toBe('Ada Example');
    expect(img?.hasAttribute('hidden')).toBe(false);
    expect(onLoadingStatusChange).toHaveBeenCalledWith('loaded');
  });

  it('keeps the fallback through delayMs after load', async () => {
    vi.useFakeTimers();
    const view = render(AvatarHarness, {
      props: {
        src: PNG,
        srcTrust: 'developer',
        delayMs: 50,
        alt: 'Delayed',
      },
    });
    const img = view.container.querySelector('[data-tx-avatar-image]') as HTMLImageElement;
    await fireEvent.load(img);
    expect(view.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')).toBe(
      'loading'
    );
    expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(50);
    expect(view.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')).toBe(
      'loaded'
    );
    expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeNull();
  });

  it('shows fallback on error and for unsafe sources', async () => {
    const onLoadingStatusChange = vi.fn();
    const bad = render(AvatarHarness, {
      props: {
        src: 'javascript:alert(1)',
        alt: 'Bad',
        onLoadingStatusChange,
      },
    });
    await waitFor(() => {
      expect(bad.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')).toBe(
        'error'
      );
    });
    expect(bad.container.querySelector('[data-tx-avatar-image]')).toBeNull();
    expect(bad.container.querySelector('[data-tx-avatar-fallback]')?.textContent).toContain('AE');
    expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
    bad.unmount();

    const fail = render(AvatarHarness, {
      props: {
        src: PNG,
        srcTrust: 'developer',
        alt: 'Fail',
      },
    });
    const img = fail.container.querySelector('[data-tx-avatar-image]') as HTMLImageElement;
    await fireEvent.error(img);
    await waitFor(() => {
      expect(
        fail.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')
      ).toBe('error');
    });
    expect(fail.container.querySelector('[data-tx-avatar-fallback]')).toBeTruthy();
  });
});
