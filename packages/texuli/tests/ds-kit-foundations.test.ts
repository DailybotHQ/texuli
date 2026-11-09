/// <reference types="node" />
/**
 * `texuli/ds-kit` foundations and shell (T-t4-foundations, ADR-032, kit API
 * `decisions/kit-api.md` §5.1 and §11): every token group of a compiled example brand in
 * light and dark, values as text and through the runtime's value filter only, the approval
 * header with its content-hash check, controlled and uncontrolled navigation with stable
 * deep-link ids, the mode switch, and no HTML sinks.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  resolveDesignSystem,
} from '@texuli/tokens/design-system/compile';
import type { DesignSystem } from '@texuli/tokens/design-system/validate';
import { tick } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DesignSystemKit,
  FOUNDATION_GROUPS,
  foundationItems,
  foundationsModel,
  KIT_SECTIONS,
  type KitCatalog,
  KitFoundations,
  kitApproval,
  kitContentHash,
  kitItemId,
  kitVisibleSections,
} from '../src/ds-kit/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const KIT = join(ROOT, 'packages/texuli/src/ds-kit');
const json = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;

let doc: DesignSystem;
let compiled: CompiledDesignSystem;

beforeAll(async () => {
  doc = json<DesignSystem>('examples/design-systems/ledgerline.json');
  const resolved = await resolveDesignSystem(doc, { trust: 'developer' });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const result = compileDesignSystem(resolved.document);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  compiled = result;
});

afterEach(() => cleanup());

/** An independent reading of the ADR-032 hash rule (Node's SHA-256, its own canonical JSON). */
function referenceHash(value: unknown): string {
  const canonical = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    const record = v as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`)
      .join(',')}}`;
  };
  const strip = (v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    const { approval: _approval, ...rest } = v as Record<string, unknown>;
    return rest;
  };
  const view = strip(value) as Record<string, unknown>;
  const library = (value as { library?: unknown[] }).library;
  if (Array.isArray(library)) view.library = library.map(strip);
  return createHash('sha256').update(canonical(view), 'utf8').digest('hex');
}

describe('foundations model', () => {
  it('sorts every compiled token into a group, once, in both modes', () => {
    const model = foundationsModel(compiled);
    expect(model.modes).toEqual(['light', 'dark']);
    // Every group a designer reads, from a real brand.
    expect(model.groups.map((g) => g.id)).toEqual(FOUNDATION_GROUPS.map((g) => g.id));
    const names = model.groups.flatMap((g) => g.tokens.map((t) => t.name));
    expect(new Set(names).size).toBe(names.length);
    const compiledNames = new Set([
      ...Object.keys(compiled.vars.light ?? {}),
      ...Object.keys(compiled.vars.dark ?? {}),
    ]);
    expect(names.length).toBe(compiledNames.size);
    expect(model.clipped).toBe(0);
    const group = (id: string) => model.groups.find((g) => g.id === id)?.tokens ?? [];
    const token = (id: string, name: string) => group(id).find((t) => t.name === name);
    expect(token('color', '--tx-primary')?.values).toEqual({
      light: compiled.vars.light?.['--tx-primary'],
      dark: compiled.vars.dark?.['--tx-primary'],
    });
    expect(token('data-viz', '--tx-chart-1')).toBeDefined();
    expect(token('typography', '--tx-type-body-size')).toBeDefined();
    expect(token('spacing', '--tx-space-4')).toBeDefined();
    expect(token('radius', '--tx-shape-radius-md')).toBeDefined();
    expect(token('elevation', '--tx-elevation-2')).toBeDefined();
    expect(token('motion', '--tx-motion-base')).toBeDefined();
    expect(token('other', '--tx-z-modal')).toBeDefined();
    // Natural order: space-2 before space-10.
    const spaces = group('spacing').map((t) => t.name);
    expect(spaces.indexOf('--tx-space-2')).toBeLessThan(spaces.indexOf('--tx-space-10'));
    expect(model.typeRoles.map((r) => r.role)).toEqual(
      expect.arrayContaining(['body', 'heading', 'display', 'code'])
    );
    expect(model.contrast.light?.length).toBeGreaterThan(0);
    expect(model.contrast.dark?.length).toBeGreaterThan(0);
    expect(foundationItems(model).map((i) => i.id)).toEqual([
      ...FOUNDATION_GROUPS.map((g) => g.id),
      'contrast',
    ]);
  });

  it('drops values that could leave a declaration and never throws on malformed input', () => {
    const hostile = {
      ...compiled,
      vars: {
        light: {
          '--tx-primary': 'red;background:url(https://example.com/x)',
          '--tx-ok': '#123456',
          'color: red; --tx-x': '#000000',
          '--tx-space-1': '}body{display:none',
        },
      },
      assets: { logo: { light: 'javascript:alert(1)', dark: 'https://example.com/logo.svg' } },
    } as unknown as CompiledDesignSystem;
    const model = foundationsModel(hostile);
    const tokens = model.groups.flatMap((g) => g.tokens.map((t) => t.name));
    expect(tokens).toEqual(['--tx-ok']);
    for (const bad of [undefined, null, 'x', 42, [], { vars: 'x' }, { vars: { light: null } }])
      expect(() => foundationsModel(bad as never)).not.toThrow();
    expect(foundationsModel(undefined).groups).toEqual([]);
  });
});

describe('KitFoundations', () => {
  it('renders every token group, in light and dark, with values as text', () => {
    const { container } = render(KitFoundations, { compiled });
    const model = foundationsModel(compiled);
    for (const group of model.groups) {
      const section = container.querySelector(`[data-tx-ds-kit-group="${group.id}"]`);
      expect(section, group.id).not.toBeNull();
      expect(section?.id).toBe(kitItemId('tx-ds-kit', 'foundations', group.id));
      expect(section?.querySelectorAll('tbody tr').length, group.id).toBe(group.tokens.length);
      expect(section?.querySelectorAll('thead th').length).toBe(3);
    }
    const primary = container.querySelector('[data-tx-ds-kit-token="--tx-primary"]');
    const [light, dark] = primary?.querySelectorAll('td') ?? [];
    expect(light?.textContent).toContain(compiled.vars.light?.['--tx-primary']);
    expect(dark?.textContent).toContain(compiled.vars.dark?.['--tx-primary']);
    const swatch = light?.querySelector<HTMLElement>('.tx-ds-kit__swatch');
    expect(swatch?.style.backgroundColor).not.toBe('');
    expect(container.querySelector('[data-tx-ds-kit-group="contrast"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-tx-ds-kit-type-role]').length).toBeGreaterThan(3);
    // Scrollable tables are reachable from the keyboard.
    for (const wrap of container.querySelectorAll('.tx-ds-kit__table-wrap'))
      expect(wrap.getAttribute('tabindex')).toBe('0');
  });

  it('shows one mode when asked', () => {
    const { container } = render(KitFoundations, { compiled, modeView: 'dark' });
    const head = container.querySelector('[data-tx-ds-kit-group="color"] thead');
    expect(head?.textContent).toContain('Dark');
    expect(head?.textContent).not.toContain('Light');
    expect(container.querySelector('[data-tx-mode-cell="light"]')).toBeNull();
  });

  it('refuses an unsafe logo and keeps a safe one', () => {
    const withLogo = {
      ...compiled,
      assets: { logo: { light: 'javascript:alert(1)', dark: 'https://example.com/logo.svg' } },
    } as unknown as CompiledDesignSystem;
    const { container } = render(KitFoundations, { compiled: withLogo });
    const images = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(images).toEqual(['https://example.com/logo.svg']);
    expect(container.textContent).toContain('Logo (light) not shown: unsafe source.');
  });
});

describe('DesignSystemKit: approval header', () => {
  it('computes the ADR-032 content hash', () => {
    const library = {
      ...doc,
      approval: { status: 'approved', version: '2.3.0' },
      library: [
        {
          id: 'primary-cta',
          name: 'Primary call to action',
          purpose: 'The one main action of a page.',
          version: '1.0.0',
          status: 'draft',
          composes: ['button'],
          approval: { status: 'draft', version: '1.0.0' },
        },
      ],
    };
    expect(kitContentHash(library)).toBe(referenceHash(library));
    expect(kitContentHash(doc)).toBe(referenceHash(doc));
    // The approval section never moves the hash.
    expect(kitContentHash({ ...library, approval: { status: 'draft', version: '9.9.9' } })).toBe(
      kitContentHash(library)
    );
  });

  it('shows no record, a matching hash, a differing hash and a draft', () => {
    const hash = kitContentHash(doc);
    const approved = {
      ...doc,
      approval: {
        status: 'approved',
        version: '2.3.0',
        approvedBy: 'design-review@example.com',
        approvedAt: '2026-11-09T12:00:00Z',
        contentHash: hash,
      },
    } as DesignSystem;
    expect(kitApproval(doc)).toMatchObject({ present: false, hash: 'missing' });
    expect(kitApproval(approved)).toMatchObject({ status: 'approved', hash: 'matches' });
    const edited = { ...approved, name: 'Ledgerline edited' } as DesignSystem;
    expect(kitApproval(edited).hash).toBe('differs');

    render(DesignSystemKit, { document: approved, compiled });
    const header = screen.getByRole('region', { name: 'Design system approval' });
    expect(header.textContent).toContain('Approved');
    expect(header.textContent).toContain('Content hash matches the document');
    expect(header.textContent).toContain('Declared approver');
    expect(header.textContent).toContain('design-review@example.com');
    expect(header.textContent).not.toMatch(/verified by/i);
    cleanup();

    render(DesignSystemKit, { document: edited, compiled });
    expect(screen.getByRole('region', { name: 'Design system approval' }).textContent).toContain(
      'differs from the document: re-approve'
    );
    cleanup();

    render(DesignSystemKit, { document: doc, compiled });
    expect(screen.getByRole('region', { name: 'Design system approval' }).textContent).toContain(
      'Not approved'
    );
  });

  it('renders document text as text, never markup', () => {
    const hostile = { ...doc, name: '<img src=x onerror=alert(1)>' } as DesignSystem;
    const { container } = render(DesignSystemKit, { document: hostile, compiled });
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('DesignSystemKit: navigation and modes', () => {
  it('navigates uncontrolled with stable deep-link ids', async () => {
    const { container } = render(DesignSystemKit, { document: doc, compiled });
    expect(container.querySelector('#tx-ds-kit-foundations')).not.toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Design system kit sections' });
    const link = nav.querySelector<HTMLAnchorElement>('[data-tx-ds-kit-nav-item="spacing"]');
    expect(link?.getAttribute('href')).toBe('#tx-ds-kit-foundations-spacing');
    expect(container.querySelector('#tx-ds-kit-foundations-spacing')).not.toBeNull();
    if (link) await fireEvent.click(link);
    await tick();
    expect(link?.getAttribute('aria-current')).toBe('true');
    expect(
      container.querySelector('[data-tx-ds-kit-group="spacing"]')?.getAttribute('aria-current')
    ).toBe('true');
  });

  it('hands navigation to the host when controlled, and scrolls to the current item', async () => {
    const onNavigate = vi.fn();
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      const { container, rerender } = render(DesignSystemKit, {
        document: doc,
        compiled,
        idPrefix: 'brand',
        currentSection: 'foundations',
        currentItem: 'radius',
        onNavigate,
      });
      await tick();
      expect(scroll).toHaveBeenCalled();
      expect(scroll.mock.contexts.at(-1)).toBe(
        container.querySelector('#brand-foundations-radius')
      );
      const radius = container.querySelector('[data-tx-ds-kit-nav-item="radius"]');
      expect(radius?.getAttribute('aria-current')).toBe('true');
      const motion = container.querySelector<HTMLAnchorElement>(
        '[data-tx-ds-kit-nav-item="motion"]'
      );
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      motion?.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('foundations', 'motion');
      // The host decides: nothing moves until it sets the props.
      expect(motion?.getAttribute('aria-current')).toBeNull();
      await rerender({ currentItem: 'motion' });
      expect(motion?.getAttribute('aria-current')).toBe('true');
      expect(scroll.mock.contexts.at(-1)).toBe(
        container.querySelector('#brand-foundations-motion')
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('switches between both modes and one mode', async () => {
    const { container } = render(DesignSystemKit, { document: doc, compiled });
    expect(container.querySelector('[data-tx-mode-cell="dark"]')).not.toBeNull();
    const light = screen.getByRole('radio', { name: 'Light' });
    await fireEvent.click(light);
    await tick();
    expect(
      container.querySelector('[data-tx-ds-kit]')?.getAttribute('data-tx-ds-kit-mode-view')
    ).toBe('light');
    expect(container.querySelector('[data-tx-mode-cell="dark"]')).toBeNull();
    expect(container.querySelector('[data-tx-mode-cell="light"]')).not.toBeNull();
  });

  it('shows only the sections it has data for, in the requested order', () => {
    expect(kitVisibleSections(undefined, ['foundations']).map((s) => s.id)).toEqual([
      'foundations',
    ]);
    expect(kitVisibleSections(['voice', 'foundations', 'voice'], ['foundations', 'voice'])).toEqual(
      [KIT_SECTIONS[1], KIT_SECTIONS[0]]
    );
    const { container } = render(DesignSystemKit, { document: doc });
    expect(container.querySelector('[data-tx-ds-kit-nav="voice"]')).not.toBeNull();
    expect(container.querySelector('[data-tx-ds-kit-nav="foundations"]')).toBeNull();
    expect(container.querySelector('[data-tx-ds-kit-section="voice"]')).not.toBeNull();
    expect(container.querySelector('[data-tx-ds-kit-section="foundations"]')).toBeNull();
  });
});

describe('texuli/ds-kit packaging', () => {
  it('is its own subpath, never reached from the texuli root', () => {
    const pkg = json<{ exports: Record<string, unknown> }>('packages/texuli/package.json');
    expect(pkg.exports['./ds-kit']).toEqual({
      types: './src/ds-kit/index.ts',
      svelte: './src/ds-kit/index.ts',
      default: './src/ds-kit/index.ts',
    });
    const root = readFileSync(join(ROOT, 'packages/texuli/src/index.ts'), 'utf8');
    expect(root).not.toContain('ds-kit');
  });

  it('has no HTML sink, no network call and no static style in its sources', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(svelte|ts)$/.test(entry.name)) files.push(path);
      }
    };
    walk(KIT);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(
        /\{@html|innerHTML|outerHTML|insertAdjacentHTML|new Function|\beval\(/
      );
      expect(text, file).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
      expect(text, file).not.toMatch(/\sstyle="/);
    }
  });

  it('reads the committed catalog as its structural KitCatalog', () => {
    const catalog = json<KitCatalog>('packages/spec/catalog/components.json');
    expect(catalog.catalogHash).toMatch(/^[0-9a-f]{64}$/);
    for (const component of catalog.components) {
      expect(typeof component.id).toBe('string');
      expect(typeof component.group).toBe('string');
      expect(Array.isArray(component.props)).toBe(true);
    }
  });
});
