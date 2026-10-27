import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { renderCatalogFromSpecs } from '@texuli/catalog/render/renderer';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  CONTENT_ELEMENT_LOADERS,
  contentRenderCatalog,
  contentRenderSpecs,
  defineTexuliElements,
  elementTagFor,
  parseJsonData,
} from '../src/elements/index.ts';
import Greeting from './fixtures/elements/Greeting.svelte';
import Throws from './fixtures/elements/Throws.svelte';
import { ARTICLE_TREE, deepTree, HOSTILE_TREE } from './fixtures/elements/trees.ts';
import { scenario } from './scenario.ts';

type CatalogEl = HTMLElement & { tree: unknown; diagnostics: readonly { code: string }[] };
type ComponentEl = HTMLElement & { props: unknown; diagnostics: readonly { code: string }[] };

let defined: ReturnType<typeof defineTexuliElements>;

beforeAll(async () => {
  defined = defineTexuliElements();
  // Load the chunks the DOM tests use once, so test waits never meet a cold transform.
  await Promise.all(['blocks-text', 'media-image'].map((id) => CONTENT_ELEMENT_LOADERS[id]?.()));
}, 60_000);

/** Runs after every test and between the scenarios of a grouped test. */
const reset = () => {
  document.body.replaceChildren();
};
afterEach(reset);

/** Waits until every component element under `root` has settled. */
async function settled(root: ParentNode): Promise<void> {
  await vi.waitFor(
    () => {
      const pending = [...root.querySelectorAll('[data-state="loading"]')];
      const unsettled = [...root.querySelectorAll('*')].filter(
        (el) =>
          el.localName.startsWith('tx-') &&
          el.localName !== 'tx-catalog' &&
          !(el as HTMLElement).dataset.state
      );
      expect(pending.length + unsettled.length).toBe(0);
    },
    { timeout: 10_000 }
  );
}

it('element helpers: tags, JSON parsing, content specs, loaders and the developer tier', async () => {
  await scenario(
    'derives tags from catalog ids and refuses invalid ones',
    async () => {
      expect(elementTagFor('blocks-text')).toBe('tx-blocks-text');
      expect(elementTagFor('blocks-text', 'acme')).toBe('acme-blocks-text');
      for (const bad of ['Blocks', 'blocks_text', '-x', 'x-', 'a--b', '', 'script>']) {
        expect(elementTagFor(bad), bad).toBeNull();
      }
      expect(elementTagFor('blocks-text', 'Bad-Prefix')).toBeNull();
    },
    reset
  );
  await scenario(
    'parses JSON data and never throws',
    async () => {
      expect(parseJsonData('{"a":1}')).toEqual({ a: 1 });
      expect(parseJsonData('not json')).toBeUndefined();
      expect(parseJsonData('')).toBeUndefined();
      expect(parseJsonData(null)).toBeUndefined();
    },
    reset
  );
  await scenario(
    'covers every content manifest with a spec and a loader',
    async () => {
      const ids = CONTENT_MANIFESTS.map((m) => m.id).sort();
      expect(
        contentRenderSpecs()
          .map((s) => s.id)
          .sort()
      ).toEqual(ids);
      expect(Object.keys(CONTENT_ELEMENT_LOADERS).sort()).toEqual(ids);
    },
    reset
  );
  await scenario(
    'keeps the developer tier to agent-emittable content ids',
    async () => {
      const catalog = contentRenderCatalog();
      for (const manifest of CONTENT_MANIFESTS) {
        expect(catalog.allows?.(manifest.id, 'developer'), manifest.id).toBe(
          manifest.agentEmittable === true
        );
      }
    },
    reset
  );
  await scenario(
    'resolves every content loader to a component',
    async () => {
      const loaded = await Promise.all(
        Object.entries(CONTENT_ELEMENT_LOADERS).map(
          async ([id, load]) => [id, typeof (await load())] as const
        )
      );
      expect(loaded.filter(([, type]) => type !== 'function')).toEqual([]);
    },
    reset
  );
}, 60000);

it('defineTexuliElements defines every element idempotently, also with a custom prefix, catalog, loaders and tier', async () => {
  await scenario(
    'defines the catalog element and one element per content component, idempotently',
    async () => {
      expect(defined.catalogTag).toBe('tx-catalog');
      expect(customElements.get('tx-catalog')).toBeDefined();
      for (const manifest of CONTENT_MANIFESTS) {
        expect(customElements.get(`tx-${manifest.id}`), manifest.id).toBeDefined();
      }
      const again = defineTexuliElements();
      expect(again.componentTags).toEqual(defined.componentTags);
      expect(() => defineTexuliElements({ prefix: 'Bad' })).toThrow(TypeError);
    },
    reset
  );
  await scenario(
    'defines elements with a custom prefix, catalog, loaders and tier',
    async () => {
      const catalog = renderCatalogFromSpecs([
        {
          id: 'greeting',
          label: 'Greeting',
          props: [{ name: 'name', kind: 'string', required: true }] as never,
          emit: ['developer'],
        },
      ]);
      const loaders = { greeting: async () => Greeting };
      defineTexuliElements({ prefix: 'acme', catalog, loaders, tier: 'untrusted' });
      defineTexuliElements({ prefix: 'dev', catalog, loaders, tier: 'developer' });
      // The untrusted tier refuses a developer-only component; markup cannot raise it.
      const untrusted = document.createElement('acme-catalog') as CatalogEl;
      untrusted.setAttribute('tier', 'developer');
      untrusted.tree = { id: 'greeting', props: { name: 'Ada' } };
      document.body.append(untrusted);
      expect(untrusted.querySelector('[data-reason="tier-denied"]')?.textContent).toBe(
        'Greeting (not allowed)'
      );
      expect(untrusted.querySelector('acme-greeting')).toBeNull();
      const developer = document.createElement('dev-catalog') as CatalogEl;
      developer.tree = { id: 'greeting', props: { name: 'Ada' } };
      document.body.append(developer);
      await settled(developer);
      expect(developer.querySelector('dev-greeting .greeting')?.textContent).toBe('Hello, Ada.');
    },
    reset
  );
});

it('<tx-blocks-text> renders in light DOM, flags invalid props and rejected blocks, and remounts', async () => {
  await scenario(
    'renders the real component in light DOM from a JSON props attribute',
    async () => {
      const element = document.createElement('tx-blocks-text') as ComponentEl;
      const ready = vi.fn();
      element.addEventListener('tx-ready', ready);
      element.setAttribute(
        'props',
        JSON.stringify({ block: { type: 'heading', level: 2, text: 'Harbor notes' } })
      );
      document.body.append(element);
      await settled(document.body);
      expect(element.shadowRoot).toBeNull();
      expect(element.dataset.state).toBe('ready');
      expect(element.querySelector('h2')?.textContent).toContain('Harbor notes');
      expect(ready).toHaveBeenCalledOnce();
      // New props re-render in place.
      element.props = { block: { type: 'heading', level: 3, text: 'Updated' } };
      await settled(document.body);
      expect(element.querySelector('h3')?.textContent).toContain('Updated');
      expect(element.querySelector('h2')).toBeNull();
    },
    reset
  );
  await scenario(
    'shows a labelled placeholder and an event for invalid props',
    async () => {
      const element = document.createElement('tx-blocks-text') as ComponentEl;
      const invalid = vi.fn();
      element.addEventListener('tx-invalid', invalid);
      element.props = { block: '<b>html</b>' };
      document.body.append(element);
      await settled(document.body);
      expect(element.dataset.state).toBe('invalid');
      expect(element.querySelector('[role="note"]')?.textContent).toBe('Text blocks');
      expect(element.innerHTML).not.toContain('<b>');
      expect(invalid).toHaveBeenCalled();
    },
    reset
  );
  await scenario(
    'turns a block rejected by its own validation into a tx-invalid event',
    async () => {
      const element = document.createElement('tx-blocks-text') as ComponentEl;
      const invalid = vi.fn();
      element.addEventListener('tx-invalid', invalid);
      element.props = { block: { type: 'heading', level: 99 } };
      document.body.append(element);
      await settled(document.body);
      await vi.waitFor(() => expect(invalid).toHaveBeenCalled());
    },
    reset
  );
  await scenario(
    'unmounts when removed and renders again when reattached',
    async () => {
      const element = document.createElement('tx-blocks-text') as ComponentEl;
      element.props = { block: { type: 'heading', level: 2, text: 'Twice' } };
      document.body.append(element);
      await settled(document.body);
      element.remove();
      await vi.waitFor(() => expect(element.querySelector('h2')).toBeNull());
      document.body.append(element);
      await settled(document.body);
      expect(element.querySelectorAll('h2')).toHaveLength(1);
    },
    reset
  );
});

it('<tx-catalog> renders trees from a script child or attribute and every manifest example', async () => {
  await scenario(
    'renders a tree from a JSON script child: components, and a placeholder for an unknown id',
    async () => {
      const catalog = document.createElement('tx-catalog') as CatalogEl;
      const script = document.createElement('script');
      script.type = 'application/json';
      script.textContent = JSON.stringify(ARTICLE_TREE);
      catalog.append(script);
      const rendered = vi.fn();
      catalog.addEventListener('tx-render', rendered);
      document.body.append(catalog);
      await settled(catalog);
      expect(catalog.querySelectorAll('tx-blocks-text')).toHaveLength(2);
      expect(catalog.querySelector('h2')?.textContent).toContain('Harbor quarterly notes');
      expect(catalog.textContent).toContain('Backups run nightly.');
      const note = catalog.querySelector('[data-reason="unknown-id"]');
      expect(note?.getAttribute('role')).toBe('note');
      expect(catalog.querySelector('script')).toBeNull();
      expect(rendered.mock.lastCall?.[0].detail.rendered).toBe(3);
      expect(catalog.diagnostics.map((d) => d.code)).toContain('unknown-id');
    },
    reset
  );
  await scenario(
    'accepts a tree attribute and ignores invalid JSON',
    async () => {
      const catalog = document.createElement('tx-catalog') as CatalogEl;
      catalog.setAttribute('tree', '{not json');
      document.body.append(catalog);
      expect(catalog.childElementCount).toBe(0);
      catalog.setAttribute('tree', JSON.stringify(ARTICLE_TREE[0]));
      await settled(catalog);
      expect(catalog.querySelector('h2')).not.toBeNull();
    },
    reset
  );
  await scenario(
    'renders every content manifest example (the catalog fixtures)',
    async () => {
      const failures: string[] = [];
      for (const manifest of CONTENT_MANIFESTS) {
        const example = manifest.examples[0];
        if (!example) continue;
        const catalog = document.createElement('tx-catalog') as CatalogEl;
        catalog.tree = { id: manifest.id, props: example.props };
        document.body.append(catalog);
        await settled(catalog);
        const element = catalog.querySelector(`tx-${manifest.id}`) as ComponentEl | null;
        if (element?.dataset.state !== 'ready') {
          failures.push(
            `${manifest.id}: ${element?.dataset.state ?? 'no element'} ${JSON.stringify(catalog.diagnostics)}`
          );
        }
        catalog.remove();
      }
      expect(failures).toEqual([]);
    },
    reset
  );
}, 120000);

it('<tx-catalog> keeps hostile trees inert, refuses oversize trees and recovers from load and mount failures', async () => {
  await scenario(
    'never lets markup, styles, handlers or unsafe URLs from a hostile tree reach the page',
    async () => {
      const catalog = document.createElement('tx-catalog') as CatalogEl;
      catalog.tree = HOSTILE_TREE;
      document.body.append(catalog);
      await settled(catalog);
      const html = catalog.innerHTML;
      expect(catalog.querySelector('script, img[onerror], [onclick]')).toBeNull();
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('position:fixed');
      expect(html).not.toContain('class="evil"');
      // The block's own validation refuses the markup-looking callout as a whole.
      expect(catalog.querySelector('tx-blocks-text')?.textContent).toContain(
        'This block could not be shown'
      );
      const codes = catalog.diagnostics.map((d) => d.code);
      expect(codes).toEqual(expect.arrayContaining(['forbidden-prop', 'unknown-id']));
    },
    reset
  );
  await scenario(
    'renders nothing for a tree over the limits',
    async () => {
      const catalog = document.createElement('tx-catalog') as CatalogEl;
      catalog.tree = deepTree(80);
      document.body.append(catalog);
      expect(catalog.dataset.state).toBe('over-limits');
      expect(catalog.querySelector('tx-blocks-text')).toBeNull();
      expect(catalog.diagnostics.length).toBeGreaterThan(0);
    },
    reset
  );
  await scenario(
    'retries a failed load on the next render',
    async () => {
      let attempts = 0;
      defineTexuliElements({
        prefix: 'flaky',
        loaders: {
          'blocks-text': async () => {
            attempts += 1;
            if (attempts === 1) throw new Error('offline');
            return (await CONTENT_ELEMENT_LOADERS['blocks-text']?.()) as never;
          },
        },
      });
      const element = document.createElement('flaky-blocks-text') as ComponentEl;
      element.props = { block: { type: 'heading', level: 2, text: 'Back online' } };
      document.body.append(element);
      await vi.waitFor(() => expect(element.dataset.state).toBe('error'));
      element.props = { block: { type: 'heading', level: 2, text: 'Back online' } };
      await vi.waitFor(() => expect(element.dataset.state).toBe('ready'));
      expect(element.querySelector('h2')?.textContent).toContain('Back online');
    },
    reset
  );
  await scenario(
    'shows a placeholder and an event when a component throws while mounting',
    async () => {
      const catalog = renderCatalogFromSpecs([
        {
          id: 'throws',
          label: 'Strict widget',
          props: [{ name: 'name', kind: 'string', required: true }] as never,
          emit: ['developer', 'untrusted'],
        },
      ]);
      defineTexuliElements({ prefix: 'strict', catalog, loaders: { throws: async () => Throws } });
      const element = document.createElement('strict-throws') as ComponentEl;
      const invalid = vi.fn();
      element.addEventListener('tx-invalid', invalid);
      element.props = { name: 'nope' };
      document.body.append(element);
      await vi.waitFor(() => expect(element.dataset.state).toBe('invalid'));
      expect(element.querySelector('[data-reason="render-error"]')?.textContent).toBe(
        'Strict widget'
      );
      expect(invalid.mock.lastCall?.[0].detail[0]).toMatchObject({
        code: 'render-error',
        message: expect.stringContaining('Unknown name: nope'),
      });
      element.props = { name: 'ok' };
      await vi.waitFor(() => expect(element.dataset.state).toBe('ready'));
      expect(element.textContent).toBe('ok');
    },
    reset
  );
  await scenario(
    'shows a placeholder when a component fails to load',
    async () => {
      defineTexuliElements({
        prefix: 'broken',
        loaders: { 'blocks-text': async () => Promise.reject(new Error('offline')) },
      });
      const element = document.createElement('broken-blocks-text') as ComponentEl;
      element.props = { block: { type: 'heading', level: 2, text: 'x' } };
      document.body.append(element);
      await vi.waitFor(() => expect(element.dataset.state).toBe('error'));
      expect(element.querySelector('[data-reason="load-error"]')?.textContent).toBe('Text blocks');
    },
    reset
  );
});

it('writes no markup from data anywhere in the elements module', () => {
  for (const file of ['define.ts', 'content.ts', 'index.ts']) {
    const source = readFileSync(join(import.meta.dirname, '../src/elements', file), 'utf8');
    expect(source, file).not.toMatch(
      /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(|attachShadow/
    );
  }
});
