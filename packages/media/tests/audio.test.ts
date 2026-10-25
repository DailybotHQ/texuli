import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_LIMITS,
  AudioPlayer,
  buildWaveformPeaks,
  clampSeekRatio,
  decodeWaveformPeaks,
  formatAudioTime,
  monoFromAudioBuffer,
  resolveAudioSource,
  Waveform,
} from '../src/audio/index.ts';

const HTTPS = 'https://cdn.example.com/clips/harbor-notes.mp3';
const DATA_AUDIO =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

describe('resolveAudioSource', () => {
  it('keeps blob and allowlisted https, drops unsafe sources', () => {
    expect(
      resolveAudioSource({
        src: HTTPS,
        allowedOrigins: ['https://cdn.example.com'],
      }).src
    ).toBe(HTTPS);
    expect(
      resolveAudioSource({
        src: 'blob:https://app.example/11111111-1111-4111-8111-111111111111',
      }).src
    ).toBe('blob:https://app.example/11111111-1111-4111-8111-111111111111');

    for (const src of [
      'javascript:alert(1)',
      DATA_AUDIO,
      'http://cdn.example.com/a.mp3',
      '//cdn.example.com/a.mp3',
      'https://user:pass@cdn.example.com/a.mp3',
      'vbscript:x',
      'ftp://cdn.example.com/a.mp3',
      '/relative/clip.mp3',
      HTTPS,
      42,
      undefined,
      '',
    ]) {
      const resolved = resolveAudioSource({ src });
      if (src === HTTPS) {
        // HTTPS without allowlist is dropped for untrusted trust.
        expect(resolved.src).toBeUndefined();
        expect(resolved.dropped).toBe(true);
        continue;
      }
      expect(resolved.src, String(src)).toBeUndefined();
      expect(resolved.dropped).toBe(true);
    }
  });

  it('widens the policy only for developer trust', () => {
    expect(
      resolveAudioSource({
        src: 'http://localhost:5173/clip.mp3',
        trust: 'developer',
      }).src
    ).toBe('http://localhost:5173/clip.mp3');
    expect(resolveAudioSource({ src: '/assets/clip.mp3', trust: 'developer' }).src).toBe(
      '/assets/clip.mp3'
    );
    expect(resolveAudioSource({ src: DATA_AUDIO, trust: 'developer' }).src).toBeUndefined();
    expect(
      resolveAudioSource({ src: 'javascript:alert(1)', trust: 'developer' }).src
    ).toBeUndefined();
  });
});

describe('formatAudioTime', () => {
  it('formats seconds as m:ss and h:mm:ss', () => {
    expect(formatAudioTime(0)).toBe('0:00');
    expect(formatAudioTime(5.9)).toBe('0:05');
    expect(formatAudioTime(65)).toBe('1:05');
    expect(formatAudioTime(3600)).toBe('1:00:00');
    expect(formatAudioTime(3723)).toBe('1:02:03');
    expect(formatAudioTime(-1)).toBe('0:00');
    expect(formatAudioTime(Number.NaN)).toBe('0:00');
  });
});

describe('buildWaveformPeaks', () => {
  it('downsamples mono samples into normalized peak bars', () => {
    const samples = Float32Array.from({ length: 64 }, (_, i) => (i % 8 === 0 ? 0.5 : 0.05));
    const peaks = buildWaveformPeaks(samples, 8);
    expect(peaks).toHaveLength(8);
    expect(Math.max(...peaks)).toBeCloseTo(1, 5);
    expect(peaks.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it('clamps bar count to AUDIO_LIMITS', () => {
    expect(buildWaveformPeaks([1, 0, 1], 2)).toHaveLength(AUDIO_LIMITS.minBars);
    expect(buildWaveformPeaks([1], 10_000)).toHaveLength(AUDIO_LIMITS.maxBars);
    expect(buildWaveformPeaks([])).toHaveLength(AUDIO_LIMITS.defaultBars);
  });
});

describe('monoFromAudioBuffer and clampSeekRatio', () => {
  it('mixes multi-channel buffers to mono', () => {
    const left = new Float32Array([1, 0, -1]);
    const right = new Float32Array([0, 1, 0]);
    const mono = monoFromAudioBuffer({
      numberOfChannels: 2,
      length: 3,
      getChannelData: (c) => (c === 0 ? left : right),
    });
    expect(Array.from(mono)).toEqual([0.5, 0.5, -0.5]);
  });

  it('clamps seek ratios into [0, 1]', () => {
    expect(clampSeekRatio(-0.2)).toBe(0);
    expect(clampSeekRatio(0.4)).toBe(0.4);
    expect(clampSeekRatio(1.5)).toBe(1);
    expect(clampSeekRatio(Number.NaN)).toBe(0);
  });
});

describe('decodeWaveformPeaks', () => {
  it('returns peaks from a mocked fetch + decoder', async () => {
    const samples = new Float32Array(32);
    for (let i = 0; i < samples.length; i += 1) samples[i] = i / 32;
    const fetchImpl = vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 }));
    const audioContext = {
      decodeAudioData: vi.fn(async () => ({
        numberOfChannels: 1,
        length: samples.length,
        duration: 1.25,
        getChannelData: () => samples,
      })),
      close: vi.fn(async () => undefined),
    };

    const result = await decodeWaveformPeaks(HTTPS, {
      barCount: 16,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      audioContext,
    });
    expect(result?.duration).toBe(1.25);
    expect(result?.peaks).toHaveLength(16);
    expect(audioContext.close).toHaveBeenCalled();
  });

  it('returns undefined when fetch fails or duration exceeds the limit', async () => {
    expect(
      await decodeWaveformPeaks(HTTPS, {
        fetchImpl: vi.fn(async () => {
          throw new Error('offline');
        }) as unknown as typeof fetch,
      })
    ).toBeUndefined();

    const long = await decodeWaveformPeaks(HTTPS, {
      fetchImpl: vi.fn(
        async () => new Response(new ArrayBuffer(4), { status: 200 })
      ) as unknown as typeof fetch,
      audioContext: {
        decodeAudioData: async () => ({
          numberOfChannels: 1,
          length: 1,
          duration: AUDIO_LIMITS.maxDurationSec + 1,
          getChannelData: () => new Float32Array([0]),
        }),
      },
    });
    expect(long).toBeUndefined();
  });
});

describe('Waveform', () => {
  it('exposes a keyboard-operable slider and reports seek', async () => {
    const onSeek = vi.fn();
    const peaks = buildWaveformPeaks(
      Float32Array.from({ length: 32 }, (_, i) => Math.sin(i / 4) * 0.8),
      16
    );
    const { getByRole } = render(Waveform, {
      props: { peaks, progress: 0.25, onSeek, label: 'Clip waveform' },
    });
    const slider = getByRole('slider', { name: 'Clip waveform' });
    expect(slider.getAttribute('aria-valuenow')).toBe('25');

    slider.focus();
    await fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(0.27, 5));

    await fireEvent.keyDown(slider, { key: 'Home' });
    expect(onSeek).toHaveBeenLastCalledWith(0);

    await fireEvent.keyDown(slider, { key: 'End' });
    expect(onSeek).toHaveBeenLastCalledWith(1);
  });

  it('ignores keyboard seek when disabled', async () => {
    const onSeek = vi.fn();
    const { getByRole } = render(Waveform, {
      props: {
        peaks: [0.2, 0.8, 0.4],
        progress: 0.5,
        disabled: true,
        onSeek,
      },
    });
    const slider = getByRole('slider');
    await fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

describe('AudioPlayer', () => {
  it('blocks an unsafe source and never mounts an audio element', async () => {
    const onError = vi.fn();
    const { container, getByRole } = render(AudioPlayer, {
      props: {
        src: 'javascript:alert(1)',
        label: 'Unsafe clip',
        onError,
      },
    });
    await tick();
    const region = getByRole('region', { name: 'Unsafe clip' });
    expect(region.getAttribute('data-status')).toBe('blocked');
    expect(container.querySelector('audio')).toBeNull();
    expect(container.querySelector('[data-tx-audio-message]')?.textContent).toBe(
      'Audio unavailable'
    );
    expect((getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders a waveform when peaks are provided for a safe blob source', async () => {
    const peaks = buildWaveformPeaks(
      Float32Array.from({ length: 48 }, (_, i) => (i % 6 === 0 ? 0.9 : 0.1)),
      24
    );
    const blobSrc = 'blob:https://app.example/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { container, getByRole } = render(AudioPlayer, {
      props: {
        src: blobSrc,
        peaks,
        label: 'Harbor Notes',
      },
    });
    await tick();
    expect(container.querySelector('audio')?.getAttribute('src')).toBe(blobSrc);
    expect(getByRole('slider', { name: 'Waveform' })).toBeTruthy();
    expect(container.querySelector('[data-tx-audio-current]')?.textContent).toBe('0:00');
  });
});
