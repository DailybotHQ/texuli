import type { RenderNode } from '@texuli/catalog/render/renderer';
import { mount, tick, unmount } from 'svelte';
import { CONTENT_ELEMENT_LOADERS, type ElementComponentLoader } from '../elements/content.ts';
import { goldenManifest } from './catalog.ts';
import { cardHeadingLevel, isFrame, titleOf } from './outline.ts';

/**
 * Paints a rendered golden tree into a document so axe can check it. Content
 * components mount for real (the element loaders); the five content layouts
 * become the semantic containers a host maps them to: a frame is `main` with
 * its title as the `h1`, a card is a labelled `section`, a grid a plain group.
 * Markup is never built from strings: `createElement` and `textContent` only.
 */

export interface GoldenPaint {
  /** Components that failed to load or mount, or refused their props. */
  issues: readonly string[];
  destroy(): void;
}

export interface GoldenPaintOptions {
  loaders?: Readonly<Record<string, ElementComponentLoader>>;
  /** The document title and `lang` (axe checks both). */
  title?: string;
  lang?: string;
}

let sequence = 0;

export async function paintGoldenTree(
  roots: readonly RenderNode[],
  doc: Document,
  options: GoldenPaintOptions = {}
): Promise<GoldenPaint> {
  const loaders = options.loaders ?? CONTENT_ELEMENT_LOADERS;
  const issues: string[] = [];
  const instances: Record<string, unknown>[] = [];
  doc.documentElement.lang = options.lang ?? 'en';
  doc.title = options.title ?? 'Golden interface';
  doc.body.replaceChildren();

  const headingEl = (level: number, text: string): HTMLElement => {
    const el = doc.createElement(`h${Math.min(Math.max(level, 1), 6)}`);
    el.textContent = text;
    return el;
  };

  const paint = async (node: RenderNode, parent: Element, level: number, path: string) => {
    if (node.kind === 'placeholder') {
      const note = doc.createElement('p');
      note.setAttribute('role', 'note');
      note.textContent = node.label;
      parent.append(note);
      return;
    }
    const title = titleOf(node);
    let container: Element = parent;
    let childLevel = level;
    if (isFrame(node.id)) {
      container = doc.createElement('main');
      if (title) {
        container.append(headingEl(1, title));
        childLevel = 1;
      }
      const description = node.props.description;
      if (typeof description === 'string') {
        const p = doc.createElement('p');
        p.textContent = description;
        container.append(p);
      }
      parent.append(container);
    } else if (node.id === 'layout-card') {
      container = doc.createElement(title ? 'section' : 'div');
      if (title) {
        childLevel = cardHeadingLevel(level);
        const h = headingEl(childLevel, title);
        sequence += 1;
        h.id = `golden-card-${sequence}`;
        container.setAttribute('aria-labelledby', h.id);
        container.append(h);
      }
      parent.append(container);
    } else if (node.id === 'layout-grid') {
      container = doc.createElement('div');
      container.setAttribute('data-golden-grid', '');
      parent.append(container);
    } else {
      const loader = loaders[node.id];
      const target = doc.createElement('div');
      target.setAttribute('data-golden-component', node.id);
      parent.append(target);
      if (!loader) {
        issues.push(`${path} ${node.id}: no component to paint`);
        return;
      }
      try {
        const Component = await loader();
        const props: Record<string, unknown> = { ...node.props };
        // Blocks report a refused block through `oninvalid` instead of throwing.
        if (goldenManifest(node.id)?.props.some((prop) => prop.name === 'oninvalid')) {
          props.oninvalid = (detail: unknown) =>
            issues.push(
              `${path} ${node.id}: refused its props ${JSON.stringify(detail).slice(0, 200)}`
            );
        }
        instances.push(mount(Component, { target, props }) as Record<string, unknown>);
      } catch (error) {
        issues.push(
          `${path} ${node.id}: failed to render (${error instanceof Error ? error.message : String(error)})`
        );
      }
    }
    for (let index = 0; index < node.children.length; index += 1) {
      await paint(
        node.children[index] as RenderNode,
        container,
        childLevel,
        `${path}.children.${index}`
      );
    }
  };

  for (let index = 0; index < roots.length; index += 1) {
    await paint(roots[index] as RenderNode, doc.body, 0, String(index));
  }
  await tick();
  // Lazy families resolve their own chunks after mount; let them settle.
  for (let round = 0; round < 3; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
  }
  return {
    issues,
    destroy() {
      for (const instance of instances) void unmount(instance);
      doc.body.replaceChildren();
    },
  };
}
