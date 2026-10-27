import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('video edit example', () => {
  it('registers and renders the fictional trim and caption cues', async () => {
    const entry = getExample('media-video-edit');
    expect(entry?.component).toBe('media/VideoEditPanel');
    const loaded = await entry?.load();
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error('Video edit example did not load.');

    const { container, getByText, getByLabelText } = render(loaded.default);
    expect(getByText('Port Meridian field note · 10 seconds')).toBeTruthy();
    expect(getByLabelText('Caption text 1')).toBeTruthy();
    await waitFor(() =>
      expect(container.querySelector('textarea')?.value).toBe('A calm morning at Port Meridian.')
    );
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(6);
  });
});
