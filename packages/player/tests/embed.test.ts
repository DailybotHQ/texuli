import { render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerFrameClient, normalizeParentOrigin } from '../src/embed/client.ts';
import { createPlayerFrameHost } from '../src/embed/host.ts';
import {
  PLAYER_FRAME_MAX_SIZE,
  PLAYER_FRAME_PROTOCOL,
  PLAYER_FRAME_SANDBOX,
  parseFrameMessage,
  parseHostMessage,
  sanitizeFrameOptions,
} from '../src/embed/protocol.ts';
import { resolvePlayerLabels, safeLang } from '../src/labels.ts';
import { mountPlayer, mountPlayerFrame } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import PlayerFrame from '../src/PlayerFrame.svelte';
import { scenario } from './scenario.ts';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const page = { id: 'layout-page', props: { title: 'Fictional page' } };
const loaders = { 'layout-page': layoutLoader };
const HOST = 'https://app.example.com';

function message(origin: string, source: unknown, data: unknown): MessageEvent {
  const event = new MessageEvent('message', { data, origin });
  Object.defineProperty(event, 'source', { value: source });
  return event;
}

/** A window stand-in: an event target with a `postMessage` spy and a parent. */
function fakeWindow(parent?: unknown) {
  const target = new EventTarget() as EventTarget & {
    postMessage: ReturnType<typeof vi.fn>;
    parent: unknown;
  };
  target.postMessage = vi.fn();
  target.parent = parent ?? target;
  return target;
}

describe('Player host props', () => {
  it('host props: dir, lang, density, localized chrome, diagnostics and resize reports', async () => {
    await scenario('applies dir, a well-formed lang and density to the root', async () => {
      const { container } = render(Player, {
        props: { blueprint: page, loaders, dir: 'rtl', lang: 'ar-EG', density: 'compact' },
      });
      const root = container.querySelector('[data-tx-player]');
      expect(root?.getAttribute('dir')).toBe('rtl');
      expect(root?.getAttribute('lang')).toBe('ar-EG');
      expect(root?.getAttribute('data-density')).toBe('compact');
    });
    await scenario('drops a lang that is not a language tag', async () => {
      const { container } = render(Player, {
        props: { blueprint: page, loaders, lang: 'en" onload="x' },
      });
      expect(container.querySelector('[data-tx-player]')?.hasAttribute('lang')).toBe(false);
      expect(safeLang('pt-BR')).toBe('pt-BR');
      expect(safeLang('')).toBeUndefined();
    });
    await scenario(
      'paints host-localized chrome labels, keeping defaults for empty overrides',
      async () => {
        render(Player, {
          props: {
            blueprint: { id: 'layout-doc', props: { href: 'javascript:alert(1)' } },
            labels: {
              status: { invalid: 'Borrador no válido', draft: '' },
              invalidNotice: 'No válido.',
            },
          },
        });
        expect(screen.getByText('Borrador no válido')).toBeTruthy();
        expect(screen.getByRole('alert').textContent).toContain('No válido.');
        expect(resolvePlayerLabels({ status: { draft: '' } }).status.draft).toBe('Draft');
      }
    );
    await scenario('localizes placeholder and loading copy', async () => {
      const { container } = render(Player, {
        props: {
          blueprint: {
            id: 'layout-page',
            props: { title: 'Page' },
            children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'x' } } }],
          },
          loaders: { 'layout-page': layoutLoader, 'blocks-text': () => new Promise(() => {}) },
          loadTimeoutMs: 0,
          labels: { loading: 'Cargando', placeholders: { 'no-loader': 'Sin pintor.' } },
        },
      });
      await screen.findByRole('heading', { level: 1, name: 'Page' });
      expect(container.querySelector('[data-tx-player-skeleton]')?.textContent).toContain(
        'Cargando'
      );

      render(Player, {
        props: {
          blueprint: {
            id: 'layout-page',
            props: { title: 'Other' },
            children: [
              { id: 'media-image', props: { src: 'https://images.example/a.png', alt: 'A' } },
            ],
          },
          loaders,
          labels: { placeholders: { 'no-loader': 'Sin pintor.' } },
        },
      });
      expect((await screen.findByRole('note')).textContent).toContain('Sin pintor.');
    });
    await scenario('reports diagnostics with the receipt after each validation', async () => {
      const onDiagnostics = vi.fn();
      render(Player, {
        props: {
          blueprint: { id: 'layout-doc', props: { href: 'javascript:alert(1)' } },
          onDiagnostics,
        },
      });
      expect(onDiagnostics).toHaveBeenCalledTimes(1);
      const [event] = onDiagnostics.mock.calls[0] ?? [];
      expect(event).toMatchObject({ status: 'invalid', surface: 'notice', error: 'invalid' });
      expect(event.receipt).toMatchObject({ ok: false, tier: 'untrusted' });
      expect(event.diagnostics.length).toBeGreaterThan(0);
    });
    await scenario('reports its border-box size to onResize', async () => {
      const callbacks: ResizeObserverCallback[] = [];
      const original = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
      try {
        const onResize = vi.fn();
        render(Player, { props: { blueprint: page, loaders, onResize } });
        flushSync();
        const entry = {
          borderBoxSize: [{ blockSize: 480.2, inlineSize: 640 }],
          contentRect: { height: 0, width: 0 },
        } as unknown as ResizeObserverEntry;
        for (const callback of callbacks) callback([entry], {} as ResizeObserver);
        expect(onResize).toHaveBeenCalledWith({ blockSize: 481, inlineSize: 640 });
      } finally {
        globalThis.ResizeObserver = original;
      }
    });
  });
});

describe('player-frame protocol', () => {
  it('the player-frame protocol ignores unknown messages, rebuilds known options and clamps sizes', () => {
    expect(parseHostMessage({ type: 'init', blueprint: page })).toBeNull();
    expect(parseHostMessage({ protocol: PLAYER_FRAME_PROTOCOL, type: 'eval' })).toBeNull();
    expect(parseHostMessage({ protocol: PLAYER_FRAME_PROTOCOL, type: 'init' })).toBeNull();
    expect(parseFrameMessage('ready')).toBeNull();
    expect(
      parseFrameMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'resize',
        blockSize: -1,
        inlineSize: 1,
      })
    ).toBeNull();
    expect(
      sanitizeFrameOptions({
        tier: 'root',
        status: 'invalid',
        label: 'Report',
        lang: 'x'.repeat(600),
        density: 'compact',
        loaders: { evil: 'code' },
        labels: { loading: 'Cargando', status: { draft: 7 }, extra: 'no' },
      })
    ).toEqual({
      label: 'Report',
      density: 'compact',
      labels: { loading: 'Cargando', status: {}, placeholders: {} },
    });
    expect(
      parseFrameMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'resize',
        blockSize: 1e9,
        inlineSize: 10.2,
      })
    ).toEqual({
      protocol: PLAYER_FRAME_PROTOCOL,
      type: 'resize',
      blockSize: PLAYER_FRAME_MAX_SIZE,
      inlineSize: 11,
    });
  });
});

describe('createPlayerFrameHost', () => {
  function setup() {
    const hostWindow = fakeWindow();
    const frameWindow = fakeWindow();
    const frame = Object.assign(new EventTarget(), {
      contentWindow: frameWindow,
      ownerDocument: { defaultView: hostWindow },
    }) as unknown as HTMLIFrameElement;
    const onReady = vi.fn();
    const onResize = vi.fn();
    const onDiagnostics = vi.fn();
    const host = createPlayerFrameHost({ frame, onReady, onResize, onDiagnostics });
    return { hostWindow, frameWindow, frame, host, onReady, onResize, onDiagnostics };
  }
  const ready = { protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' };
  const resize = {
    protocol: PLAYER_FRAME_PROTOCOL,
    type: 'resize',
    blockSize: 300,
    inlineSize: 500,
  };

  it('createPlayerFrameHost waits for ready, accepts only its sandboxed frame and stops after dispose', () => {
    // sends nothing before the frame is ready, then posts init to the frame window
    {
      const { hostWindow, frameWindow, host, onReady } = setup();
      expect(host.init(page)).toBe(false);
      hostWindow.dispatchEvent(message('null', frameWindow, ready));
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(host.init(page, { label: 'Report' })).toBe(true);
      expect(frameWindow.postMessage).toHaveBeenCalledWith(
        {
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'init',
          blueprint: page,
          options: { label: 'Report' },
        },
        '*'
      );
    }
    // accepts only its own frame with the opaque sandbox origin
    {
      const { hostWindow, frameWindow, onReady, onResize } = setup();
      hostWindow.dispatchEvent(message('null', fakeWindow(), ready));
      hostWindow.dispatchEvent(message('https://evil.example', frameWindow, ready));
      expect(onReady).not.toHaveBeenCalled();
      hostWindow.dispatchEvent(message('null', frameWindow, resize));
      expect(onResize).not.toHaveBeenCalled();
      hostWindow.dispatchEvent(message('null', frameWindow, ready));
      hostWindow.dispatchEvent(message('null', frameWindow, resize));
      expect(onResize).toHaveBeenCalledWith({ blockSize: 300, inlineSize: 500 });
    }
    // forgets readiness when the frame reloads, and stops after dispose
    {
      const { hostWindow, frameWindow, frame, host, onDiagnostics } = setup();
      hostWindow.dispatchEvent(message('null', frameWindow, ready));
      frame.dispatchEvent(new Event('load'));
      expect(host.ready).toBe(false);
      expect(host.update({ status: 'active' })).toBe(false);
      hostWindow.dispatchEvent(message('null', frameWindow, ready));
      host.dispose();
      hostWindow.dispatchEvent(
        message('null', frameWindow, {
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'diagnostics',
          status: 'draft',
          ok: true,
          errors: 0,
          warnings: 0,
        })
      );
      expect(onDiagnostics).not.toHaveBeenCalled();
      expect(host.init(page)).toBe(false);
    }
  });
});

describe('createPlayerFrameClient', () => {
  const init = { protocol: PLAYER_FRAME_PROTOCOL, type: 'init', blueprint: page, options: {} };

  it('createPlayerFrameClient refuses unsafe origins, announces only to allowed ones and pins the parent', async () => {
    await scenario('refuses wildcard, opaque and plain-http origins', async () => {
      expect(normalizeParentOrigin('*')).toBeNull();
      expect(normalizeParentOrigin('null')).toBeNull();
      expect(normalizeParentOrigin('http://app.example.com')).toBeNull();
      expect(normalizeParentOrigin('https://user:pw@app.example.com')).toBeNull();
      expect(normalizeParentOrigin('https://app.example.com/path')).toBe(HOST);
      expect(normalizeParentOrigin('http://localhost:4870')).toBe('http://localhost:4870');
    });
    await scenario('announces ready to each allowed origin only, never to "*"', async () => {
      const parent = fakeWindow();
      const win = fakeWindow(parent);
      createPlayerFrameClient({
        parentOrigins: [HOST, '*', 'http://evil.example'],
        window: win as unknown as Window,
      });
      expect(parent.postMessage).toHaveBeenCalledTimes(1);
      expect(parent.postMessage).toHaveBeenCalledWith(
        { protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' },
        HOST
      );
    });
    await scenario(
      'accepts the parent from an allowed origin, pins it, and replies to it exactly',
      async () => {
        const parent = fakeWindow();
        const win = fakeWindow(parent);
        const onInit = vi.fn();
        const client = createPlayerFrameClient({
          parentOrigins: [HOST, 'https://other.example.com'],
          window: win as unknown as Window,
          onInit,
        });
        parent.postMessage.mockClear();
        client.resize({ blockSize: 10, inlineSize: 10 });
        expect(parent.postMessage).not.toHaveBeenCalled();

        win.dispatchEvent(message(HOST, fakeWindow(), init));
        win.dispatchEvent(message('https://evil.example', parent, init));
        expect(onInit).not.toHaveBeenCalled();

        win.dispatchEvent(message(HOST, parent, init));
        expect(onInit).toHaveBeenCalledTimes(1);
        expect(client.parentOrigin).toBe(HOST);
        win.dispatchEvent(message('https://other.example.com', parent, init));
        expect(onInit).toHaveBeenCalledTimes(1);

        client.resize({ blockSize: 120, inlineSize: 300 });
        expect(parent.postMessage).toHaveBeenCalledWith(
          { protocol: PLAYER_FRAME_PROTOCOL, type: 'resize', blockSize: 120, inlineSize: 300 },
          HOST
        );
      }
    );
  });
});

describe('mountPlayer and mountPlayerFrame', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mountPlayer and mountPlayerFrame mount, update, dispose and report to the pinned origin', async () => {
    await scenario('mounts, updates and disposes a player without Svelte in the host', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayer(target, { blueprint: page, loaders, label: 'First' });
      expect(target.querySelector('[aria-label="First"]')).toBeTruthy();
      mounted.update({ label: 'Second' });
      expect(target.querySelector('[aria-label="Second"]')).toBeTruthy();
      expect(target.querySelectorAll('[data-tx-player]')).toHaveLength(1);
      mounted.dispose();
      expect(target.querySelector('[data-tx-player]')).toBeNull();
    });
    await scenario(
      'paints the host init inside the frame and reports diagnostics to the pinned origin',
      async () => {
        const parent = fakeWindow();
        const win = fakeWindow(parent);
        const target = document.createElement('div');
        document.body.append(target);
        const frame = mountPlayerFrame(target, {
          parentOrigins: [HOST],
          window: win as unknown as Window,
          loaders,
        });
        win.dispatchEvent(
          message(HOST, parent, {
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'init',
            blueprint: page,
            options: { label: 'Framed report', loaders: { 'layout-page': 'ignored' } },
          })
        );
        expect(target.querySelector('[aria-label="Framed report"]')).toBeTruthy();
        expect(
          await screen.findByRole('heading', { level: 1, name: 'Fictional page' })
        ).toBeTruthy();
        expect(parent.postMessage).toHaveBeenCalledWith(
          {
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'diagnostics',
            status: 'draft',
            ok: true,
            errors: 0,
            warnings: 0,
          },
          HOST
        );
        frame.dispose();
        expect(target.querySelector('[data-tx-player]')).toBeNull();
      }
    );
  });
});

describe('PlayerFrame', () => {
  it('PlayerFrame renders a sandboxed no-referrer iframe only for allowlisted HTTPS origins', async () => {
    await scenario(
      'renders a scripts-only, no-referrer sandboxed iframe for an allowed HTTPS origin',
      async () => {
        const { container } = render(PlayerFrame, {
          props: {
            src: 'https://player.example.com/frame.html',
            allowedOrigins: ['https://player.example.com'],
            blueprint: page,
            title: 'Report frame',
          },
        });
        const iframe = container.querySelector('iframe');
        expect(iframe?.getAttribute('sandbox')).toBe(PLAYER_FRAME_SANDBOX);
        expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
        expect(iframe?.getAttribute('referrerpolicy')).toBe('no-referrer');
        expect(iframe?.getAttribute('title')).toBe('Report frame');
      }
    );
    await scenario('refuses a frame address outside the allowlist or not on HTTPS', async () => {
      for (const src of [
        'https://evil.example/frame.html',
        'http://player.example.com/frame.html',
        'javascript:alert(1)',
      ]) {
        const { container, unmount } = render(PlayerFrame, {
          props: { src, allowedOrigins: ['https://player.example.com'], blueprint: page },
        });
        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('[data-tx-player-frame-refused]')).toBeTruthy();
        unmount();
      }
    });
  });
});
