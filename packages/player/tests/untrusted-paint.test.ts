import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { createEnvelope } from '@texuli/catalog/envelope';
import type { Component, ComponentProps } from 'svelte';
import { flushSync, tick } from 'svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PLAYER_FRAME_PROTOCOL } from '../src/embed/protocol.ts';
import { mountPlayer, mountPlayerFrame } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT, resolveStateBindings } from '../src/state/bind.ts';
import { probeLog } from './probe-log.ts';

/**
 * Audit for the player's paint property: whatever path a blueprint takes in
 * (object, text, local-state wrapper, setState, update(), frame protocol),
 * nothing reaches a component or the DOM without validateDraft and the
 * paint-time untrusted URL policy. Every painter is replaced by a probe that
 * records the props it was handed.
 */

let probe: Component<Record<string, unknown>>;
const ids = [
  'layout-page',
  'layout-doc',
  'layout-card',
  'layout-grid',
  'layout-deck',
  'deck-slide',
  'layout-stack',
  'layout-row',
  'layout-split',
  'layout-tile',
  'control-toggle',
  'control-choice',
  'control-slider',
  'control-filter',
  'flow-view',
  'flow-action',
  'action-form',
  'form-field',
  'form-submit',
  'blocks-text',
  'blocks-media',
  'media-image',
  'charts-bar',
];
let loaders: Record<string, () => Promise<unknown>>;

beforeAll(async () => {
  probe = (await import('./ProbePainter.svelte')).default as Component<Record<string, unknown>>;
  loaders = Object.fromEntries(ids.map((id) => [id, async () => probe]));
});

afterEach(() => {
  probeLog.length = 0;
  document.body.innerHTML = '';
});

// ── Hostile corpus ──────────────────────────────────────────────

const HOSTILE_URLS = [
  'javascript:alert(1)',
  ' JaVaScRiPt:alert(1)',
  '\u0000javascript:alert(1)',
  'java\tscript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:image/svg+xml,<svg onload=alert(1)>',
  '//evil.example/x.png',
  'file:///etc/passwd',
];
const HOSTILE_TEXT = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '"><svg onload=alert(1)>',
  '</p><iframe src=javascript:alert(1)>',
];
const HOSTILE_STRINGS = [...HOSTILE_URLS, ...HOSTILE_TEXT];

/** JSON text, so "__proto__" and friends arrive as own keys, as from the network. */
const fromJson = (text: string): unknown => JSON.parse(text);

function page(children: unknown[], props: Record<string, unknown> = { title: 'Audit' }) {
  return { id: 'layout-page', props, children };
}

const HOSTILE_TREES: ReadonlyArray<[string, unknown]> = [
  ...HOSTILE_TEXT.map((text): [string, unknown] => [
    `html title ${text}`,
    page([], { title: text }),
  ]),
  ...HOSTILE_URLS.map((url): [string, unknown] => [
    `image src ${JSON.stringify(url)}`,
    page([{ id: 'media-image', props: { src: url, alt: 'Probe' } }]),
  ]),
  [
    'handler, style and markup keys',
    fromJson(
      '{"id":"layout-page","props":{"title":"Audit","onclick":"alert(1)","onError":"x","style":"x","class":"x","innerHTML":"<b>x</b>","srcdoc":"<b>x</b>","dangerouslySetInnerHTML":{"__html":"<b>x</b>"}}}'
    ),
  ],
  [
    'prototype keys',
    fromJson(
      '{"id":"layout-page","props":{"title":"Audit","__proto__":{"title":"<img src=x onerror=alert(1)>","href":"javascript:alert(1)"},"constructor":{"prototype":{"x":1}}}}'
    ),
  ],
  [
    'hostile ids',
    page([
      { id: '<img src=x onerror=alert(1)>', props: {} },
      { id: '__proto__', props: {} },
      { id: 'constructor', props: {} },
      { id: 'toString', props: {} },
    ]),
  ],
  [
    'hostile node shape',
    page([
      { id: 'layout-card', props: { title: 'Card' }, html: '<b>x</b>', children: 'not-an-array' },
      { id: 'layout-card', props: { title: 'Card' }, children: [null, 7, 'text', ['nested']] },
    ]),
  ],
  [
    'nested URLs in block data',
    page([
      {
        id: 'blocks-text',
        props: {
          block: {
            type: 'text',
            markdown: '[x](javascript:alert(1))',
            meta: { href: 'javascript:alert(1)', imageSrc: 'data:text/html,x', onload: 'x' },
          },
        },
      },
    ]),
  ],
  [
    'hostile deck and slides',
    {
      id: 'layout-deck',
      props: { title: 'Deck', locale: 'en" onload="x', themeRef: { href: 'javascript:alert(1)' } },
      children: [
        {
          id: 'deck-slide',
          props: {
            slideId: '"><img src=x onerror=alert(1)>',
            title: 'S',
            notes: '<script>x</script>',
          },
        },
        {
          id: 'deck-slide',
          props: { slideId: 'ok', title: 'T', themeRef: { imageSrc: 'data:text/html,x' } },
        },
      ],
    },
  ],
  [
    'hostile grid gap',
    page([
      {
        id: 'layout-grid',
        props: { columns: 1e9, gap: '1rem; background:url(javascript:alert(1))' },
      },
    ]),
  ],
  [
    'hostile G20 layout tokens',
    page([
      { id: 'layout-stack', props: { gap: '1rem; background:url(javascript:alert(1))' } },
      { id: 'layout-row', props: { align: 'center"><img src=x onerror=alert(1)>', wrap: 'yes' } },
      { id: 'layout-split', props: { ratio: '1fr 999999fr' } },
      {
        id: 'layout-grid',
        props: { columns: 2 },
        children: [{ id: 'layout-tile', props: { title: 'T', span: 1e9, rowSpan: -1 } }],
      },
    ]),
  ],
  [
    'hostile state-only controls',
    page([
      {
        id: 'control-toggle',
        props: { state: '__proto__', label: '<img src=x onerror=alert(1)>' },
      },
      {
        id: 'control-filter',
        props: {
          state: 'q',
          label: 'Q',
          placeholder: 'javascript:alert(1)',
          onsubmit: 'x',
          formaction: 'https://evil.example',
        },
      },
      { id: 'control-choice', props: { state: { $state: 'x' }, label: 'C' } },
    ]),
  ],
  [
    'hostile flow nodes',
    page([
      {
        id: 'flow-view',
        props: { name: '"><img src=x onerror=alert(1)>', label: 'javascript:alert(1)' },
      },
      {
        id: 'flow-action',
        props: {
          event: 'next',
          label: 'Next',
          href: 'javascript:alert(1)',
          formaction: 'https://evil.example',
        },
      },
    ]),
  ],
  [
    'hostile action surface',
    page([
      {
        id: 'action-form',
        props: {
          action: 'javascript:alert(1)',
          label: '<b>x</b>',
          formaction: 'https://evil.example',
          method: 'post',
        },
        children: [
          {
            id: 'form-field',
            props: {
              name: 'card',
              state: 'x',
              label: 'Card',
              autocomplete: 'cc-number',
              pattern: '.*',
              onchange: 'x',
            },
          },
          { id: 'form-submit', props: { label: 'Pay', formaction: 'javascript:alert(1)' } },
        ],
      },
    ]),
  ],
  [
    'media trust widening and autoplay',
    page([
      {
        id: 'media-image',
        props: {
          src: 'https://images.example/a.png',
          srcset: 'http://images.example/a-2x.png 2x',
          alt: 'Probe',
          trust: 'developer',
        },
      },
      {
        id: 'blocks-media',
        props: {
          block: {
            type: 'video',
            src: 'media/clip.mp4',
            label: 'Clip',
            width: 640,
            height: 360,
            autoplay: true,
            muted: true,
            controls: false,
          },
        },
      },
    ]),
  ],
  [
    'binding objects without a wrapper',
    page([{ id: 'media-image', props: { src: { $state: 'x' }, alt: { $state: 'y' } } }], {
      title: { $state: 'title' },
    }),
  ],
];

// ── Invariants ──────────────────────────────────────────────────

const FORBIDDEN_KEY =
  /^(on[a-z].*|class|classname|style|styles|innerhtml|outerhtml|srcdoc|dangerouslysetinnerhtml|__proto__|constructor|prototype)$/i;
const URL_KEY = /(^href$|^src$|^poster$|href$|src$|url$)/i;
const UNSAFE_URL =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are part of the attack
  /^[\s\u0000-\u001f]*(j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|vbscript|data|file|blob)\s*:/i;
const HTML_STRING = /<\s*\/?\s*[a-z!]/i;

function walk(
  value: unknown,
  path: string,
  visit: (key: string, value: unknown, path: string) => void
) {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) walk(entry, `${path}[${index}]`, visit);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') continue;
    const child = (value as Record<string, unknown>)[key];
    visit(key, child, `${path}.${key}`);
    walk(child, `${path}.${key}`, visit);
  }
}

/** What painted, as a list of violations (empty when safe). */
function violations(container: Element): string[] {
  const out: string[] = [];
  for (const record of probeLog) {
    // Top-level strings went through the renderer's HTML-string check.
    for (const [key, value] of Object.entries(record.props)) {
      if (typeof value === 'string' && HTML_STRING.test(value)) {
        out.push(`${record.id}.${key}: HTML string painted`);
      }
    }
    if (Object.getPrototypeOf(record.props) !== Object.prototype) {
      out.push(`${record.id}: props have a foreign prototype`);
    }
    walk(record.props, record.id, (key, value, path) => {
      if (FORBIDDEN_KEY.test(key)) out.push(`${path}: forbidden key painted`);
      if (typeof value === 'string' && URL_KEY.test(key)) {
        if (UNSAFE_URL.test(value) || value.trim().startsWith('//')) {
          out.push(`${path}: unsafe URL painted (${value})`);
        }
      }
      if (value !== null && typeof value === 'object' && Object.hasOwn(value, '$state')) {
        out.push(`${path}: unresolved binding painted`);
      }
      // Trust is the host's: no painted node may claim more than untrusted.
      if (key === 'trust' && value !== 'untrusted')
        out.push(`${path}: trust widened to ${String(value)}`);
      if (key === 'autoplay' && value === true) out.push(`${path}: autoplay painted`);
    });
  }
  for (const element of container.querySelectorAll('*')) {
    if (/^(script|iframe|object|embed|img|svg)$/i.test(element.tagName)) {
      out.push(`DOM: <${element.tagName.toLowerCase()}> element created`);
    }
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.name)) out.push(`DOM: ${attribute.name} attribute`);
      if (/^(href|src|srcdoc|action|formaction)$/i.test(attribute.name)) {
        if (attribute.name === 'srcdoc' || UNSAFE_URL.test(attribute.value)) {
          out.push(`DOM: unsafe ${attribute.name}=${attribute.value}`);
        }
      }
    }
  }
  return out;
}

async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    await tick();
  }
}

// ── Entry paths ─────────────────────────────────────────────────

type Path = (tree: unknown) => Promise<{ container: Element; dispose: () => void }>;

function wrapper(tree: unknown) {
  return { format: LOCAL_STATE_FORMAT, version: 1, state: {}, blueprint: tree };
}

function envelope(tree: unknown) {
  return createEnvelope({
    id: 'audit-envelope',
    catalog: 'a'.repeat(64),
    generator: { kind: 'agent', name: 'Fictional agent' },
    tree: tree as Parameters<typeof createEnvelope>[0]['tree'],
    at: '2026-10-25T09:00:00Z',
  });
}

function fakeWindow(parent?: unknown) {
  const target = new EventTarget() as EventTarget & { postMessage: () => void; parent: unknown };
  target.postMessage = () => {};
  target.parent = parent ?? target;
  return target;
}

function renderPlayer(props: { blueprint: unknown } & Record<string, unknown>) {
  const { container, unmount } = render(Player, {
    props: { loaders, ...props } as ComponentProps<typeof Player>,
  });
  return { container, dispose: unmount };
}

/** Reset between corpus items inside one test: no stale probe records or DOM. */
function reset() {
  probeLog.length = 0;
  document.body.innerHTML = '';
}

const PATHS: ReadonlyArray<[string, Path]> = [
  ['object', async (tree) => renderPlayer({ blueprint: tree })],
  ['JSON text', async (tree) => renderPlayer({ blueprint: JSON.stringify(tree) })],
  ['developer tier', async (tree) => renderPlayer({ blueprint: tree, tier: 'developer' })],
  ['invalid preview', async (tree) => renderPlayer({ blueprint: tree, invalidPolicy: 'preview' })],
  [
    'envelope',
    async (tree) => renderPlayer({ blueprint: envelope(tree), invalidPolicy: 'preview' }),
  ],
  [
    'envelope in state wrapper',
    async (tree) => renderPlayer({ blueprint: wrapper(envelope(tree)), invalidPolicy: 'preview' }),
  ],
  ['state wrapper', async (tree) => renderPlayer({ blueprint: wrapper(tree) })],
  [
    'state wrapper text',
    async (tree) =>
      renderPlayer({ blueprint: JSON.stringify(wrapper(tree)), invalidPolicy: 'preview' }),
  ],
  [
    'mountPlayer update()',
    async (tree) => {
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayer(target, {
        blueprint: page([]),
        loaders,
        invalidPolicy: 'preview',
      });
      await settle();
      mounted.update({ blueprint: tree });
      return { container: target, dispose: () => mounted.dispose() };
    },
  ],
  [
    'frame protocol',
    async (tree) => {
      const parent = fakeWindow();
      const win = fakeWindow(parent);
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayerFrame(target, {
        parentOrigins: ['https://host.example'],
        window: win as unknown as Window,
        loaders,
      });
      const event = new MessageEvent('message', {
        origin: 'https://host.example',
        data: {
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'init',
          blueprint: tree,
          options: { invalidPolicy: 'preview', tier: 'developer' },
        },
      });
      Object.defineProperty(event, 'source', { value: parent });
      win.dispatchEvent(event);
      return { container: target, dispose: () => mounted.dispose() };
    },
  ],
];

describe('untrusted at paint: every entry path', () => {
  // One test per entry path; every hostile tree is asserted inside it.
  for (const [pathName, enter] of PATHS) {
    it(`${pathName}: no hostile tree paints anything unsafe`, async () => {
      for (const [name, tree] of HOSTILE_TREES) {
        reset();
        const { container, dispose } = await enter(tree);
        await settle();
        expect(violations(container), `${pathName}: ${name}`).toEqual([]);
        dispose();
      }
    });
  }

  it('the audit detects an unsafe paint (the probe and checks are live)', async () => {
    // A host loader that bypasses nothing still records props: prove the
    // checker flags a violation when one is planted directly.
    probeLog.push({ id: 'planted', props: { href: 'javascript:alert(1)', onclick: 'x' } });
    expect(violations(document.body).length).toBeGreaterThan(0);
    probeLog.length = 0;
    const { container } = render(Player, {
      props: {
        blueprint: page([
          { id: 'media-image', props: { src: 'https://images.example/a.png', alt: 'Ok' } },
        ]),
        loaders,
      },
    });
    await settle();
    expect(probeLog.some((record) => record.props.src === 'https://images.example/a.png')).toBe(
      true
    );
    expect(violations(container)).toEqual([]);
  });
});

// ── Player-owned layout painters, painted for real ─────────────

const LAYOUT_TREES: ReadonlyArray<[string, unknown]> = [
  [
    'G20 layouts with out-of-range spans',
    page([
      {
        id: 'layout-stack',
        props: { gap: 'large' },
        children: [
          {
            id: 'layout-row',
            props: { align: 'end' },
            children: [{ id: 'layout-card', props: { title: 'R' } }],
          },
        ],
      },
      {
        id: 'layout-split',
        props: { ratio: '3:1' },
        children: [{ id: 'layout-card', props: { title: 'L' } }],
      },
      {
        id: 'layout-grid',
        props: { columns: 3 },
        children: [
          { id: 'layout-tile', props: { title: 'Wide', span: 1e9, rowSpan: 99 } },
          { id: 'layout-tile', props: { title: 'Thin', span: -4, rowSpan: 0 } },
        ],
      },
    ]),
  ],
  [
    'deck with hostile locale, slide id and notes',
    {
      id: 'layout-deck',
      props: { title: 'Deck', locale: 'not a tag' },
      children: [
        {
          id: 'deck-slide',
          props: { slideId: 'x" id="clobber', title: 'Slide', notes: 'Plain notes' },
        },
      ],
    },
  ],
  [
    'doc contents from hostile titles',
    {
      id: 'layout-doc',
      props: { title: 'Doc' },
      children: [
        { id: 'layout-card', props: { title: '#javascript:alert(1)' } },
        { id: 'layout-card', props: { title: '"><a href=javascript:alert(1)>x</a>' } },
        { id: 'layout-card', props: { title: 'Plain' } },
      ],
    },
  ],
  ...[
    '1rem; background:url(javascript:alert(1))',
    '1rem}</style><script>',
    'calc(100vw)',
    '2rem',
  ].map((gap): [string, unknown] => [
    `grid gap ${JSON.stringify(gap)}`,
    page([
      {
        id: 'layout-grid',
        props: { columns: -5, gap },
        children: [{ id: 'layout-card', props: { title: 'A' } }],
      },
    ]),
  ]),
];

const LAYOUT_PATHS: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['untrusted', {}],
  ['developer tier', { tier: 'developer' }],
  ['invalid preview', { invalidPolicy: 'preview' }],
];

describe('untrusted at paint: player-owned layout painters', () => {
  const real = async () => (await import('../src/layouts/ContentLayout.svelte')).default;
  const SAFE_STYLE =
    /^(--tx-player-columns: [1-4](; --tx-player-gap: (0|\d{1,2}(\.\d{1,2})?(rem|em)|\d{1,3}px))?|--tx-player-span: [1-4]; --tx-player-row-span: [12]);?$/;

  const layoutLoaders = Object.fromEntries(
    [
      'layout-page',
      'layout-doc',
      'layout-card',
      'layout-grid',
      'layout-deck',
      'deck-slide',
      'layout-stack',
      'layout-row',
      'layout-split',
      'layout-tile',
    ].map((id) => [id, real])
  );

  for (const [pathName, extra] of LAYOUT_PATHS) {
    it(`${pathName}: every layout tree writes only guarded attributes`, async () => {
      for (const [name, tree] of LAYOUT_TREES) {
        reset();
        const at = `${pathName}: ${name}`;
        const { container, unmount } = render(Player, {
          props: { blueprint: tree, loaders: { ...loaders, ...layoutLoaders }, ...extra },
        });
        await settle();
        await settle();
        expect(violations(container), at).toEqual([]);
        for (const element of container.querySelectorAll('[style]')) {
          expect(element.getAttribute('style'), at).toMatch(SAFE_STYLE);
        }
        for (const element of container.querySelectorAll('[lang]')) {
          expect(element.getAttribute('lang'), at).toMatch(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/);
        }
        // Ids and in-page links are player-generated, never blueprint text.
        for (const element of container.querySelectorAll('[id]')) {
          expect(element.id, at).toMatch(/^[A-Za-z0-9_-]+$/);
        }
        for (const link of container.querySelectorAll('a[href]')) {
          const href = link.getAttribute('href') ?? '';
          if (link.classList.contains('tx-player__skip')) continue;
          expect(href, at).toMatch(/^#[A-Za-z0-9_-]+$/);
          expect(container.querySelector(`[id="${href.slice(1)}"]`), at).not.toBeNull();
        }
        unmount();
      }
    });
  }
});

describe('untrusted at paint: the layout audit paints real frames', () => {
  it('a hostile-but-valid deck and grid still paint their frames (the audit is live)', async () => {
    const real = async () => (await import('../src/layouts/ContentLayout.svelte')).default;
    const { container } = render(Player, {
      props: {
        blueprint: LAYOUT_TREES.find(([name]) => name.startsWith('deck with'))?.[1],
        loaders: { 'layout-deck': real, 'deck-slide': real },
      },
    });
    await settle();
    await settle();
    expect(container.querySelector('article.tx-player-layout--deck')).not.toBeNull();
    expect(container.querySelector('section.tx-player-layout--slide')).not.toBeNull();
    expect(container.querySelector('[id*="clobber"]')).toBeNull();
  });
});

// ── Local state smuggling (generalizes the HTML-string test) ───

function bound(type: 'string' | 'enum', initial: string) {
  return {
    format: LOCAL_STATE_FORMAT,
    version: 1,
    state:
      type === 'string'
        ? { v: { type: 'string', maxLength: 1000, initial } }
        : {
            v: {
              type: 'enum',
              values: [initial.slice(0, 64), 'ok'],
              initial: initial.slice(0, 64),
            },
          },
    blueprint: page(
      [
        { id: 'media-image', props: { src: { $state: 'v' }, alt: { $state: 'v' } } },
        { id: 'layout-card', props: { title: { $state: 'v' } } },
      ],
      { title: { $state: 'v' }, description: { $state: 'v' } }
    ),
  };
}

/** The same bound props as `bound`, but the variable is host-bound (host G01). */
function hostBound() {
  return {
    format: LOCAL_STATE_FORMAT,
    version: 1,
    state: { v: { type: 'string', maxLength: 1000, initial: 'ok', source: 'feed.value' } },
    blueprint: page(
      [
        { id: 'media-image', props: { src: { $state: 'v' }, alt: { $state: 'v' } } },
        { id: 'layout-card', props: { title: { $state: 'v' } } },
      ],
      { title: { $state: 'v' }, description: { $state: 'v' } }
    ),
  };
}

describe('untrusted at paint: host data cannot smuggle', () => {
  it('no hostile dataSources value paints anything unsafe in any bound prop', async () => {
    for (const value of HOSTILE_STRINGS) {
      reset();
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayer(target, {
        blueprint: hostBound(),
        loaders,
        dataSources: { 'feed.value': 'ok' },
      });
      await settle();
      mounted.update({ dataSources: { 'feed.value': value } });
      await settle();
      expect(violations(target), value).toEqual([]);
      mounted.dispose();
    }
  });

  it('no hostile frame data message paints anything unsafe', async () => {
    for (const value of HOSTILE_STRINGS) {
      reset();
      const parent = fakeWindow();
      const win = fakeWindow(parent);
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayerFrame(target, {
        parentOrigins: ['https://host.example'],
        window: win as unknown as Window,
        loaders,
      });
      const send = (data: unknown) => {
        const event = new MessageEvent('message', { origin: 'https://host.example', data });
        Object.defineProperty(event, 'source', { value: parent });
        win.dispatchEvent(event);
      };
      send({ protocol: PLAYER_FRAME_PROTOCOL, type: 'init', blueprint: hostBound(), options: {} });
      await settle();
      send({ protocol: PLAYER_FRAME_PROTOCOL, type: 'data', sources: { 'feed.value': value } });
      await settle();
      expect(violations(target), value).toEqual([]);
      mounted.dispose();
    }
  });
});

describe('untrusted at paint: local state cannot smuggle', () => {
  it('no hostile setState value paints anything unsafe in any bound prop', async () => {
    for (const value of HOSTILE_STRINGS) {
      reset();
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayer(target, { blueprint: bound('string', 'ok'), loaders });
      await settle();
      expect(mounted.setState('v', value), value).toBe(true);
      await settle();
      expect(violations(target), value).toEqual([]);
      mounted.dispose();
    }
  });

  it('no hostile initialState, declared initial or enum value paints anything unsafe', async () => {
    for (const value of HOSTILE_STRINGS) {
      reset();
      const initial = render(Player, {
        props: { blueprint: bound('string', 'ok'), loaders, initialState: { v: value } },
      });
      await settle();
      expect(violations(initial.container), `initialState ${value}`).toEqual([]);
      initial.unmount();
      for (const type of ['string', 'enum'] as const) {
        reset();
        const { container, unmount } = render(Player, {
          props: { blueprint: bound(type, value), loaders, invalidPolicy: 'preview' },
        });
        await settle();
        expect(violations(container), `${type} ${value}`).toEqual([]);
        unmount();
      }
    }
  });

  it('wrong-kind values and values outside the declaration never reach a prop', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, { blueprint: bound('string', 'ok'), loaders });
    await settle();
    for (const value of [
      { $state: 'v' },
      ['javascript:alert(1)'],
      { toString: 'x' },
      7,
      true,
      null,
    ]) {
      expect(mounted.setState('v', value)).toBe(false);
    }
    expect(mounted.setState('v', 'x'.repeat(1001))).toBe(false);
    expect(mounted.getState().v).toBe('ok');
    mounted.dispose();
  });

  it('bindings never rewrite ids or structure', async () => {
    const blueprint = {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state: { v: { type: 'string', initial: 'layout-card' } },
      blueprint: page([{ id: { $state: 'v' }, props: {} }, { $state: 'v' }]),
    };
    const { container } = render(Player, { props: { blueprint, loaders } });
    await settle();
    expect(probeLog.some((record) => record.id === 'layout-card')).toBe(false);
    expect(violations(container)).toEqual([]);
  });

  it('keeps a parsed "__proto__" prop key as own data for the renderer to refuse', () => {
    const tree = fromJson(
      '{"id":"layout-page","props":{"title":{"$state":"v"},"__proto__":{"href":"javascript:alert(1)"}}}'
    );
    const { blueprint } = resolveStateBindings(tree, { v: 'Title' });
    const props = (blueprint as { props: Record<string, unknown> }).props;
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(Object.hasOwn(props, '__proto__')).toBe(true);
    expect(props.title).toBe('Title');
  });
});

// ── No HTML sinks in the player source ──────────────────────────

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : [full];
  });
}

describe('player source has no HTML or code sinks', () => {
  it('uses no {@html}, innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or new Function', () => {
    // Vitest runs from the repository root.
    const root = join(process.cwd(), 'packages/player/src');
    const sinks =
      /\{@html|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\b|srcdoc/;
    const offenders = sourceFiles(root)
      .filter((file) => /\.(ts|svelte)$/.test(file))
      .filter((file) => sinks.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
