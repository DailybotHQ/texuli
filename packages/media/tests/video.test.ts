import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { createVideoEdit, serializeWebVtt, validateVideoEdit } from '../src/video/edit.ts';
import { VideoEditPanel, VideoPlayer } from '../src/video/entry.ts';
import {
  formatVideoTime,
  normalizePlaybackRate,
  pickDefaultTextTrack,
  resolveVideoSources,
  resolveVideoTextTracks,
  VIDEO_PLAYBACK_RATES,
} from '../src/video/index.ts';
import captionsHostSource from '../src/video/VideoCaptions.svelte?raw';
import videoEditSource from '../src/video/VideoEditPanel.svelte?raw';
import videoPlayerSource from '../src/video/VideoPlayer.svelte?raw';

function styleBlock(source: string): string {
  const open = source.indexOf('<style>');
  const close = source.indexOf('</style>', open);
  return open === -1 || close === -1 ? '' : source.slice(open + 7, close);
}

const CAPTIONS_VTT = `WEBVTT

00:00:00.000 --> 00:00:02.000
Welcome aboard.

00:00:02.000 --> 00:00:05.000
Watch the lighthouse.
`;

const CHAPTERS_VTT = `WEBVTT

Chapter 1
00:00:00.000 --> 00:00:00.000
Departure

Chapter 2
00:00:30.000 --> 00:00:30.000
Open water
`;

const ALT_CAPTIONS_VTT = `WEBVTT

00:00:00.000 --> 00:00:03.000
Alternate track line.
`;

describe('resolveVideoSources', () => {
  it('requires an exact HTTPS origin for untrusted remote media, and 2 related cases', () => {
    {
      // requires an exact HTTPS origin for untrusted remote media
      const src = 'https://media.example.test/clip.webm';
      expect(resolveVideoSources({ src }).src).toBeUndefined();
      expect(resolveVideoSources({ src, allowedOrigins: ['https://media.example.test'] })).toEqual({
        src,
        poster: undefined,
        dropped: [],
      });
      expect(
        resolveVideoSources({ src, allowedOrigins: ['https://media.example.test.evil.test'] }).src
      ).toBeUndefined();
    }
    cleanup();
    // rejects unsafe schemes, credentials and data media, even for developer trust
    for (const src of [
      'javascript:alert(1)',
      'data:video/webm;base64,AAAA',
      'https://user:pass@media.example.test/clip.webm',
      '//media.example.test/clip.webm',
    ]) {
      expect(resolveVideoSources({ src, trust: 'developer' }).src, src).toBeUndefined();
    }
    cleanup();
    {
      // allows developer local assets and safe blob media but independently validates posters
      const result = resolveVideoSources({
        src: './clip.webm',
        poster: 'javascript:alert(1)',
        trust: 'developer',
      });
      expect(result).toEqual({ src: './clip.webm', poster: undefined, dropped: ['poster'] });
      expect(resolveVideoSources({ src: 'blob:https://app.example.test/video-id' }).src).toBe(
        'blob:https://app.example.test/video-id'
      );
    }
  });
});

describe('resolveVideoTextTracks', () => {
  it('keeps inline VTT and blocks unsafe remote tracks; picks the default caption track', () => {
    {
      // keeps inline VTT and blocks unsafe remote tracks
      const resolved = resolveVideoTextTracks([
        { id: 'en', label: 'English', vtt: CAPTIONS_VTT, default: true },
        { id: 'bad', label: 'Bad', src: 'javascript:alert(1)' },
        { id: 'ok', label: 'Remote', src: 'https://cdn.example.com/en.vtt' },
      ]);
      expect(resolved).toHaveLength(3);
      expect(resolved[0]?.vtt).toContain('WEBVTT');
      expect(resolved[0]?.blocked).toBe(false);
      expect(resolved[1]?.blocked).toBe(true);
      expect(resolved[2]?.blocked).toBe(true);

      const allowlisted = resolveVideoTextTracks(
        [{ label: 'Remote', src: 'https://cdn.example.com/en.vtt' }],
        'untrusted',
        ['https://cdn.example.com']
      );
      expect(allowlisted[0]?.src).toBe('https://cdn.example.com/en.vtt');
      expect(allowlisted[0]?.blocked).toBe(false);
    }
    cleanup();
    {
      // picks the default caption track
      const tracks = resolveVideoTextTracks([
        { id: 'a', label: 'A', vtt: CAPTIONS_VTT },
        { id: 'b', label: 'B', vtt: ALT_CAPTIONS_VTT, default: true },
      ]);
      expect(pickDefaultTextTrack(tracks, 'captions')?.id).toBe('b');
    }
  });
});

describe('video helpers', () => {
  it('restricts playback rate to the supported presets; formats finite time values without negative or non-finite output', () => {
    // restricts playback rate to the supported presets
    expect(VIDEO_PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
    expect(normalizePlaybackRate(1.5)).toBe(1.5);
    expect(normalizePlaybackRate(8)).toBe(1);
    cleanup();
    // formats finite time values without negative or non-finite output
    expect(formatVideoTime(0)).toBe('0:00');
    expect(formatVideoTime(65.9)).toBe('1:05');
    expect(formatVideoTime(3661)).toBe('1:01:01');
    expect(formatVideoTime(-5)).toBe('0:00');
    expect(formatVideoTime(Number.NaN)).toBe('0:00');
  });
});

describe('VideoPlayer', () => {
  it('does not render a video element for a blocked source, and 10 related cases', async () => {
    {
      // does not render a video element for a blocked source
      const { container, getByRole } = render(VideoPlayer, {
        src: 'javascript:alert(1)',
        title: 'Unsafe clip',
      });
      expect(container.querySelector('video')).toBeNull();
      expect(getByRole('alert').textContent).toContain('blocked');
    }
    cleanup();
    // renders safe controls, validates the poster and updates the playback rate
    await (async () => {
      const { container, getByRole } = render(VideoPlayer, {
        src: 'blob:https://app.example.test/video-id',
        poster: 'javascript:alert(1)',
        title: 'Harbor clip',
      });
      const video = container.querySelector('video');
      expect(video?.getAttribute('src')).toBe('blob:https://app.example.test/video-id');
      expect(video?.hasAttribute('poster')).toBe(false);
      expect(video?.getAttribute('aria-label')).toBe('Harbor clip');
      expect(video?.hasAttribute('controls')).toBe(false);
      expect(getByRole('slider', { name: 'Seek video' })).toBeTruthy();
      expect(getByRole('button', { name: 'Picture in picture' }).hasAttribute('disabled')).toBe(
        true
      );

      await fireEvent.change(getByRole('combobox', { name: 'Playback speed' }), {
        target: { value: '1.5' },
      });
      expect(video?.playbackRate).toBe(1.5);
    })();
    cleanup();
    {
      // renders an icon play button and groups the options below the transport
      // Audit P1-15: the controls were bare browser controls.
      const { container, getByRole } = render(VideoPlayer, {
        src: 'blob:https://app.example.test/video-id',
        title: 'Harbor clip',
      });
      const play = getByRole('button', { name: 'Play video' });
      expect(play.classList.contains('tx-video-player__play')).toBe(true);
      expect(play.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
      expect(play.textContent?.trim()).toBe('');
      const options = container.querySelector('.tx-video-player__options');
      expect(options?.contains(getByRole('combobox', { name: 'Playback speed' }))).toBe(true);
      expect(options?.contains(getByRole('slider', { name: 'Seek video' }))).toBe(false);
    }
    cleanup();
    // reports a rejected play request instead of leaving the user without feedback
    await (async () => {
      const { container, getByRole } = render(VideoPlayer, {
        src: 'blob:https://app.example.test/video-id',
        title: 'Harbor clip',
      });
      const video = container.querySelector('video') as HTMLVideoElement;
      vi.spyOn(video, 'play').mockRejectedValue(new Error('Autoplay blocked'));
      await fireEvent.click(getByRole('button', { name: 'Play video' }));
      expect(getByRole('alert').textContent).toContain('playback failed');
    })();
    cleanup();
    // toggles captions on and off and shows on-video cue text
    await (async () => {
      const { container, getByRole } = render(VideoPlayer, {
        props: {
          src: 'blob:https://app.example.test/video-id',
          title: 'Harbor clip',
          captionsDefault: true,
          tracks: [
            { id: 'en', label: 'English', vtt: CAPTIONS_VTT, default: true },
            { id: 'chapters', label: 'Chapters', kind: 'chapters', vtt: CHAPTERS_VTT },
          ],
        },
      });
      await waitFor(() => {
        expect(container.querySelector('[data-tx-video-captions]')).toBeTruthy();
      });
      const toggle = getByRole('button', { name: 'Captions' });
      expect(toggle.getAttribute('aria-pressed')).toBe('true');

      // Drive time so the first cue is active.
      const video = container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 120 });
      video.currentTime = 0.5;
      await fireEvent(video, new Event('timeupdate'));
      await tick();
      await waitFor(() => {
        expect(container.querySelector('[data-tx-video-caption-text]')?.textContent).toContain(
          'Welcome aboard'
        );
      });

      await fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(container.querySelector('[data-tx-video-caption-text]')).toBeNull();

      // Keyboard shortcut C toggles back on.
      const root = container.querySelector('[data-tx-video-player]') as HTMLElement;
      root.focus();
      await fireEvent.keyDown(root, { key: 'c' });
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
    })();
    cleanup();
    // switches caption tracks from the track picker
    await (async () => {
      const { container, getByRole } = render(VideoPlayer, {
        props: {
          src: 'blob:https://app.example.test/video-id',
          title: 'Harbor clip',
          tracks: [
            { id: 'en', label: 'English', vtt: CAPTIONS_VTT, default: true },
            { id: 'alt', label: 'Alternate', vtt: ALT_CAPTIONS_VTT },
          ],
        },
      });
      await waitFor(() => {
        expect(container.querySelector('[data-tx-video-captions]')).toBeTruthy();
      });
      const picker = getByRole('combobox', { name: 'Caption track' });
      await fireEvent.change(picker, { target: { value: 'alt' } });
      const video = container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 60 });
      video.currentTime = 1;
      await fireEvent(video, new Event('timeupdate'));
      await tick();
      await waitFor(() => {
        expect(container.querySelector('[data-tx-video-caption-text]')?.textContent).toContain(
          'Alternate track line'
        );
      });
    })();
    cleanup();
    // seeks the video when a chapter is chosen
    await (async () => {
      const { container, getAllByRole } = render(VideoPlayer, {
        props: {
          src: 'blob:https://app.example.test/video-id',
          title: 'Harbor clip',
          tracks: [
            { id: 'en', label: 'English', vtt: CAPTIONS_VTT },
            { id: 'chapters', label: 'Chapters', kind: 'chapters', vtt: CHAPTERS_VTT },
          ],
        },
      });
      await waitFor(() => {
        expect(container.querySelector('[data-tx-captions-chapters]')).toBeTruthy();
      });
      const video = container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 120 });
      video.currentTime = 0;
      const chapterButtons = getAllByRole('button').filter((b) =>
        b.hasAttribute('data-tx-chapter-button')
      );
      expect(chapterButtons.length).toBeGreaterThanOrEqual(2);
      await fireEvent.click(chapterButtons[1]!);
      expect(video.currentTime).toBe(30);
    })();
    cleanup();
    // announces chapter changes through getAnnouncer with immediate polite delivery
    // T-68: chapter changes must use the shared announcer without disabling inert exemptions.
    expect(captionsHostSource).not.toMatch(/inertRegistry\s*:\s*null/);
    expect(captionsHostSource).toMatch(/getAnnouncer\(\s*doc\s*\)/);
    expect(captionsHostSource).toMatch(/immediate\s*:\s*true/);
    expect(captionsHostSource).toMatch(/from '@texuli\/core\/announcer'/);
    cleanup();
    {
      // styles on-video caption text with token or system colors, not bare hex
      // T-68: on-video cue chrome must use tokens / system colors, not hardcoded #000/#fff.
      const css = styleBlock(videoPlayerSource);
      expect(css).toMatch(/\.tx-video-player__caption-text/);
      expect(css).not.toMatch(/\.tx-video-player__caption-text\s*\{[^}]*\bcolor:\s*#fff\b/i);
      expect(css).not.toMatch(
        /\.tx-video-player__caption-text\s*\{[^}]*background-color:[^;]*#000/i
      );
      expect(css).toMatch(/\.tx-video-player__caption-text\s*\{[^}]*(--tx-|CanvasText|Canvas)/s);
    }
    cleanup();
    {
      // keeps both sides of the caption scrim contrast pair in system colors
      const css = styleBlock(videoPlayerSource);
      expect(css).not.toMatch(
        /\.tx-video-player__caption-text\s*\{[^}]*background-color:[^}]*var\(--tx-background[^}]*CanvasText/s
      );
      expect(css).toMatch(/\.tx-video-player__caption-text\s*\{[^}]*color:\s*Canvas\s*;/s);
    }
    cleanup();
    // exposes captionsUnavailable on the labels contract
    // T-68: captions load failure copy is a label, not a hardcoded English string.
    expect(videoPlayerSource).toMatch(/captionsUnavailable:/);
    expect(videoPlayerSource).toMatch(/labels\.captionsUnavailable/);
    expect(videoPlayerSource).not.toMatch(/>Captions unavailable\.</);
  });
});

describe('video edit', () => {
  function styleBlock(source: string): string {
    const open = source.indexOf('<style>');
    const close = source.indexOf('</style>', open);
    return open === -1 || close === -1 ? '' : source.slice(open + 7, close);
  }

  describe('video edit model', () => {
    it('creates a full-length edit and validates trim and caption bounds; serializes clipped captions as escaped, trim-relative WebVTT', () => {
      // creates a full-length edit and validates trim and caption bounds
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
        validateVideoEdit(
          { version: 1, trim: { startMs: 3_000, endMs: 5_000 }, captions: [] },
          4_000
        )
      ).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '$.trim.endMs' })] });
      cleanup();
      // serializes clipped captions as escaped, trim-relative WebVTT
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
    it('edits a bounded trim and emits plain-text caption cues; paints through @layer tx.components and token border/surface roles', async () => {
      // edits a bounded trim and emits plain-text caption cues
      await (async () => {
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
      })();
      cleanup();
      {
        // paints through @layer tx.components and token border/surface roles
        // T-68: edit chrome must sit in tx.components and use --tx-* roles like VideoPlayer.
        const css = styleBlock(videoEditSource);
        expect(css).toMatch(/@layer\s+tx\.components/);
        expect(css).toMatch(/--tx-border/);
        expect(css).toMatch(/--tx-surface|--tx-background|--tx-radius/);
        expect(css).toMatch(/forced-colors:\s*active/);
      }
    });
  });
});
