import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { loadPagesLibraryBase } from '../src/reader/core.ts';
import type { PagesDesignSystemEvent } from '../src/reader/index.ts';
import PageReader from '../src/reader/PageReader.svelte';
import PageReaderCore from '../src/reader/PageReaderCore.svelte';
import { doc, para } from './fixtures.ts';

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): the reader applies the design
 * system a document names to its article, resolved through the host or
 * compiled from the inline document; a refusal keeps the default theme with
 * a visible notice, and a document without one never loads the step.
 */
const SPEC = join(import.meta.dirname, '../../spec/fixtures');
const harbor = (
  JSON.parse(readFileSync(join(SPEC, 'golden/brand-deck.json'), 'utf8')) as {
    designSystem: { inline: Record<string, unknown> };
  }
).designSystem.inline;
const TIMEOUT = { timeout: 30_000 };

function read(
  designSystem: unknown,
  props: Record<string, unknown> = {},
  component: typeof PageReader | typeof PageReaderCore = PageReader
) {
  const events: PagesDesignSystemEvent[] = [];
  const page = { ...doc([para('p1', 'Fictional notes.')]), designSystem } as never;
  const result = render(component as typeof PageReader, {
    props: {
      document: page,
      onDesignSystem: (e: PagesDesignSystemEvent) => events.push(e),
      ...props,
    },
  });
  const article = result.container.querySelector('article') as HTMLElement;
  return { ...result, article, events };
}

async function settled(article: HTMLElement) {
  await expect
    .poll(() => article.getAttribute('data-tx-pages-design-system'), { timeout: 20_000 })
    .toMatch(/^(applied|refused)$/);
  return article.getAttribute('data-tx-pages-design-system');
}

describe('the page reader applies a document design system', () => {
  it('compiles an inline document and resolves a reference through the host', TIMEOUT, async () => {
    const a = read({ inline: harbor });
    expect(await settled(a.article)).toBe('applied');
    expect(a.article.getAttribute('data-tx-ds')).toBe('harbor');
    expect(a.article.style.getPropertyValue('--tx-primary')).toBe('#0f766e');
    a.unmount();
    const b = read(
      { ref: 'harbor@1.2.0' },
      { designSystems: { resolve: () => harbor, mode: 'dark' } }
    );
    expect(await settled(b.article)).toBe('applied');
    expect(b.article.getAttribute('data-tx-mode')).toBe('dark');
    expect(b.events).toEqual([{ status: 'applied', id: 'harbor', source: 'ref' }]);
  });

  it(
    'keeps the default theme with a notice when nothing resolves or the document is refused',
    TIMEOUT,
    async () => {
      for (const [value, code] of [
        [{ ref: 'harbor@1.2.0' }, 'design-system-unresolved'],
        [
          { inline: { ...harbor, assets: { favicon: `data:image/png;base64,${'A'.repeat(8)}` } } },
          'url-refused',
        ],
      ] as const) {
        const { article, events, unmount } = read(value);
        expect(await settled(article)).toBe('refused');
        expect(events[0]).toMatchObject({ status: 'refused', code });
        expect(
          article.querySelector('[data-tx-pages-design-system-notice]')?.getAttribute('role')
        ).toBe('status');
        expect(article.hasAttribute('data-tx-ds')).toBe(false);
        unmount();
      }
    }
  );

  it('never reaches the step statically', () => {
    const src = join(import.meta.dirname, '../src');
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const match of readFileSync(file, 'utf8').matchAll(
        /(?:import|export)\s[^;]*?from\s+'([^']+)'/gms
      )) {
        const spec = match[1] as string;
        expect(spec, relative(src, file)).not.toMatch(
          /^@texuli\/tokens\/design-system|\/design-system\.ts$/
        );
        if (spec.startsWith('.') && /\.(?:ts|svelte)$/.test(spec)) visit(join(dirname(file), spec));
      }
    };
    visit(join(src, 'reader/index.ts'));
    expect(seen.has(join(src, 'reader/PageReader.svelte'))).toBe(true);
  });
});

describe('the reader core reaches the theme library only through a loader it is given (G127)', () => {
  it(
    'refuses texuli:<theme> on PageReaderCore without loadLibraryBase, applies it with one, and PageReader keeps the library default',
    TIMEOUT,
    async () => {
      const violet = { ref: 'texuli:violet' };
      const bare = read(violet, {}, PageReaderCore);
      expect(await settled(bare.article)).toBe('refused');
      expect(bare.events).toEqual([
        expect.objectContaining({ status: 'refused', code: 'design-system-unresolved' }),
      ]);
      bare.unmount();

      const asked: string[] = [];
      const loadLibraryBase = (ref: string) => {
        asked.push(ref);
        return loadPagesLibraryBase(ref);
      };
      const injected = read(violet, { loadLibraryBase }, PageReaderCore);
      expect(await settled(injected.article)).toBe('applied');
      expect(asked).toEqual(['texuli:violet']);
      injected.unmount();

      const reader = read(violet);
      expect(await settled(reader.article)).toBe('applied');
      reader.unmount();
      const off = read(violet, { loadLibraryBase: null });
      expect(await settled(off.article)).toBe('refused');
    }
  );
});
