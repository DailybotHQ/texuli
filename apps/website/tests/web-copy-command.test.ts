/**
 * T-43 — the landing install block's copy-to-clipboard command
 * (`web-copy-command.ts`), proven as behavior, not as source text.
 *
 * The module is the same seam CopyPage.astro rides: it copies the command,
 * reports through a `role="status"` region, and fires the analytics
 * `code_copy` event only after the clipboard write succeeded — never on a
 * failed or blocked copy. These tests run the real module in happy-dom with
 * a stubbed clipboard and a stubbed Umami global, with analytics enabled
 * through the same environment variables the site loader uses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type ClipboardStub = { writeText: ReturnType<typeof vi.fn> };
type UmamiStub = { track: ReturnType<typeof vi.fn> };

const COMMAND = 'pnpm add texuli@next';

function buildHost(): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('data-copy-command', '');
  host.innerHTML = [
    '<button type="button" data-copy-command-button="">Copy install command</button>',
    `<template data-copy-command-text="">${COMMAND}</template>`,
    '<p class="status" role="status" data-copy-command-status=""></p>',
  ].join('');
  document.body.append(host);
  return host;
}

function stubClipboard(impl: ClipboardStub['writeText'] | undefined): void {
  const value = impl === undefined ? undefined : { writeText: impl };
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

function stubUmami(): UmamiStub {
  const stub: UmamiStub = { track: vi.fn() };
  (globalThis as { umami?: UmamiStub }).umami = stub;
  return stub;
}

async function loadModule() {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('PUBLIC_UMAMI_WEBSITE_ID', 'test-id');
  vi.stubEnv('PUBLIC_UMAMI_ENABLE', 'true');
  return import('../src/components/sections/web/web-copy-command.ts');
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
  delete (globalThis as { umami?: unknown }).umami;
  vi.unstubAllEnvs();
  vi.resetModules();
  // Remove the clipboard stub so the next test decides what exists.
  stubClipboard(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('a successful copy', () => {
  it('copies the command, reports through the status region, then tracks code_copy', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>((text) => {
      void text;
      return Promise.resolve();
    });
    stubClipboard(writeText);
    const umami = stubUmami();
    const { wireCopyCommand } = await loadModule();
    const host = buildHost();
    const button = host.querySelector<HTMLButtonElement>('[data-copy-command-button]');
    const status = host.querySelector<HTMLElement>('[data-copy-command-status]');

    wireCopyCommand(host, '/install-test/');
    button?.click();
    await flush();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(COMMAND);
    expect(status?.textContent).toBe('Command copied.');
    expect(umami.track).toHaveBeenCalledTimes(1);
    expect(umami.track).toHaveBeenCalledWith('code_copy', { page: '/install-test/' });
  });
});

describe('a failed copy', () => {
  it('reports the failure and never fires the analytics event', async () => {
    stubClipboard(vi.fn(() => Promise.reject(new Error('blocked'))));
    const umami = stubUmami();
    const { wireCopyCommand } = await loadModule();
    const host = buildHost();
    const button = host.querySelector<HTMLButtonElement>('[data-copy-command-button]');
    const status = host.querySelector<HTMLElement>('[data-copy-command-status]');

    wireCopyCommand(host, '/install-test/');
    button?.click();
    await flush();

    expect(status?.textContent).toBe('Copy failed: your browser blocked the clipboard.');
    expect(umami.track).not.toHaveBeenCalled();
  });

  it('survives a missing clipboard API without throwing', async () => {
    stubClipboard(undefined);
    const umami = stubUmami();
    const { wireCopyCommand } = await loadModule();
    const host = buildHost();
    const status = host.querySelector<HTMLElement>('[data-copy-command-status]');

    expect(() => wireCopyCommand(host, '/install-test/')).not.toThrow();
    host.querySelector<HTMLButtonElement>('[data-copy-command-button]')?.click();
    await flush();

    expect(status?.textContent).toBe('Copy failed: your browser blocked the clipboard.');
    expect(umami.track).not.toHaveBeenCalled();
  });
});

describe('without analytics enabled', () => {
  it('the copy still succeeds: the event is a no-op, the status still reports', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    stubClipboard(
      vi.fn<(text: string) => Promise<void>>((text) => {
        void text;
        return Promise.resolve();
      })
    );
    const umami = stubUmami();
    const { wireCopyCommand } = await loadEnabledOffModule();
    const host = buildHost();
    const status = host.querySelector<HTMLElement>('[data-copy-command-status]');

    wireCopyCommand(host, '/install-test/');
    host.querySelector<HTMLButtonElement>('[data-copy-command-button]')?.click();
    await flush();

    expect(status?.textContent).toBe('Command copied.');
    expect(umami.track).not.toHaveBeenCalled();
  });
});

async function loadEnabledOffModule() {
  return import('../src/components/sections/web/web-copy-command.ts');
}
