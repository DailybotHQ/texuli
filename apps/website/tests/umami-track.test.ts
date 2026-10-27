/**
 * The track library units (T-35): disabled is a silent no-op, enabled
 * queues until the loader's ready signal then flushes in order, an
 * already-loaded script is called directly, payloads are sanitized
 * (keys and email-shaped values) before they are queued, a fully denied
 * payload still sends the event name, and failures never surface.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UMAMI_READY_EVENT } from '../src/lib/track.ts';

type UmamiStub = { track: ReturnType<typeof vi.fn> };

function stubUmami(): UmamiStub {
  const stub: UmamiStub = { track: vi.fn() };
  (globalThis as { umami?: UmamiStub }).umami = stub;
  return stub;
}

function clearUmami(): void {
  delete (globalThis as { umami?: unknown }).umami;
}

async function loadTrack(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) vi.stubEnv(key, value);
  }
  return import('../src/lib/track.ts');
}

const ENABLED = { PUBLIC_UMAMI_WEBSITE_ID: 'test-id', PUBLIC_UMAMI_ENABLE: 'true' };

afterEach(() => {
  clearUmami();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('track() when analytics is disabled', () => {
  it('is a no-op: the event is dropped, not deferred', async () => {
    const { track } = await loadTrack({});
    track('theme_switch', { from: 'light', to: 'dark' });
    const umami = stubUmami();
    document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));
    expect(umami.track).not.toHaveBeenCalled();
  });

  it('makes no console noise and never touches window.umami', async () => {
    const { track } = await loadTrack({});
    const logSpy = vi.spyOn(console, 'log');
    const warnSpy = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');
    track('code_copy', { page: '/guides/theming/' });
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect((globalThis as { umami?: unknown }).umami).toBeUndefined();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('track() when analytics is enabled', () => {
  it('queues until the ready signal, then flushes in order', async () => {
    const { track } = await loadTrack(ENABLED);
    track('theme_switch', { from: 'light', to: 'dark' });
    track('code_copy', { page: '/guides/theming/' });
    const umami = stubUmami();
    document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));
    expect(umami.track).toHaveBeenCalledTimes(2);
    expect(umami.track).toHaveBeenNthCalledWith(1, 'theme_switch', { from: 'light', to: 'dark' });
    expect(umami.track).toHaveBeenNthCalledWith(2, 'code_copy', { page: '/guides/theming/' });
  });

  it('calls an already-loaded script directly, bypassing the queue', async () => {
    const { track } = await loadTrack(ENABLED);
    const umami = stubUmami();
    track('studio_launch', { studio: 'media-lab' });
    expect(umami.track).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));
    expect(umami.track).toHaveBeenCalledTimes(1);
  });

  it('sanitizes before queueing: denied keys and email-shaped values', async () => {
    const { track } = await loadTrack(ENABLED);
    track('theme_switch', { from: 'contact alice@example.com', to: 'dark' });
    const umami = stubUmami();
    document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));
    expect(umami.track).toHaveBeenCalledWith('theme_switch', {
      from: 'contact [redacted]',
      to: 'dark',
    });
  });

  it('sends the event name with no data when every payload key is denied', async () => {
    const { track } = await loadTrack(ENABLED);
    // A hostile payload that is all denylisted keys: the event name itself
    // is not PII and still goes out, with no data attached.
    track('code_copy', { token: 'secret' } as unknown as { page: string });
    const umami = stubUmami();
    document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));
    expect(umami.track).toHaveBeenCalledWith('code_copy', undefined);
  });

  it('oncePerInstance forwards only the first call through the real path', async () => {
    const { oncePerInstance } = await loadTrack(ENABLED);
    const umami = stubUmami();
    const open = oncePerInstance('component_demo_open');
    open({ component: 'button' });
    open({ component: 'button' });
    open({ component: 'button' });
    expect(umami.track).toHaveBeenCalledTimes(1);
    expect(umami.track).toHaveBeenCalledWith('component_demo_open', { component: 'button' });
  });

  it('swallows emitter failures without console noise', async () => {
    const { track } = await loadTrack(ENABLED);
    const umami = stubUmami();
    umami.track.mockImplementation(() => {
      throw new Error('collector down');
    });
    const errorSpy = vi.spyOn(console, 'error');
    expect(() => track('theme_switch', { from: 'light', to: 'dark' })).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('scrubs email-shaped values from any string payload', async () => {
    const { track } = await loadTrack(ENABLED);
    // Outbound URLs reach track as origin + pathname only (outbound-links.ts);
    // an address in the path itself is still scrubbed here.
    track('outbound_doc_link', { url: 'https://example.com/people/bob@example.com/docs' });
    const umami = stubUmami();
    document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));
    expect(umami.track).toHaveBeenCalledWith('outbound_doc_link', {
      url: 'https://example.com/people/[redacted]/docs',
    });
  });
});
