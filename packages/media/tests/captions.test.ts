import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  CAPTION_LIMITS,
  CaptionsPanel,
  ChapterMenu,
  chapterAtTime,
  chaptersFromCues,
  cuesAtTime,
  formatCaptionTime,
  loadCaptionTrack,
  parseVttTimestamp,
  parseWebVtt,
  plainCueText,
  resolveCaptionSource,
  TranscriptView,
} from '../src/captions/index.ts';

const SAMPLE_CAPTIONS = `WEBVTT

NOTE Harbor tour — fictional

00:00:00.000 --> 00:00:02.500
Welcome aboard the <b>Harbor Notes</b> ferry.

00:00:02.500 --> 00:00:05.000
Watch the lighthouse on your right.

intro
00:00:05.000 --> 00:00:08.000
<v Guide>Please keep aisles clear.
`;

const SAMPLE_CHAPTERS = `WEBVTT

Chapter 1
00:00:00.000 --> 00:00:00.000
Departure

Chapter 2
00:00:30.000 --> 00:00:30.000
Open water

Chapter 3
00:01:00.000 --> 00:01:00.000
Lighthouse
`;

describe('resolveCaptionSource', () => {
  it('keeps blob and allowlisted https, drops unsafe sources; widens the policy only for developer trust', () => {
    {
      // keeps blob and allowlisted https, drops unsafe sources
      const https = 'https://cdn.example.com/tracks/en.vtt';
      expect(
        resolveCaptionSource({
          src: https,
          allowedOrigins: ['https://cdn.example.com'],
        }).src
      ).toBe(https);
      expect(
        resolveCaptionSource({
          src: 'blob:https://app.example/11111111-1111-4111-8111-111111111111',
        }).src
      ).toBe('blob:https://app.example/11111111-1111-4111-8111-111111111111');

      for (const src of [
        'javascript:alert(1)',
        'data:text/vtt,WEBVTT',
        'http://cdn.example.com/en.vtt',
        '/relative/en.vtt',
        https,
        42,
        undefined,
      ]) {
        const resolved = resolveCaptionSource({ src });
        if (src === https) {
          expect(resolved.src).toBeUndefined();
          expect(resolved.dropped).toBe(true);
          continue;
        }
        expect(resolved.src, String(src)).toBeUndefined();
        expect(resolved.dropped).toBe(true);
      }
    }
    cleanup();
    // widens the policy only for developer trust
    expect(resolveCaptionSource({ src: '/assets/en.vtt', trust: 'developer' }).src).toBe(
      '/assets/en.vtt'
    );
    expect(
      resolveCaptionSource({
        src: 'data:text/vtt,WEBVTT',
        trust: 'developer',
      }).src
    ).toBeUndefined();
    expect(
      resolveCaptionSource({
        src: 'javascript:alert(1)',
        trust: 'developer',
      }).src
    ).toBeUndefined();
  });
});

describe('parseWebVtt and helpers', () => {
  it('parses timestamps, strips tags and builds cues; rejects missing headers and oversized sources; formats time and resolves active cues and chapters', () => {
    {
      // parses timestamps, strips tags and builds cues
      expect(parseVttTimestamp('00:01.500')).toBe(1.5);
      expect(parseVttTimestamp('1:02:03.000')).toBe(3723);
      expect(parseVttTimestamp('nope')).toBeUndefined();

      const cues = parseWebVtt(SAMPLE_CAPTIONS);
      expect(cues.length).toBe(3);
      expect(cues[0]?.text).toBe('Welcome aboard the Harbor Notes ferry.');
      expect(cues[0]?.start).toBe(0);
      expect(cues[0]?.end).toBe(2.5);
      expect(cues[2]?.id).toBe('intro');
      expect(cues[2]?.text).toBe('Please keep aisles clear.');
      expect(plainCueText('A &amp; B <c.foo>x</c>')).toBe('A & B x');
    }
    cleanup();
    // rejects missing headers and oversized sources
    expect(parseWebVtt('00:00:00.000 --> 00:00:01.000\nHi')).toEqual([]);
    expect(parseWebVtt('STYLE\n::cue {}')).toEqual([]);
    expect(parseWebVtt(`WEBVTT\n\n${'x'.repeat(CAPTION_LIMITS.maxSourceChars)}`)).toEqual([]);
    cleanup();
    {
      // formats time and resolves active cues and chapters
      expect(formatCaptionTime(65)).toBe('1:05');
      expect(formatCaptionTime(3661)).toBe('1:01:01');
      expect(formatCaptionTime(-1)).toBe('0:00');

      const cues = parseWebVtt(SAMPLE_CAPTIONS);
      expect(cuesAtTime(cues, 1)[0]?.text).toContain('Welcome');
      expect(cuesAtTime(cues, 3)[0]?.text).toContain('lighthouse');
      expect(cuesAtTime(cues, 9)).toEqual([]);

      const chapters = chaptersFromCues(parseWebVtt(SAMPLE_CHAPTERS, { keepEmpty: true }));
      expect(chapters).toHaveLength(3);
      expect(chapters[0]?.title).toBe('Departure');
      expect(chapterAtTime(chapters, 45)?.title).toBe('Open water');
      expect(chapterAtTime(chapters, 0)?.title).toBe('Departure');
    }
  });
});

describe('loadCaptionTrack', () => {
  it('returns cues from a mocked fetch when the URL is allowed; returns undefined for blocked URLs and failed fetches', async () => {
    // returns cues from a mocked fetch when the URL is allowed
    await (async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(SAMPLE_CAPTIONS, { status: 200, headers: { 'Content-Type': 'text/vtt' } })
      );
      const result = await loadCaptionTrack('https://cdn.example.com/en.vtt', {
        allowedOrigins: ['https://cdn.example.com'],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result?.cues).toHaveLength(3);
      expect(result?.kind).toBe('captions');
    })();
    cleanup();
    // returns undefined for blocked URLs and failed fetches
    await (async () => {
      expect(await loadCaptionTrack('javascript:alert(1)')).toBeUndefined();
      expect(
        await loadCaptionTrack('https://cdn.example.com/en.vtt', {
          allowedOrigins: ['https://cdn.example.com'],
          fetchImpl: vi.fn(async () => {
            throw new Error('offline');
          }) as unknown as typeof fetch,
        })
      ).toBeUndefined();
    })();
  });
});

describe('ChapterMenu', () => {
  it('highlights the active chapter and reports selection', async () => {
    const chapters = chaptersFromCues(parseWebVtt(SAMPLE_CHAPTERS, { keepEmpty: true }));
    const onSelect = vi.fn();
    const { getByRole, getAllByRole } = render(ChapterMenu, {
      props: { chapters, currentTime: 35, onSelect, label: 'Tour chapters' },
    });
    expect(getByRole('navigation', { name: 'Tour chapters' })).toBeTruthy();
    const buttons = getAllByRole('button');
    expect(buttons[1]?.getAttribute('aria-current')).toBe('true');
    await fireEvent.click(buttons[2]!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Lighthouse', start: 60 })
    );
  });
});

describe('TranscriptView', () => {
  it('seeks to a cue on activate and marks the active cue', async () => {
    const cues = parseWebVtt(SAMPLE_CAPTIONS);
    const onSeek = vi.fn();
    const { getByRole, getAllByRole } = render(TranscriptView, {
      props: { cues, currentTime: 3, onSeek, label: 'Tour transcript' },
    });
    expect(getByRole('region', { name: 'Tour transcript' })).toBeTruthy();
    const buttons = getAllByRole('button');
    expect(buttons[1]?.getAttribute('aria-current')).toBe('true');
    await fireEvent.click(buttons[0]!);
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});

describe('CaptionsPanel', () => {
  it('blocks an unsafe track URL and never loads cues, and 2 related cases', async () => {
    // blocks an unsafe track URL and never loads cues
    await (async () => {
      const onError = vi.fn();
      const { container, getByRole } = render(CaptionsPanel, {
        props: {
          src: 'javascript:alert(1)',
          label: 'Unsafe track',
          onError,
        },
      });
      await tick();
      const region = getByRole('region', { name: 'Unsafe track' });
      expect(region.getAttribute('data-status')).toBe('blocked');
      expect(container.querySelector('[data-tx-captions-message]')?.textContent).toBe(
        'Caption track unavailable'
      );
      expect(onError).toHaveBeenCalled();
    })();
    cleanup();
    // renders chapters and transcript from inline VTT and seeks
    await (async () => {
      const onSeek = vi.fn();
      const { getByRole, getAllByRole, container } = render(CaptionsPanel, {
        props: {
          vtt: SAMPLE_CAPTIONS,
          chapters: chaptersFromCues(parseWebVtt(SAMPLE_CHAPTERS, { keepEmpty: true })),
          currentTime: 1,
          label: 'Harbor captions',
          onSeek,
        },
      });
      await tick();
      expect(getByRole('region', { name: 'Harbor captions' }).getAttribute('data-status')).toBe(
        'ready'
      );
      expect(container.querySelector('[data-tx-captions-active]')?.textContent).toContain(
        'Welcome aboard'
      );
      expect(getByRole('navigation', { name: 'Chapters' })).toBeTruthy();
      expect(getByRole('region', { name: 'Transcript' })).toBeTruthy();

      const chapterButtons = getAllByRole('button').filter((b) =>
        b.hasAttribute('data-tx-chapter-button')
      );
      await fireEvent.click(chapterButtons[1]!);
      expect(onSeek).toHaveBeenCalledWith(30);
    })();
    cleanup();
    // parses a chapters-kind inline track into the chapter menu
    await (async () => {
      const { getAllByRole } = render(CaptionsPanel, {
        props: {
          vtt: SAMPLE_CHAPTERS,
          kind: 'chapters',
          showTranscript: false,
          showActive: false,
          label: 'Chapters only',
        },
      });
      await tick();
      const chapterButtons = getAllByRole('button').filter((b) =>
        b.hasAttribute('data-tx-chapter-button')
      );
      expect(chapterButtons).toHaveLength(3);
      expect(chapterButtons[0]?.textContent).toContain('Departure');
    })();
  });
});
