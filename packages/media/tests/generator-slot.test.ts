import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GenerationRequestPlaceholder from '../src/generator-slot/GenerationRequestPlaceholder.svelte';
import GeneratorSlot from '../src/generator-slot/GeneratorSlot.svelte';
import {
  buildRequest,
  GENERATOR_SLOT_LIMITS,
  normalizeKind,
  normalizePrompt,
  parseMediaGenerationRequest,
  runGenerator,
  sanitizeGeneratorResult,
} from '../src/generator-slot/index.ts';
import type { MediaGenerator } from '../src/generator-slot/types.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SAFE_IMAGE = 'https://images.example.com/harbor.png';
const SAFE_VIDEO = 'https://media.example.com/clip.webm';

describe('generator-slot model', () => {
  it('stamps every generated result with request provenance and never copies the raw prompt', async () => {
    const requests: { prompt: string; options?: unknown }[] = [];
    const generated = await runGenerator(
      async (request) => {
        requests.push(request);
        return { kind: 'image', src: SAFE_IMAGE, alt: 'Fictional harbor' };
      },
      'fictional harbor at dusk',
      'image',
      {
        signal: new AbortController().signal,
        trust: 'untrusted',
        allowedOrigins: ['https://images.example.com'],
        providerLabel: 'host:mock',
        generationOptions: { aspectRatio: '16:9', quality: 'draft' },
      }
    );

    expect(generated.status).toBe('ready');
    if (generated.status !== 'ready') return;
    expect(generated.output.provenance).toMatchObject({
      source: 'model',
      generatorKind: 'image',
      providerLabel: 'host:mock',
      promptHash: expect.stringMatching(/^[a-f\d]{64}$/),
      createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      options: { aspectRatio: '16:9', quality: 'draft' },
    });
    expect(JSON.stringify(generated.output.provenance)).not.toContain('fictional harbor at dusk');
    expect(requests[0]?.options).toEqual({ aspectRatio: '16:9', quality: 'draft' });
  });

  it('normalizes prompts and rejects empty ones', () => {
    expect(normalizeKind('image')).toBe('image');
    expect(normalizeKind('video')).toBe('video');
    expect(normalizeKind('audio')).toBeUndefined();
    expect(normalizePrompt('  hello   world  ')).toBe('hello world');
    expect(normalizePrompt('')).toBe('');
    expect(buildRequest('   ', 'image')).toEqual({ ok: false, reason: 'empty-prompt' });
    expect(buildRequest('boats', 'audio')).toEqual({ ok: false, reason: 'invalid-kind' });
    expect(buildRequest('boats', 'video')).toEqual({
      ok: true,
      request: { prompt: 'boats', kind: 'video' },
    });
    expect(buildRequest('boats', 'video', undefined, { aspectRatio: '16:9' })).toEqual({
      ok: true,
      request: { prompt: 'boats', kind: 'video', options: { aspectRatio: '16:9' } },
    });
    expect(buildRequest('boats', 'video', undefined, { prompt: 'unsafe metadata' })).toEqual({
      ok: false,
      reason: 'invalid-options',
    });
    expect(GENERATOR_SLOT_LIMITS.maxPromptLength).toBe(2000);
  });

  it('sanitizes image and video results through the URL policy', () => {
    const image = sanitizeGeneratorResult(
      {
        kind: 'image',
        src: SAFE_IMAGE,
        alt: 'Harbor',
        provenance: { source: 'static', createdAt: '2026-10-24T18:30:00.000Z' },
      },
      'untrusted',
      { allowedOrigins: ['https://images.example.com'] }
    );
    expect(image).toEqual({
      ok: true,
      output: {
        kind: 'image',
        src: SAFE_IMAGE,
        alt: 'Harbor',
        provenance: { source: 'static', createdAt: '2026-10-24T18:30:00.000Z' },
      },
    });

    const blocked = sanitizeGeneratorResult(
      {
        kind: 'image',
        src: 'javascript:alert(1)',
        provenance: { source: 'static', createdAt: '2026-10-24T18:30:00.000Z' },
      },
      'untrusted'
    );
    expect(blocked).toEqual({ ok: false, reason: 'blocked-src' });

    const video = sanitizeGeneratorResult(
      {
        kind: 'video',
        src: SAFE_VIDEO,
        poster: SAFE_IMAGE,
        title: 'Clip',
        provenance: {
          source: 'model',
          createdAt: '2026-10-24T18:30:00.000Z',
          generatorKind: 'video',
          providerLabel: 'host:mock',
          promptHash: 'a'.repeat(64),
          options: {},
        },
      },
      'untrusted',
      { allowedOrigins: ['https://media.example.com', 'https://images.example.com'] }
    );
    expect(video.ok).toBe(true);
    if (video.ok) {
      expect(video.output.kind).toBe('video');
      expect(video.output.src).toBe(SAFE_VIDEO);
    }
  });

  it('keeps bounded provenance and intrinsic size while rejecting malformed audit data', () => {
    const provenance = {
      source: 'model',
      createdAt: '2026-10-24T18:30:00.000Z',
      generatorKind: 'image',
      providerLabel: 'host:mock',
      promptHash: 'a'.repeat(64),
      options: { aspectRatio: '16:9' },
      contentSha256: 'b'.repeat(64),
    } as const;
    const result = sanitizeGeneratorResult(
      { kind: 'image', src: SAFE_IMAGE, width: 1200, height: 800, provenance },
      'untrusted',
      { allowedOrigins: ['https://images.example.com'] }
    );
    expect(result).toEqual({
      ok: true,
      output: {
        kind: 'image',
        src: SAFE_IMAGE,
        alt: 'Generated result',
        width: 1200,
        height: 800,
        provenance,
      },
    });

    expect(
      sanitizeGeneratorResult({
        kind: 'image',
        src: SAFE_IMAGE,
        width: 0,
        height: 800,
      })
    ).toEqual({ ok: false, reason: 'invalid-result' });
    expect(
      sanitizeGeneratorResult({
        kind: 'image',
        src: SAFE_IMAGE,
        provenance: { ...provenance, promptHash: 'not-a-hash' },
      })
    ).toEqual({ ok: false, reason: 'invalid-result' });
    expect(
      sanitizeGeneratorResult({
        kind: 'image',
        src: SAFE_IMAGE,
        provenance: { source: 'static', createdAt: '2026-02-30T18:30:00Z' },
      })
    ).toEqual({ ok: false, reason: 'invalid-result' });
    expect(sanitizeGeneratorResult({ kind: 'audio', src: SAFE_IMAGE })).toEqual({
      ok: false,
      reason: 'invalid-result',
    });
  });

  it('parses unresolved generation nodes as inert, normalized data', () => {
    const parsed = parseMediaGenerationRequest({
      id: 'media.generate-request',
      props: {
        kind: 'image',
        prompt: '  Harbor   boats at dusk  ',
        aspectRatio: '16:9',
        placeholder: { kind: 'color', color: '#0f172a' },
        ignored: 'discarded',
      },
    });
    expect(parsed).toEqual({
      success: true,
      node: {
        id: 'media.generate-request',
        props: {
          kind: 'image',
          prompt: 'Harbor boats at dusk',
          aspectRatio: '16:9',
          placeholder: { kind: 'color', color: '#0f172a' },
        },
      },
    });
    expect(
      parseMediaGenerationRequest({ id: 'media.generate-request', props: { kind: 'image' } })
    ).toEqual({
      success: false,
      reason: 'empty-prompt',
    });
    expect(
      parseMediaGenerationRequest({
        id: 'media.generate-request',
        props: { kind: 'video', prompt: 'A clip', placeholder: { kind: 'color', color: 'url(x)' } },
      })
    ).toEqual({ success: false, reason: 'invalid-placeholder' });
  });

  it('refuses resolved media fields on an unresolved request node', () => {
    expect(
      parseMediaGenerationRequest({
        id: 'media.generate-request',
        props: {
          kind: 'image',
          prompt: 'Fictional harbor scene',
          src: SAFE_IMAGE,
          status: 'ready',
          provenance: { source: 'model' },
        },
      })
    ).toEqual({ success: false, reason: 'invalid-node' });
  });

  it('runs the host generator and maps abort / host errors', async () => {
    const ok: MediaGenerator = async () => ({
      kind: 'image',
      src: SAFE_IMAGE,
      alt: 'Out',
    });
    const ready = await runGenerator(ok, 'boats', 'image', {
      signal: new AbortController().signal,
      trust: 'untrusted',
      allowedOrigins: ['https://images.example.com'],
    });
    expect(ready).toMatchObject({
      status: 'ready',
      output: {
        kind: 'image',
        src: SAFE_IMAGE,
        alt: 'Out',
        provenance: {
          source: 'model',
          generatorKind: 'image',
          providerLabel: 'host:provided',
          promptHash: expect.stringMatching(/^[a-f\d]{64}$/),
          options: {},
          createdAt: expect.any(String),
        },
      },
    });
    expect(ready.status === 'ready' && ready.output.provenance).not.toHaveProperty('prompt');

    const controller = new AbortController();
    controller.abort();
    const cancelled = await runGenerator(ok, 'boats', 'image', {
      signal: controller.signal,
      trust: 'untrusted',
      allowedOrigins: ['https://images.example.com'],
    });
    expect(cancelled.status).toBe('cancelled');

    const failing: MediaGenerator = async () => {
      throw new Error('Upstream offline');
    };
    const failed = await runGenerator(failing, 'boats', 'image', {
      signal: new AbortController().signal,
    });
    expect(failed).toMatchObject({
      status: 'error',
      reason: 'host-error',
      message: 'Upstream offline',
    });

    const none = await runGenerator(undefined, 'boats', 'image', {
      signal: new AbortController().signal,
    });
    expect(none).toEqual({ status: 'error', reason: 'no-generator' });
  });

  it('refuses unsupported kinds before invoking the host', async () => {
    const generate = vi.fn<MediaGenerator>(async () => ({ kind: 'image', src: SAFE_IMAGE }));
    const outcome = await runGenerator(generate, 'Fictional harbor', 'audio', {
      signal: new AbortController().signal,
      trust: 'untrusted',
      allowedOrigins: ['https://images.example.com'],
    });
    expect(outcome).toEqual({ status: 'error', reason: 'invalid-kind' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses a host result whose kind differs from the submitted request', async () => {
    const outcome = await runGenerator(
      async () => ({ kind: 'video', src: SAFE_VIDEO }),
      'Fictional harbor',
      'image',
      {
        signal: new AbortController().signal,
        trust: 'untrusted',
        allowedOrigins: ['https://media.example.com'],
      }
    );
    expect(outcome).toEqual({ status: 'error', reason: 'invalid-result' });
  });

  it('maps malformed runtime host values to an error outcome', async () => {
    const outcome = await runGenerator(async () => null as never, 'Fictional harbor', 'image', {
      signal: new AbortController().signal,
    });
    expect(outcome).toEqual({ status: 'error', reason: 'invalid-result' });
  });
});

describe('GeneratorSlot', () => {
  it('shows idle chrome and refuses empty prompts', async () => {
    render(GeneratorSlot, {
      props: {
        generate: async () => ({ kind: 'image', src: SAFE_IMAGE, alt: 'x' }),
      },
    });
    expect(screen.getByRole('status').textContent).toMatch(/No model runs inside Texuli/i);
    await fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Enter a prompt/i));
  });

  it('loads, cancels, and never shows an unsafe result', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generate: MediaGenerator = async (_request, signal) => {
      await gate;
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return { kind: 'image', src: 'javascript:alert(1)', alt: 'bad' };
    };

    const { container } = render(GeneratorSlot, {
      props: {
        generate,
        prompt: 'unsafe out',
        trust: 'untrusted',
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(container.querySelector('[data-tx-generator-slot]')?.getAttribute('aria-busy')).toBe(
      'true'
    );
    expect(screen.getByRole('status').textContent).toMatch(/Generating/i);

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    release();
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/cancelled/i));
    expect(container.querySelector('[data-tx-generator-result]')).toBeNull();
  });

  it('renders a safe image result from the host', async () => {
    const generate: MediaGenerator = async (request) => ({
      kind: 'image',
      src: SAFE_IMAGE,
      alt: `Generated: ${request.prompt}`,
    });

    const { container } = render(GeneratorSlot, {
      props: {
        generate,
        prompt: 'harbor at dusk',
        trust: 'untrusted',
        allowedOrigins: ['https://images.example.com'],
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(container.querySelector('[data-tx-generator-result]')).toBeTruthy());
    const img = container.querySelector('[data-tx-generator-result] img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(SAFE_IMAGE);
    expect(img.getAttribute('alt')).toMatch(/harbor at dusk/i);
    expect(screen.getByRole('status').textContent).toMatch(/Generated result/i);
  });

  it('shows generated provenance accessibly without displaying the raw prompt as metadata', async () => {
    const onresult = vi.fn();
    const generate: MediaGenerator = async () => ({
      kind: 'image',
      src: SAFE_IMAGE,
      alt: 'Fictional generated image',
    });
    render(GeneratorSlot, {
      props: {
        generate,
        prompt: 'fictional harbor at dusk',
        providerLabel: 'host:mock',
        generationOptions: { aspectRatio: '16:9' },
        allowedOrigins: ['https://images.example.com'],
        onresult,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(await screen.findByText('host:mock')).toBeTruthy();
    expect(screen.getByText('image')).toBeTruthy();
    expect(screen.getByText('16:9', { exact: false })).toBeTruthy();
    expect(screen.getByText(/^[a-f\d]{64}$/i)).toBeTruthy();
    expect(screen.getByText(/\d{4}-\d\d-\d\dT/).tagName).toBe('TIME');
    const output = onresult.mock.calls[0]?.[0] as { provenance?: unknown };
    expect(JSON.stringify(output.provenance)).not.toContain('fictional harbor at dusk');
  });

  it('paints an unresolved request placeholder without generation controls', () => {
    render(GenerationRequestPlaceholder, {
      props: {
        node: {
          id: 'media.generate-request',
          props: { kind: 'video', prompt: 'Harbor boats at dusk', aspectRatio: '16:9' },
        },
      },
    });
    expect(screen.getByRole('status').textContent).toMatch(/Video request pending/i);
    expect(screen.getByRole('status').textContent).toMatch(/host to resolve/i);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Harbor boats at dusk')).toBeNull();
  });

  it('blocks an unsafe host image under untrusted trust', async () => {
    const generate: MediaGenerator = async () => ({
      kind: 'image',
      src: 'http://insecure.example/x.png',
      alt: 'nope',
    });
    const onerror = vi.fn();
    render(GeneratorSlot, {
      props: { generate, prompt: 'x', trust: 'untrusted', onerror },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/blocked/i));
    expect(onerror).toHaveBeenCalledWith('blocked-src');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
