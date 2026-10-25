import { renderCatalogTreeWithLimits } from '@texuli/catalog/render/limits';
import {
  type CatalogTreeInput,
  type RenderCatalog,
  type RenderDiagnostic,
  type RenderNode,
  type RenderTier,
  renderCatalogTree,
} from '@texuli/catalog/render/renderer';
import { mount, unmount } from 'svelte';
import {
  CONTENT_ELEMENT_LOADERS,
  contentRenderCatalog,
  type ElementComponent,
  type ElementComponentLoader,
} from './content.ts';

/**
 * `@texuli/tools/elements` (T-tool-elements): light-DOM custom elements so a
 * non-Svelte host (plain HTML, React, Vue, a server template) can render
 * catalog trees with the real Texuli content components.
 *
 * - `<tx-catalog>` takes an untrusted catalog tree (the `tree` property, a
 *   `tree` JSON attribute, or a child `<script type="application/json">`),
 *   checks it against the tree limits and the sink-free renderer, and builds
 *   one `<tx-{id}>` element per component, or a labelled placeholder.
 * - `<tx-{id}>` (one per content component) mounts the Svelte component in
 *   its own light DOM, so page styles and the Texuli CSS layers apply.
 *
 * Nothing here writes markup from data: elements are created with
 * `createElement`, text with `textContent`, and every props bag passes the
 * catalog renderer (unknown ids, forbidden props and HTML strings never
 * reach a component). The render tier is fixed when the elements are
 * defined; markup cannot raise it.
 */

export const ELEMENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PREFIX_PATTERN = /^[a-z][a-z0-9]*$/;

export interface DefineElementsOptions {
  /** id → lazy Svelte component. Default: the content preset. */
  loaders?: Readonly<Record<string, ElementComponentLoader>>;
  /** Render catalog the trees and props are checked against. Default: content manifests. */
  catalog?: RenderCatalog;
  /** Who authors the trees. Default `untrusted` (agent content). */
  tier?: RenderTier;
  /** Tag prefix: `tx` gives `<tx-catalog>` and `<tx-blocks-text>`. */
  prefix?: string;
  /** Registry to define into (a window's `customElements`). */
  registry?: CustomElementRegistry;
  /** The window whose `HTMLElement` the classes extend. */
  window?: Window & typeof globalThis;
}

export interface DefinedElements {
  catalogTag: string;
  /** id → tag of every component element. */
  componentTags: Readonly<Record<string, string>>;
}

/** The custom element tag for a catalog id, or `null` for an invalid id. */
export function elementTagFor(id: string, prefix = 'tx'): string | null {
  if (!PREFIX_PATTERN.test(prefix) || !ELEMENT_ID_PATTERN.test(id)) return null;
  return `${prefix}-${id}`;
}

/** Parses a JSON attribute or script body; anything invalid is `undefined`. */
export function parseJsonData(text: string | null | undefined): unknown {
  if (typeof text !== 'string' || text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function placeholder(doc: Document, label: string, reason: string): HTMLElement {
  const note = doc.createElement('p');
  note.className = 'tx-element-placeholder';
  note.setAttribute('role', 'note');
  note.dataset.reason = reason;
  note.textContent = label;
  return note;
}

/**
 * Defines `<{prefix}-catalog>` and one `<{prefix}-{id}>` per loader. Safe to
 * call again: tags already defined are kept as they are.
 */
export function defineTexuliElements(options: DefineElementsOptions = {}): DefinedElements {
  const win = options.window ?? (globalThis as Window & typeof globalThis);
  const registry = options.registry ?? win.customElements;
  const prefix = options.prefix ?? 'tx';
  if (!PREFIX_PATTERN.test(prefix)) throw new TypeError(`Invalid element prefix: ${prefix}`);
  if (!registry || typeof win.HTMLElement !== 'function') {
    throw new TypeError('Custom elements are not available in this environment.');
  }
  const loaders = options.loaders ?? CONTENT_ELEMENT_LOADERS;
  const catalog = options.catalog ?? contentRenderCatalog();
  const tier: RenderTier = options.tier === 'developer' ? 'developer' : 'untrusted';

  const componentTags: Record<string, string> = {};
  for (const id of Object.keys(loaders)) {
    const tag = elementTagFor(id, prefix);
    if (!tag) continue;
    componentTags[id] = tag;
  }
  const cache = new Map<string, Promise<ElementComponent>>();
  const load = (id: string): Promise<ElementComponent> => {
    let pending = cache.get(id);
    if (!pending) {
      const loader = loaders[id];
      pending = loader ? loader() : Promise.reject(new Error(`No loader for ${id}`));
      // A failed load may be retried on the next render.
      pending.catch(() => cache.delete(id));
      cache.set(id, pending);
    }
    return pending;
  };

  class ComponentElement extends win.HTMLElement {
    static observedAttributes = ['props'];
    /** The catalog id; set by the subclass per tag. */
    static componentId = '';
    #props: unknown = undefined;
    #instance: Record<string, unknown> | undefined;
    #renderToken = 0;
    #diagnostics: readonly RenderDiagnostic[] = [];

    get componentId(): string {
      return (this.constructor as typeof ComponentElement).componentId;
    }

    /** The component's props: plain data, validated against its manifest. */
    get props(): unknown {
      return this.#props;
    }
    set props(value: unknown) {
      this.#props = value;
      if (this.isConnected) void this.#render();
    }

    /** Why the last props were refused or changed (empty when they were fine). */
    get diagnostics(): readonly RenderDiagnostic[] {
      return this.#diagnostics;
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
      if (name === 'props') this.props = parseJsonData(value);
    }

    connectedCallback(): void {
      void this.#render();
    }

    disconnectedCallback(): void {
      this.#renderToken += 1;
      this.#teardown();
    }

    #teardown(): void {
      if (this.#instance) {
        void unmount(this.#instance);
        this.#instance = undefined;
      }
    }

    async #render(): Promise<void> {
      const token = ++this.#renderToken;
      const id = this.componentId;
      const result = renderCatalogTree({ id, props: this.#props ?? {} }, { catalog, tier });
      this.#diagnostics = result.diagnostics;
      const node = result.roots[0];
      this.#teardown();
      if (node?.kind !== 'component') {
        const reason = node?.kind === 'placeholder' ? node.reason : 'invalid-props';
        const label = node?.kind === 'placeholder' ? node.label : (catalog.get(id)?.label ?? id);
        this.dataset.state = 'invalid';
        this.replaceChildren(placeholder(this.ownerDocument, label, reason));
        this.dispatchEvent(new CustomEvent('tx-invalid', { detail: result.diagnostics }));
        return;
      }
      this.dataset.state = 'loading';
      this.setAttribute('aria-busy', 'true');
      let Component: ElementComponent;
      try {
        Component = await load(id);
      } catch {
        if (token !== this.#renderToken) return;
        this.removeAttribute('aria-busy');
        this.dataset.state = 'error';
        this.replaceChildren(
          placeholder(this.ownerDocument, catalog.get(id)?.label ?? id, 'load-error')
        );
        return;
      }
      if (token !== this.#renderToken || !this.isConnected) return;
      const target = this.ownerDocument.createElement('div');
      target.dataset.txElementRoot = '';
      this.replaceChildren(target);
      const props: Record<string, unknown> = { ...node.props };
      // Validation callbacks become DOM events: trees carry data, never functions.
      if (catalog.get(id)?.props.some((prop) => prop.name === 'oninvalid')) {
        props.oninvalid = (issues: unknown) =>
          this.dispatchEvent(new CustomEvent('tx-invalid', { detail: issues }));
      }
      try {
        this.#instance = mount(Component, { target, props }) as Record<string, unknown>;
      } catch (error) {
        // A component that refuses its props (a chart with an invalid series)
        // must not break the page: show its placeholder and report why.
        this.removeAttribute('aria-busy');
        this.dataset.state = 'invalid';
        this.replaceChildren(
          placeholder(this.ownerDocument, catalog.get(id)?.label ?? id, 'render-error')
        );
        this.dispatchEvent(
          new CustomEvent('tx-invalid', {
            detail: [
              {
                code: 'render-error',
                message: error instanceof Error ? error.message : String(error),
              },
            ],
          })
        );
        return;
      }
      this.removeAttribute('aria-busy');
      this.dataset.state = 'ready';
      this.dispatchEvent(new CustomEvent('tx-ready'));
    }
  }

  class CatalogElement extends win.HTMLElement {
    static observedAttributes = ['tree'];
    #tree: unknown = undefined;
    #diagnostics: readonly RenderDiagnostic[] = [];

    /** The catalog tree (one node or a list of nodes): untrusted data. */
    get tree(): unknown {
      return this.#tree;
    }
    set tree(value: unknown) {
      this.#tree = value;
      if (this.isConnected) this.#render();
    }

    /** Why nodes were dropped, replaced or refused in the last render. */
    get diagnostics(): readonly RenderDiagnostic[] {
      return this.#diagnostics;
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
      if (name === 'tree') this.tree = parseJsonData(value);
    }

    connectedCallback(): void {
      if (this.#tree === undefined) {
        const script = this.querySelector(':scope > script[type="application/json"]');
        if (script) this.#tree = parseJsonData(script.textContent);
      }
      this.#render();
    }

    #render(): void {
      const doc = this.ownerDocument;
      const input = this.#tree;
      const nodes: CatalogTreeInput[] = Array.isArray(input)
        ? input
        : input === undefined
          ? []
          : [input as CatalogTreeInput];
      const roots: RenderNode[] = [];
      const diagnostics: RenderDiagnostic[] = [];
      let limited = false;
      nodes.forEach((node, index) => {
        const result = renderCatalogTreeWithLimits(node, {
          catalog,
          tier,
          enforceRenderTime: false,
        });
        if (!result.withinLimits) limited = true;
        roots.push(...result.roots);
        diagnostics.push(...result.diagnostics.map((d) => ({ ...d, path: `${index}.${d.path}` })));
      });
      this.#diagnostics = diagnostics;
      const fragment = doc.createDocumentFragment();
      for (const node of roots) fragment.append(this.#build(node));
      this.replaceChildren(fragment);
      this.dataset.state = limited ? 'over-limits' : 'ready';
      this.dispatchEvent(
        new CustomEvent('tx-render', { detail: { diagnostics, rendered: roots.length } })
      );
    }

    #build(node: RenderNode): Node {
      const doc = this.ownerDocument;
      if (node.kind === 'placeholder') return placeholder(doc, node.label, node.reason);
      const tag = componentTags[node.id];
      if (!tag) return placeholder(doc, catalog.get(node.id)?.label ?? node.id, 'no-element');
      const element = doc.createElement(tag) as HTMLElement & { props: unknown };
      element.props = node.props;
      if (node.children.length === 0) return element;
      // Content components take no DOM children; nested nodes follow in order.
      const group = doc.createElement('div');
      group.dataset.txElementGroup = node.id;
      const children = doc.createElement('div');
      children.dataset.txElementChildren = '';
      for (const child of node.children) children.append(this.#build(child));
      group.append(element, children);
      return group;
    }
  }

  const catalogTag = `${prefix}-catalog`;
  if (!registry.get(catalogTag)) registry.define(catalogTag, CatalogElement);
  for (const [id, tag] of Object.entries(componentTags)) {
    if (registry.get(tag)) continue;
    registry.define(
      tag,
      class extends ComponentElement {
        static override componentId = id;
      }
    );
  }
  return { catalogTag, componentTags: Object.freeze({ ...componentTags }) };
}
