/// <reference types="node" />
/**
 * The design-system runtime (ADR-023, T-ds-runtime): `applyDesignSystem`
 * writes a compiled variable map on one element in one style write, with the
 * allowlisted attributes and the scope marker, registers fonts lazily and
 * restores the element on dispose; `designSystemStyle` is the same
 * declarations as a CSS string for SSR; the no-flash replay of
 * `designSystemAppearance` produces the same computed variables.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ApplicableDesignSystem,
  applyDesignSystem,
  designSystemAppearance,
  designSystemDeclarations,
  designSystemStyle,
  isSafeDesignSystemValue,
} from '../src/design-system/apply.ts';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  DESIGN_SYSTEM_ATTRIBUTES,
  resolveDesignSystem,
} from '../src/design-system/compile.ts';
import { cacheAppearance, noFlashScript } from '../src/no-flash/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const tokensSrc = join(root, 'packages/tokens/src');
type Doc = Record<string, unknown>;
const json = (path: string): Doc => JSON.parse(readFileSync(join(root, path), 'utf8'));
const acmeDoc = json('packages/spec/fixtures/design-systems/acme.json');
const minimalDoc = json('packages/spec/fixtures/design-systems/minimal.json');

async function compiled(doc: Doc, variant?: string): Promise<CompiledDesignSystem> {
  const resolved = await resolveDesignSystem(doc, {
    trust: 'developer',
    ...(variant ? { variant } : {}),
  });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const result = compileDesignSystem(resolved.document, {
    trust: 'developer',
    modes: ['light', 'dark'],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

const acme = await compiled(acmeDoc);
const minimal = await compiled(minimalDoc);

/** Every `--tx-*` custom property of a declaration block, by name. */
function inlineVars(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    if (name.startsWith('--tx-')) out[name] = el.style.getPropertyValue(name);
  }
  return out;
}

/** Every inline declaration (name, value, priority), sorted: order in a block has no effect. */
function declarations(el: HTMLElement): string[] {
  return Array.from(
    { length: el.style.length },
    (_, i) =>
      `${el.style.item(i)}:${el.style.getPropertyValue(el.style.item(i))}:${el.style.getPropertyPriority(el.style.item(i))}`
  ).sort();
}

function computedVars(el: Element, names: readonly string[]): Record<string, string> {
  const style = getComputedStyle(el);
  return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
}

/** Count the `style` attribute mutations one action causes. */
async function styleWrites(el: HTMLElement, action: () => void): Promise<number> {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(el, { attributes: true, attributeFilter: ['style'] });
  action();
  records.push(...observer.takeRecords());
  observer.disconnect();
  return records.length;
}

function host(): HTMLElement {
  const el = document.createElement('section');
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('applyDesignSystem', () => {
  it('writes the whole variable map in one style write, with the allowlisted attributes and the scope', async () => {
    for (const [system, mode] of [
      [acme, 'light'],
      [acme, 'dark'],
      [minimal, 'light'],
      [minimal, 'dark'],
    ] as const) {
      const el = host();
      el.style.setProperty('color', 'red');
      el.style.setProperty('--tx-host-only', '3px');
      const writes = await styleWrites(el, () => {
        applyDesignSystem(el, system, { mode, fonts: false });
      });
      expect(writes, `${system.id} ${mode}`).toBe(1);
      const expected = Object.fromEntries(designSystemDeclarations(system.vars[mode] ?? {}));
      expect(Object.keys(expected).length).toBe(Object.keys(system.vars[mode] ?? {}).length);
      expect(inlineVars(el)).toEqual({ ...expected, '--tx-host-only': '3px' });
      expect(el.style.getPropertyValue('color')).toBe('red');
      expect(el.getAttribute('data-tx-scope')).toBe('');
      expect(el.getAttribute('data-tx-mode')).toBe(mode);
      for (const name of DESIGN_SYSTEM_ATTRIBUTES) {
        expect(el.getAttribute(name), name).toBe(system.attrs[name] ?? null);
      }
    }
  });

  it('switches mode and design system in one write each, and dispose restores the element exactly', async () => {
    const el = host();
    el.setAttribute('data-tx-scope', 'preview');
    el.setAttribute('data-tx-surface', 'host');
    el.style.setProperty('--tx-background', 'rebeccapurple');
    el.style.setProperty('margin-inline', '4px');
    const before = declarations(el);
    const attrsBefore = Array.from(el.attributes, (a) => [a.name, a.value]).filter(
      ([name]) => name !== 'style'
    );

    const first = applyDesignSystem(el, acme, { mode: 'light', fonts: false });
    expect(el.getAttribute('data-tx-scope')).toBe('preview');
    const steps = [
      [acme, 'dark'],
      [minimal, 'light'],
      [acme, 'light'],
      [minimal, 'dark'],
    ] as const;
    let last = first;
    for (const [system, mode] of steps) {
      let dispose = last;
      expect(
        await styleWrites(el, () => {
          dispose = applyDesignSystem(el, system, { mode, fonts: false });
        }),
        `${system.id} ${mode}`
      ).toBe(1);
      last = dispose;
      const expected = Object.fromEntries(designSystemDeclarations(system.vars[mode] ?? {}));
      // Exactly this map: nothing left over from the previous design system.
      expect(inlineVars(el)).toEqual(expected);
      expect(el.getAttribute('data-tx-mode')).toBe(mode);
      expect(el.getAttribute('data-tx-ds')).toBe(system.id);
    }
    // A superseded dispose does nothing; the current one restores the original.
    first();
    expect(el.getAttribute('data-tx-ds')).toBe(minimal.id);
    expect(await styleWrites(el, last)).toBe(1);
    expect(declarations(el)).toEqual(before);
    expect(
      Array.from(el.attributes, (a) => [a.name, a.value]).filter(([name]) => name !== 'style')
    ).toEqual(attrsBefore);
    last();
    expect(declarations(el)).toEqual(before);
  });

  it('refuses unsafe names, values and attributes from a tampered compiled design system', () => {
    const hostile: ApplicableDesignSystem = {
      id: 'evil',
      variant: undefined,
      vars: {
        light: {
          '--tx-ok': '#ffffff',
          '--tx-semi': 'red;color:blue',
          '--tx-brace': 'a}b{c',
          '--tx-angle': '</style><script>x()</script>',
          '--tx-url': 'url(https://evil.example/p.png)',
          '--tx-var': 'var(--tx-ok)',
          '--tx-import': '@import "x"',
          '--tx-quote': '"Acme Sans',
          '--tx-paren': 'calc(1px',
          '--tx-bang': 'red !important',
          '--tx-comment': 'red /* x */',
          '--tx-escape': '\\3b',
          '--tx-newline': 'a\nb',
          '--tx-bidi': `a${String.fromCharCode(0x202e)}b`,
          '--tx-long': 'x'.repeat(2049),
          '--tx-UPPER': 'red',
          ['color' as `--tx-${string}`]: 'red',
          '--tx-font-sans': '"Acme Sans", system-ui',
        },
      },
      // Names outside the allowlist, as a tampered JSON copy could carry them.
      attrs: {
        'data-tx-ds': 'evil',
        onclick: 'alert(1)',
        style: 'color: red',
        'data-tx-surface': 'x'.repeat(300),
      } as ApplicableDesignSystem['attrs'],
      fontFaces: [],
      defaults: {},
    };
    const kept = Object.fromEntries(designSystemDeclarations(hostile.vars.light ?? {}));
    expect(kept).toEqual({ '--tx-font-sans': '"Acme Sans", system-ui', '--tx-ok': '#ffffff' });
    for (const [name, value] of Object.entries(hostile.vars.light ?? {})) {
      // `--tx-UPPER` and `color` hold a safe value under a refused name.
      const safe = name in kept || value === 'red';
      expect(isSafeDesignSystemValue(value), name).toBe(safe);
    }
    const el = host();
    applyDesignSystem(el, hostile, { mode: 'light', fonts: false });
    expect(inlineVars(el)).toEqual(kept);
    expect(el.hasAttribute('onclick')).toBe(false);
    expect(el.getAttribute('style')).not.toMatch(/color:\s*(red|blue)/);
    expect(el.hasAttribute('data-tx-surface')).toBe(false);
    const css = designSystemStyle(hostile, { selector: '.x' });
    expect(css).toBe('.x{--tx-font-sans:"Acme Sans", system-ui;--tx-ok:#ffffff}');
    // A mode that was not compiled, a variant that does not match, and a bad element are errors.
    expect(() => applyDesignSystem(el, minimal, { mode: 'dim' as 'dark' })).toThrow(TypeError);
    expect(() =>
      applyDesignSystem(el, { ...acme, variant: 'compact' }, { mode: 'light', variant: 'holiday' })
    ).toThrow(/variant/);
    expect(() =>
      applyDesignSystem(null as unknown as HTMLElement, acme, { mode: 'light' })
    ).toThrow(TypeError);
  });

  it('registers font faces lazily on first use, same-origin relative paths and data URLs only', () => {
    const added: { family: string; source: string; descriptors: FontFaceDescriptors }[] = [];
    class FakeFontFace {
      constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
        added.push({ family, source, descriptors });
      }
    }
    const fonts = { add: vi.fn() };
    vi.stubGlobal('FontFace', FakeFontFace);
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    const face = (src: string) => ({
      family: 'Acme Sans',
      src,
      format: 'woff2' as const,
      weight: '100 900',
      style: 'normal' as const,
      display: 'swap' as const,
      inline: src.startsWith('data:'),
    });
    const system: ApplicableDesignSystem = {
      ...acme,
      fontFaces: [
        face('fonts/acme-sans.woff2'),
        face('/fonts/acme-bold.woff2'),
        face('data:font/woff2;base64,AAAA'),
        face('https://evil.example/x.woff2'),
        face('//evil.example/x.woff2'),
        face('../secret.woff2'),
        face('fonts/x.woff2?y=1'),
        face('javascript:alert(1)'),
        face('data:text/html;base64,AAAA'),
        face('fonts/a.woff2") , url("x'),
        { ...face('fonts/acme-sans.woff2'), weight: '400;x' },
        { ...face('fonts/acme-sans.woff2'), family: 'Acme\u0000' },
      ],
    };
    expect(added).toEqual([]);
    const el = host();
    applyDesignSystem(el, system, { mode: 'light', base: 'https://app.example/studio/' });
    expect(added.map((entry) => entry.source)).toEqual([
      'url("https://app.example/studio/fonts/acme-sans.woff2") format("woff2")',
      'url("https://app.example/fonts/acme-bold.woff2") format("woff2")',
      'url("data:font/woff2;base64,AAAA") format("woff2")',
    ]);
    expect(added[0]).toMatchObject({
      family: 'Acme Sans',
      descriptors: { weight: '100 900', style: 'normal', display: 'swap' },
    });
    expect(fonts.add).toHaveBeenCalledTimes(3);
    // Switching back and forth registers nothing twice.
    applyDesignSystem(el, minimal, { mode: 'dark', base: 'https://app.example/studio/' });
    applyDesignSystem(host(), system, { mode: 'dark', base: 'https://app.example/studio/' });
    expect(fonts.add).toHaveBeenCalledTimes(3);
    Reflect.deleteProperty(document, 'fonts');
  });

  it('hands the component defaults to the host and clears them on dispose', () => {
    const seen: unknown[] = [];
    const system = { ...acme, defaults: { button: { variant: 'outline', size: 'sm' } } };
    const dispose = applyDesignSystem(host(), system, {
      mode: 'light',
      fonts: false,
      defaults: (defaults) => seen.push(defaults),
    });
    expect(seen).toEqual([{ button: { variant: 'outline', size: 'sm' } }]);
    dispose();
    expect(seen).toEqual([{ button: { variant: 'outline', size: 'sm' } }, {}]);
  });
});

describe('designSystemStyle', () => {
  it('is the same declarations as apply, for a selector and the dark rule, escaped by construction', () => {
    const light = designSystemDeclarations(acme.vars.light ?? {});
    const dark = designSystemDeclarations(acme.vars.dark ?? {});
    const body = (list: [string, string][]) => list.map(([n, v]) => `${n}:${v}`).join(';');
    expect(designSystemStyle(acme)).toBe(
      `[data-tx-ds="acme"]{${body(light)}}\n` +
        `:is([data-tx-ds="acme"])[data-tx-mode="dark"],[data-tx-mode="dark"] :is([data-tx-ds="acme"]):not([data-tx-mode="light"]){${body(dark)}}`
    );
    expect(designSystemStyle(acme, { selector: ':root', modes: ['dark'] })).toBe(
      `:root{${body(dark)}}`
    );
    expect(designSystemStyle(acme, { selector: '#a', modes: ['light'] })).toBe(
      `#a{${body(light)}}`
    );
    expect(designSystemStyle(acme)).toBe(designSystemStyle(structuredClone(acme)));
    for (const selector of [
      '',
      ' ',
      '.a{}',
      '.a;',
      '</style>',
      '.a/*',
      '@media x',
      '.a\\',
      '.a\n.b',
    ]) {
      expect(() => designSystemStyle(acme, { selector }), JSON.stringify(selector)).toThrow(
        TypeError
      );
    }
    expect(() => designSystemStyle({ ...acme, id: 'a"]{}' })).toThrow(TypeError);
    expect(() => designSystemStyle(acme, { modes: ['dim' as 'dark'] })).toThrow(TypeError);
    expect(designSystemStyle(acme)).not.toMatch(/<|>|url\(|var\(/);
  });

  it('SSR, apply and the no-flash replay give byte-identical computed variables', () => {
    for (const system of [acme, minimal]) {
      for (const mode of ['light', 'dark'] as const) {
        const names = designSystemDeclarations(system.vars[mode] ?? {}).map(([name]) => name);
        const expected = Object.fromEntries(designSystemDeclarations(system.vars[mode] ?? {}));

        // 1. Server: the style string in <head>, the scope element in the HTML.
        const style = document.createElement('style');
        style.textContent = designSystemStyle(system);
        document.head.append(style);
        const server = document.createElement('div');
        server.setAttribute('data-tx-ds', system.id);
        server.setAttribute('data-tx-mode', mode);
        document.body.append(server);
        const fromServer = computedVars(server, names);
        style.remove();

        // 2. Client: applyDesignSystem on a plain element.
        const client = host();
        applyDesignSystem(client, system, { mode, fonts: false });
        const fromClient = computedVars(client, names);

        // 3. No flash: the cached appearance replayed by the inline script.
        const store = new Map<string, string>();
        const storage = {
          setItem: (key: string, value: string) => store.set(key, value),
          getItem: (key: string) => store.get(key) ?? null,
        };
        expect(cacheAppearance('ds', designSystemAppearance(system, { mode }), storage)).toBe(true);
        const replayed = host();
        new Function('document', 'localStorage', 'matchMedia', noFlashScript('ds'))(
          { documentElement: replayed },
          storage,
          () => ({ matches: false })
        );
        const fromReplay = computedVars(replayed, names);

        expect(fromServer, `${system.id} ${mode} server`).toEqual(expected);
        expect(JSON.stringify(fromClient), `${system.id} ${mode} client`).toBe(
          JSON.stringify(fromServer)
        );
        expect(JSON.stringify(fromReplay), `${system.id} ${mode} replay`).toBe(
          JSON.stringify(fromServer)
        );
        // Nothing the compiler emits is dropped by the runtime filter.
        expect(names.length).toBe(Object.keys(system.vars[mode] ?? {}).length);
        document.body.replaceChildren();
      }
    }
  });
});

describe('laziness: design-system/apply', () => {
  it('stays out of the @texuli/tokens root and never reaches the compiler or the color engine', () => {
    const graph = (entry: string) => {
      const seen = new Set<string>();
      const visit = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)) {
          const spec = match[1] as string;
          if (/^(?:import|export) type\b/.test(match[0])) continue;
          expect(spec.startsWith('.'), `${relative(tokensSrc, file)} imports ${spec}`).toBe(true);
          visit(join(dirname(file), spec));
        }
      };
      visit(join(tokensSrc, entry));
      return [...seen].map((file) => relative(tokensSrc, file));
    };
    expect(graph('design-system/apply.ts').sort()).toEqual([
      'design-system/apply.ts',
      'design-system/attributes.ts',
    ]);
    expect(graph('index.ts').filter((file) => file.includes('design-system/'))).toEqual([]);
  });
});
