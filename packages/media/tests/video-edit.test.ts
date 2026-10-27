import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { createVideoEdit, serializeWebVtt, validateVideoEdit } from '../src/video/edit.ts';
import { VideoEditPanel } from '../src/video/entry.ts';
import videoEditSource from '../src/video/VideoEditPanel.svelte?raw';

function styleBlock(source: string): string {
  const open = source.indexOf('<style>');
  const close = source.indexOf('</style>', open);
  return open === -1 || close === -1 ? '' : source.slice(open + 7, close);
}

describe('video edit model', () => {
  it('creates a full-length edit and validates trim and caption bounds', () => {
    expect(createVideoEdit(4_000)).toEqual({
      version: 1,
      trim: { startMs: 0, endMs: 4_000 },
      captions: [],
    });
    expect(
      validateVideoEdit(
        {
          version: 1,
          trim: { startMs: 1_000, endMs: 3_000 },
          captions: [{ id: 'cue-1', start: 1.5, end: 2.5, text: 'Ferry leaves' }],
        },
        4_000
      )
    ).toMatchObject({ ok: true });
    expect(
      validateVideoEdit({ version: 1, trim: { startMs: 3_000, endMs: 5_000 }, captions: [] }, 4_000)
    ).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '$.trim.endMs' })] });
  });

  it('serializes clipped captions as escaped, trim-relative WebVTT', () => {
    expect(
      serializeWebVtt(
        [
          { id: 'cue-1', start: 0.5, end: 2, text: 'Boats <arrive> & wait' },
          { id: 'cue-2', start: 3, end: 4, text: 'Outside the clip' },
        ],
        { startMs: 1_000, endMs: 3_000 }
      )
    ).toBe('WEBVTT\n\ncue-1\n00:00:00.000 --> 00:00:01.000\nBoats &lt;arrive&gt; &amp; wait\n');
  });
});

describe('VideoEditPanel', () => {
  it('edits a bounded trim and emits plain-text caption cues', async () => {
    const onchange = vi.fn();
    const view = render(VideoEditPanel, {
      props: { durationMs: 4_000, value: createVideoEdit(4_000), onchange },
    });
    await fireEvent.change(view.getByLabelText('Trim start (seconds)'), {
      target: { value: '1' },
    });
    expect(onchange.mock.lastCall?.[0].trim).toEqual({ startMs: 1_000, endMs: 4_000 });
    await fireEvent.click(view.getByRole('button', { name: 'Add caption cue' }));
    expect(onchange.mock.lastCall?.[0].captions).toHaveLength(1);
    await fireEvent.input(view.getByLabelText('Caption text 1'), {
      target: { value: 'Pier 4 & ferry' },
    });
    expect(onchange.mock.lastCall?.[0].captions[0].text).toBe('Pier 4 & ferry');
  });

  // T-68: edit chrome must sit in tx.components and use --tx-* roles like VideoPlayer.
  it('paints through @layer tx.components and token border/surface roles', () => {
    const css = styleBlock(videoEditSource);
    expect(css).toMatch(/@layer\s+tx\.components/);
    expect(css).toMatch(/--tx-border/);
    expect(css).toMatch(/--tx-surface|--tx-background|--tx-radius/);
    expect(css).toMatch(/forced-colors:\s*active/);
  });
});
