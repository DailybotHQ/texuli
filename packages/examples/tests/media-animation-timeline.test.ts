import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('animation timeline example', () => {
  it('loads the lower-third composition and displays its selected keyframe', async () => {
    const entry = getExample('media-animation-timeline');
    expect(entry?.component).toBe('media/AnimationTimeline');
    const loaded = await entry?.load();
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error('Animation timeline example did not load.');

    const { container, getByText } = render(loaded.default);
    await waitFor(() =>
      expect(container.querySelector('[data-tx-animation-timeline]')).not.toBeNull()
    );
    await waitFor(() =>
      expect(container.querySelector('[data-tx-timeline-row="lower-third"]')).not.toBeNull()
    );
    const keyframe = container.querySelector<HTMLButtonElement>(
      '[data-tx-timeline-keyframe="lower-third:1"]'
    );
    expect(keyframe).not.toBeNull();
    if (!keyframe) throw new Error('Lower-third keyframe did not render.');
    await fireEvent.click(keyframe);
    expect(keyframe.getAttribute('aria-pressed')).toBe('true');
    expect(getByText('Lower-third · 6 seconds')).toBeTruthy();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
  });
});
