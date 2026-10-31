import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { render, screen } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { compileDesignSystem } from '@texuli/tokens/design-system/compile';
import { describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import type { PlayerDesignSystemEvent } from '../src/index.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';
import DefaultsHarness from './DefaultsHarness.svelte';

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): the player applies a blueprint's
 * design system to its root scope. A reference is resolved by the host
 * (never a fetch), an inline document is validated at the player's tier and
 * compiled lazily, and anything unresolved or refused keeps the default
 * theme with a visible, announced notice; nothing throws. A blueprint
 * without a design system never loads the step (the import graph below).
 */
const SPEC = join(import.meta.dirname, '../../spec');
const read = (path: string) => JSON.parse(readFileSync(join(SPEC, path), 'utf8'));
const deck = read('fixtures/golden/brand-deck.json') as Record<string, unknown>;
const report = read('fixtures/golden/brand-report.json') as Record<string, unknown>;
const harbor = (deck.designSystem as { inline: Record<string, unknown> }).inline;
const minimal = read('fixtures/design-systems/minimal.json') as Record<string, unknown>;
const TIMEOUT = { timeout: 30_000 };

function paint(blueprint: unknown, props: Record<string, unknown> = {}) {
  const events: PlayerDesignSystemEvent[] = [];
  const result = render(Player, {
    props: {
      blueprint,
      label: 'Branded',
      onDesignSystem: (event: PlayerDesignSystemEvent) => events.push(event),
      ...props,
    },
  });
  const root = result.container.querySelector<HTMLElement>('[data-tx-player]') as HTMLElement;
  return { ...result, root, events };
}

async function settled(root: HTMLElement): Promise<string | null> {
  await expect
    .poll(() => root.getAttribute('data-tx-player-design-system'), { timeout: 20_000 })
    .toMatch(/^(applied|refused)$/);
  return root.getAttribute('data-tx-player-design-system');
}

const withSystem = (designSystem: unknown) => ({ ...report, designSystem });

describe('the player applies a blueprint design system to its root scope', () => {
  it('compiles an inline document (a deck) and applies it', TIMEOUT, async () => {
    const { root, events } = paint(deck);
    expect(await settled(root)).toBe('applied');
    expect(root.getAttribute('data-tx-ds')).toBe('harbor');
    expect(root.hasAttribute('data-tx-scope')).toBe(true);
    expect(root.getAttribute('data-tx-mode')).toBe('light');
    expect(root.style.getPropertyValue('--tx-primary')).toBe('#0f766e');
    expect(events).toEqual([{ status: 'applied', id: 'harbor', source: 'inline' }]);
    expect(root.querySelector('[data-tx-player-design-system-notice]')).toBeNull();
  });

  it(
    'resolves a reference through the host: a document, a compiled copy, a library theme',
    TIMEOUT,
    async () => {
      const resolve = vi.fn((ref: string) => (ref === 'harbor@1.2.0' ? harbor : undefined));
      const a = paint(report, { designSystems: { resolve, mode: 'dark' } });
      expect(await settled(a.root)).toBe('applied');
      expect(resolve).toHaveBeenCalledWith('harbor@1.2.0');
      expect(a.root.getAttribute('data-tx-mode')).toBe('dark');
      expect(a.events[0]).toEqual({ status: 'applied', id: 'harbor', source: 'ref' });
      a.unmount();

      const compiled = compileDesignSystem(harbor);
      if (!compiled.ok) throw new Error('harbor compiles');
      const cached = JSON.parse(JSON.stringify(compiled));
      const b = paint(report, { designSystems: { resolve: async () => cached } });
      expect(await settled(b.root)).toBe('applied');
      expect(b.root.style.getPropertyValue('--tx-primary')).toBe(
        compiled.vars.light?.['--tx-primary']
      );
      b.unmount();

      const c = paint(withSystem({ ref: 'texuli:violet' }));
      expect(await settled(c.root)).toBe('applied');
      expect(c.root.getAttribute('data-tx-ds')).toBeTruthy();
    }
  );

  it(
    'keeps the default theme with a visible, announced notice when nothing resolves or the document is refused',
    TIMEOUT,
    async () => {
      const cases: [string, Record<string, unknown>, Record<string, unknown>, string][] = [
        ['no resolver', report, {}, 'design-system-unresolved'],
        [
          'resolver throws',
          report,
          {
            designSystems: {
              resolve: () => {
                throw new Error('offline');
              },
            },
          },
          'design-system-refused',
        ],
        [
          'rejecting resolver',
          report,
          { designSystems: { resolve: () => Promise.reject(new Error('x')) } },
          'design-system-refused',
        ],
        [
          'wrong document',
          report,
          { designSystems: { resolve: () => minimal } },
          'design-system-refused',
        ],
        [
          'unknown library theme',
          withSystem({ ref: 'texuli:no-such-theme' }),
          {},
          'design-system-unresolved',
        ],
        [
          'contrast refused',
          withSystem({
            inline: {
              ...minimal,
              color: {
                brand: { seed: '#4f46e5' },
                roles: { light: { foreground: '#ffffff', background: '#ffffff' } },
              },
            },
          }),
          {},
          'aa-text',
        ],
        [
          'data URL at the untrusted tier',
          withSystem({
            inline: { ...minimal, assets: { favicon: `data:image/png;base64,${'A'.repeat(64)}` } },
          }),
          {},
          'url-refused',
        ],
      ];
      for (const [name, blueprint, props, code] of cases) {
        const { root, events, unmount } = paint(blueprint, props);
        expect(await settled(root), name).toBe('refused');
        expect(events[0], name).toMatchObject({ status: 'refused', code });
        const notice = root.querySelector('[data-tx-player-design-system-notice]');
        expect(notice?.getAttribute('role'), name).toBe('status');
        expect(notice?.textContent, name).toContain('Showing the default theme');
        expect(root.hasAttribute('data-tx-ds'), name).toBe(false);
        expect(root.style.getPropertyValue('--tx-primary'), name).toBe('');
        // The content still paints.
        expect(root.querySelector('[data-tx-player-surface]'), name).not.toBeNull();
        expect(
          screen.getAllByText('Showing the default theme', { exact: false }).length
        ).toBeGreaterThan(0);
        unmount();
      }
    }
  );

  it(
    'paints a data URL inline document at the developer tier, and restores the root when the design system goes',
    TIMEOUT,
    async () => {
      const png = `data:image/png;base64,${'A'.repeat(64)}`;
      const blueprint = withSystem({ inline: { ...harbor, assets: { favicon: png } } });
      const { root, rerender } = paint(blueprint, { tier: 'developer' });
      expect(await settled(root)).toBe('applied');
      expect(root.style.getPropertyValue('--tx-primary')).toBe('#0f766e');
      const { designSystem: _drop, ...plain } = report;
      await rerender({ blueprint: plain });
      await expect.poll(() => root.hasAttribute('data-tx-player-design-system')).toBe(false);
      expect(root.style.getPropertyValue('--tx-primary')).toBe('');
      expect(root.hasAttribute('data-tx-ds')).toBe(false);
    }
  );

  it('applies nothing for a blueprint the validator refuses', TIMEOUT, async () => {
    const { root, container } = paint(withSystem({ ref: 'acme@^2' }));
    await expect.poll(() => container.querySelector('[data-status="invalid"]')).not.toBeNull();
    expect(root.hasAttribute('data-tx-player-design-system')).toBe(false);
  });
});

describe('the player hands the compiled component defaults to the painted components', () => {
  const { designSystem: _ref, ...plainReport } = report;
  const branded = (
    defaults: Record<string, unknown> | undefined,
    props: Record<string, unknown>
  ) => ({
    ...plainReport,
    tier: 'developer',
    ...(defaults === undefined
      ? {}
      : {
          designSystem: {
            inline: { ...harbor, components: { button: { radius: 'full', defaults } } },
          },
        }),
    tree: {
      id: 'layout-doc',
      props: { title: 'Defaults' },
      children: [{ id: 'button', props: { label: 'Save', ...props } }],
    },
  });
  const button = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('button.tx-button') as HTMLElement;
  // A host catalog that adds texuli's Button (the player catalog paints
  // blocks, charts, layouts and data views; their inner texuli components
  // read the same context).
  const base = createPlayerCatalog();
  const buttonSpec = {
    id: 'button',
    label: 'Button',
    props: [
      { name: 'label', kind: 'string' as const },
      { name: 'variant', kind: 'string' as const },
      { name: 'size', kind: 'string' as const },
    ],
    emit: ['developer'] as const,
  };
  const catalog: RenderCatalog = {
    get: (id) => (id === 'button' ? buttonSpec : base.get(id)),
    allows: (id, tier) => (id === 'button' ? true : (base.allows?.(id, tier) ?? false)),
  };
  const loaders = {
    ...PLAYER_LOADERS,
    button: async () => (await import('texuli/button')).Button,
  };

  it(
    'a default variant and size show up, an explicit prop wins, and removing the design system restores the library defaults',
    TIMEOUT,
    async () => {
      const { root, container, rerender } = paint(branded({ variant: 'outline', size: 'sm' }, {}), {
        tier: 'developer',
        catalog,
        loaders,
      });
      expect(await settled(root)).toBe('applied');
      await expect.poll(() => button(container)?.className).toContain('tx-button--outline');
      expect(button(container).className).toContain('tx-button--sm');

      // A prop in the blueprint wins over the design system's default.
      await rerender({
        blueprint: branded({ variant: 'outline', size: 'sm' }, { variant: 'ghost' }),
      });
      await expect.poll(() => button(container)?.className).toContain('tx-button--ghost');
      expect(button(container).className).toContain('tx-button--sm');

      // Without the design system the library defaults come back.
      await rerender({ blueprint: branded(undefined, {}) });
      await expect.poll(() => root.hasAttribute('data-tx-player-design-system')).toBe(false);
      await expect.poll(() => button(container)?.className).toContain('tx-button--default');
      expect(button(container).className).toContain('tx-button--md');
      expect(button(container).className).not.toContain('tx-button--sm');
    }
  );

  it(
    'keeps only the closed vocabulary from a cached compiled copy, below an outer provider it overrides',
    TIMEOUT,
    async () => {
      const compiled = compileDesignSystem({
        ...harbor,
        components: { button: { radius: 'full', defaults: { variant: 'secondary' } } },
      });
      if (!compiled.ok) throw new Error('harbor compiles');
      const cached = {
        ...JSON.parse(JSON.stringify(compiled)),
        defaults: { button: { variant: 'secondary', size: 'huge' }, nope: { variant: 'x' } },
      };
      const { playerDesignDefaults } = await import('../src/design-system.ts');
      expect(playerDesignDefaults(cached)).toEqual({ button: { variant: 'secondary' } });
      expect(playerDesignDefaults({ ...cached, defaults: {} })).toBeUndefined();
      const { container } = render(DefaultsHarness, {
        props: {
          outer: { button: { variant: 'ghost', size: 'lg' } },
          blueprint: { ...branded(undefined, {}), designSystem: { ref: 'harbor@1.2.0' } },
          label: 'Branded',
          tier: 'developer',
          catalog,
          loaders,
          designSystems: { resolve: () => cached },
        },
      });
      const root = container.querySelector<HTMLElement>('[data-tx-player]') as HTMLElement;
      expect(await settled(root)).toBe('applied');
      await expect.poll(() => button(container)?.className).toContain('tx-button--secondary');
      expect(button(container).className).toContain('tx-button--lg');
    }
  );
});

describe('a blueprint without a design system costs nothing', () => {
  it('never loads the step: no static path from the entry reaches it, the compiler or the runtime', () => {
    const src = join(import.meta.dirname, '../src');
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)) {
        const spec = match[1] as string;
        const where = relative(src, file);
        expect(spec, where).not.toMatch(/^texuli\/(?:design-system|defaults)|^@texuli\/tokens/);
        expect(spec, where).not.toBe('./design-system.ts');
        if (spec.startsWith('.') && /\.(?:ts|svelte)$/.test(spec)) visit(join(dirname(file), spec));
      }
    };
    visit(join(src, 'index.ts'));
    expect(seen.size).toBeGreaterThan(50);
    expect(seen.has(join(src, 'Player.svelte'))).toBe(true);
    // The step is reached only through a dynamic import.
    const player = readFileSync(join(src, 'Player.svelte'), 'utf8');
    expect(player).toContain("import('./design-system.ts')");
  });

  it('leaves the root untouched for a blueprint without one', TIMEOUT, async () => {
    const { designSystem: _drop, ...plain } = report;
    const { root, events } = paint(plain);
    await expect.poll(() => root.querySelector('[data-tx-player-surface]')).not.toBeNull();
    expect(root.hasAttribute('data-tx-player-design-system')).toBe(false);
    expect(root.hasAttribute('data-tx-scope')).toBe(false);
    expect(events).toEqual([]);
  });
});

describe('the design-system core step takes the theme library loader from its caller (G127)', () => {
  it(
    'refuses texuli:<theme> without a loader, resolves it with one, and the default step keeps the library',
    TIMEOUT,
    async () => {
      const core = await import('../src/design-system-core.ts');
      const step = await import('../src/design-system.ts');
      const violet = { ref: 'texuli:violet' } as const;
      // No loader: the reference and an inline document's texuli: base are both refused.
      const bare = await core.resolvePlayerDesignSystemCore(violet, null, 'untrusted');
      expect(bare).toMatchObject({ ok: false, code: 'design-system-unresolved' });
      const based = await core.resolvePlayerDesignSystemCore(
        { inline: { ...minimal, extends: 'texuli:violet' } },
        null,
        'developer'
      );
      expect(based).toMatchObject({
        ok: false,
        code: 'invalid-value',
        path: '$.designSystem.inline.extends',
      });
      // An injected loader resolves both (here the library's, opted into by name).
      const asked: string[] = [];
      const loadLibraryBase = (ref: string) => {
        asked.push(ref);
        return step.loadPlayerLibraryBase(ref);
      };
      const injected = await core.resolvePlayerDesignSystemCore(violet, null, 'untrusted', {
        loadLibraryBase,
      });
      expect(injected.ok).toBe(true);
      const inline = await core.resolvePlayerDesignSystemCore(
        { inline: { ...minimal, extends: 'texuli:violet' } },
        null,
        'developer',
        { loadLibraryBase }
      );
      expect(inline.ok).toBe(true);
      expect(asked).toEqual(['texuli:violet', 'texuli:violet']);
      // The host's resolver answers first, so a host that resolves texuli: ids needs no loader.
      const fromHost = await core.resolvePlayerDesignSystemCore(
        violet,
        { resolve: () => step.loadPlayerLibraryBase('texuli:violet') as never },
        'untrusted'
      );
      expect(fromHost.ok).toBe(true);
      // The default step loads the library unless the caller turns it off with null.
      expect((await step.resolvePlayerDesignSystem(violet, null, 'untrusted')).ok).toBe(true);
      expect(
        await step.resolvePlayerDesignSystem(violet, null, 'untrusted', { loadLibraryBase: null })
      ).toMatchObject({ ok: false, code: 'design-system-unresolved' });
      // Only the default step names the full compiler; the core loads the library-free one.
      const source = (name: string) =>
        readFileSync(join(import.meta.dirname, '../src', name), 'utf8');
      expect(source('design-system-core.ts')).not.toMatch(/loadDesignSystemCompiler\(/);
      expect(source('design-system-core.ts')).toContain('loadDesignSystemCompilerCore()');
    }
  );
});
