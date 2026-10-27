import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  checkEmbedBlock,
  createSandboxedEmbedIframe,
  createSandboxedEmbedMount,
  EMBED_APP_MAX_BYTES,
  EMBED_BLOCK_TYPES,
  EMBED_IFRAME_REFERRER_POLICY,
  EMBED_IFRAME_SANDBOX,
  EMBED_IFRAME_SANDBOX_POPUPS_ESCAPE,
  embedIframeSandbox,
  loadEmbedFamily,
  resolveEmbedFrameSrc,
} from '../src/embed/index.ts';
import { EmbedBlockView } from '../src/embed/renderers.ts';

const validApp = {
  type: 'embed-app',
  title: 'Mini status',
  app: { kind: 'app', name: 'status', data: { status: 'Ready' } },
};

describe('checkEmbedBlock', () => {
  it('accepts both family blocks and clones app data into plain validated data, and 3 related cases', () => {
    {
      // accepts both family blocks and clones app data into plain validated data
      const app = checkEmbedBlock(validApp);
      const link = checkEmbedBlock({
        type: 'link-preview',
        href: 'https://example.com/guide',
        title: 'Guide',
        description: 'Read the guide',
      });
      expect(EMBED_BLOCK_TYPES).toEqual(['embed-app', 'link-preview']);
      expect(app.ok && app.block.type === 'embed-app' ? app.block.app : null).toEqual(validApp.app);
      expect(link.ok && link.block.type === 'link-preview' ? link.block.href : null).toBe(
        'https://example.com/guide'
      );
      if (app.ok && app.block.type === 'embed-app') expect(app.block.app).not.toBe(validApp.app);
    }
    cleanup();
    // rejects unsafe, credentialed, relative and non-HTTPS preview URLs
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,hello',
      '//example.com/path',
      'http://example.com',
      'https://user:pass@example.com',
      'https://example.com/\u202eexe',
    ]) {
      expect(checkEmbedBlock({ type: 'link-preview', href, title: 'Unsafe' }).ok, href).toBe(false);
    }
    cleanup();
    {
      // rejects oversized, nested, cyclic and non-JSON embedded app data
      expect(EMBED_APP_MAX_BYTES).toBe(2_400);
      expect(
        checkEmbedBlock({ ...validApp, app: { kind: 'app', content: 'x'.repeat(2_500) } }).ok
      ).toBe(false);
      expect(
        checkEmbedBlock({
          ...validApp,
          app: { kind: 'app', blocks: [{ type: 'embed-app', title: 'Nested' }] },
        }).ok
      ).toBe(false);
      const cyclic: Record<string, unknown> = { kind: 'app' };
      cyclic.self = cyclic;
      expect(checkEmbedBlock({ ...validApp, app: cyclic }).ok).toBe(false);
      expect(
        checkEmbedBlock({ ...validApp, app: { kind: 'app', text: 'bad\u202evalue' } }).ok
      ).toBe(false);
      const accessor = { kind: 'app' };
      Object.defineProperty(accessor, 'data', { enumerable: true, get: () => ({}) });
      expect(checkEmbedBlock({ ...validApp, app: accessor }).ok).toBe(false);
    }
    cleanup();
    // rejects other block families and unsafe preview labels
    expect(checkEmbedBlock({ type: 'heading', level: 2, text: 'No' }).ok).toBe(false);
    expect(
      checkEmbedBlock({
        type: 'link-preview',
        href: 'https://example.com',
        title: 'Bad\u202e title',
      }).ok
    ).toBe(false);
  });
});

describe('EmbedBlockView', () => {
  it('does not mount an embedded app until the user activates it, then closes and cleans up, and 4 related cases', async () => {
    // does not mount an embedded app until the user activates it, then closes and cleans up
    await (async () => {
      const mountEmbed = vi.fn((target: HTMLElement) => {
        const content = document.createElement('div');
        content.textContent = 'Running app';
        const first = document.createElement('button');
        first.textContent = 'First app action';
        const last = document.createElement('button');
        last.textContent = 'Last app action';
        target.append(content, first, last);
        return () => target.replaceChildren();
      });
      const { container, getByRole, queryByText } = render(EmbedBlockView, {
        block: validApp,
        mountEmbed,
      });
      expect(mountEmbed).not.toHaveBeenCalled();
      expect(container.querySelector('[data-tx-embed-started="true"]')).toBeNull();
      await fireEvent.click(getByRole('button', { name: 'Start the app' }));
      expect(mountEmbed).toHaveBeenCalledTimes(1);
      expect(queryByText('Running app')).not.toBeNull();
      const frame = container.querySelector<HTMLElement>('.tx-embed-mount');
      const [first, last] = container.querySelectorAll<HTMLButtonElement>('.tx-embed-mount button');
      expect(document.activeElement).toBe(frame);
      last?.focus();
      await fireEvent.keyDown(last as HTMLButtonElement, { key: 'Tab' });
      expect(document.activeElement).toBe(first);
      await fireEvent.keyDown(first as HTMLButtonElement, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
      await fireEvent.click(getByRole('button', { name: 'Close app' }));
      expect(queryByText('Running app')).toBeNull();
      expect(container.querySelector('[data-tx-embed-started="false"]')).not.toBeNull();
    })();
    cleanup();
    // does not call a missing host and exposes a useful alert
    await (async () => {
      const { getByRole, getByText } = render(EmbedBlockView, { block: validApp });
      await fireEvent.click(getByRole('button', { name: 'Start the app' }));
      expect(getByRole('alert').textContent).toContain('cannot start');
      expect(getByText('Nothing loads until you start the app.')).toBeTruthy();
    })();
    cleanup();
    {
      // renders safe link metadata with a protected new-window link and never fetches
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const { container } = render(EmbedBlockView, {
        block: {
          type: 'link-preview',
          href: 'https://example.com/guide',
          title: 'Guide',
          description: 'An offline preview',
          site: 'example.com',
        },
      });
      const anchor = container.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe('https://example.com/guide');
      expect(anchor?.getAttribute('target')).toBe('_blank');
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(container.textContent).toContain('An offline preview');
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    }
    cleanup();
    {
      // keeps invalid input inert and reports validation issues
      const oninvalid = vi.fn();
      const { container } = render(EmbedBlockView, {
        block: { type: 'link-preview', href: 'javascript:alert(1)', title: 'unsafe' },
        oninvalid,
      });
      expect(container.querySelector('a, iframe, script')).toBeNull();
      expect(container.querySelector('[data-tx-block="invalid"]')?.textContent).toContain(
        'not valid'
      );
      expect(oninvalid).toHaveBeenCalledWith([expect.objectContaining({ path: ['href'] })]);
    }
    cleanup();
    // loads the renderer lazily
    await (async () => {
      const loaded = await loadEmbedFamily();
      expect(loaded.default).toBe(EmbedBlockView);
    })();
  });
});

describe('sandboxed embed iframe host helper', () => {
  const allowed = ['https://widgets.example.com'] as const;
  it('sets sandbox without allow-same-origin and without popups-escape by default, and 4 related cases', () => {
    {
      // sets sandbox without allow-same-origin and without popups-escape by default
      const iframe = createSandboxedEmbedIframe({
        src: 'https://widgets.example.com/app?x=1',
        allowedOrigins: allowed,
        title: 'Status mini app',
      });
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('sandbox')).toBe(EMBED_IFRAME_SANDBOX);
      expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
      expect(iframe?.getAttribute('sandbox')).not.toContain('allow-popups-to-escape-sandbox');
      expect(iframe?.getAttribute('referrerpolicy')).toBe(EMBED_IFRAME_REFERRER_POLICY);
      expect(EMBED_IFRAME_REFERRER_POLICY).toBe('no-referrer');
      expect(iframe?.getAttribute('title')).toBe('Status mini app');
      expect(iframe?.getAttribute('src')).toBe('https://widgets.example.com/app?x=1');
    }
    cleanup();
    {
      // opts in to allow-popups-to-escape-sandbox only when requested
      expect(embedIframeSandbox()).toBe(EMBED_IFRAME_SANDBOX);
      expect(embedIframeSandbox({ allowPopupsToEscapeSandbox: true })).toBe(
        `${EMBED_IFRAME_SANDBOX} ${EMBED_IFRAME_SANDBOX_POPUPS_ESCAPE}`
      );
      const iframe = createSandboxedEmbedIframe({
        src: 'https://widgets.example.com/app',
        allowedOrigins: allowed,
        allowPopupsToEscapeSandbox: true,
      });
      expect(iframe?.getAttribute('sandbox')).toContain('allow-popups-to-escape-sandbox');
      expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    }
    cleanup();
    // refuses a non-allowlisted src and other unsafe forms
    expect(
      createSandboxedEmbedIframe({
        src: 'https://evil.example/app',
        allowedOrigins: allowed,
      })
    ).toBeNull();
    expect(resolveEmbedFrameSrc('https://evil.example/app', { allowedOrigins: allowed })).toBe(
      undefined
    );
    expect(resolveEmbedFrameSrc('javascript:alert(1)', { allowedOrigins: allowed })).toBe(
      undefined
    );
    expect(
      resolveEmbedFrameSrc('http://widgets.example.com/app', { allowedOrigins: allowed })
    ).toBe(undefined);
    expect(
      resolveEmbedFrameSrc('https://user:pass@widgets.example.com/app', {
        allowedOrigins: allowed,
      })
    ).toBe(undefined);
    expect(resolveEmbedFrameSrc('//widgets.example.com/app', { allowedOrigins: allowed })).toBe(
      undefined
    );
    cleanup();
    {
      // createSandboxedEmbedMount mounts a sandboxed iframe and cleans up
      const mount = createSandboxedEmbedMount({ allowedOrigins: allowed });
      const target = document.createElement('div');
      document.body.append(target);
      const cleanup = mount(target, {
        kind: 'app',
        src: 'https://widgets.example.com/panel',
        title: 'Panel',
      });
      const iframe = target.querySelector('iframe');
      expect(iframe?.getAttribute('sandbox')).toBe(EMBED_IFRAME_SANDBOX);
      expect(iframe?.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(iframe?.getAttribute('src')).toBe('https://widgets.example.com/panel');
      if (typeof cleanup === 'function') cleanup();
      expect(target.querySelector('iframe')).toBeNull();
      target.remove();
    }
    cleanup();
    {
      // createSandboxedEmbedMount throws when src is not allowlisted
      const mount = createSandboxedEmbedMount({ allowedOrigins: allowed });
      const target = document.createElement('div');
      expect(() => mount(target, { kind: 'app', src: 'https://other.example.com/x' })).toThrow(
        /allowlist/i
      );
      expect(target.querySelector('iframe')).toBeNull();
    }
  });
});
