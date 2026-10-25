import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { goldenManifest } from './catalog.ts';

/**
 * Machine checks for the `dontUseWhen` guidance of the agent surface. Each
 * detector is keyed by the exact manifest line it enforces; a test fails when
 * a manifest gains a line no detector covers, so guidance never drifts silently.
 */

const NAV_LINK = /^\s*\[[^\]]+\]\([^)]+\)\s*$/;
const LINK_LABEL = /\[([^\]]+)\]\([^)]*\)/g;
const ACCOUNT =
  /\b(?:sign[\s-]?(?:in|out|up)|log[\s-]?(?:in|out)|my account|account settings|password)\b/i;
const MUTATION =
  /^\s*(?:delete|remove|save|submit|pay|buy|purchase|subscribe|cancel|archive|approve|reject|send|upgrade)\b/i;
const CHROME_TITLE = /\b(?:navigation|nav|menu|sidebar|top[\s-]?nav|toolbar|dialog|modal)\b/i;

type Block = Record<string, unknown>;

const SINK_KEY = /^(?:innerHTML|outerHTML|srcdoc|html|dangerouslySetInnerHTML)$/i;
const CODE_TEXT = /\beval\s*\(|\bnew\s+Function\b|<script\b|javascript:/i;
const IFRAME_TAG = /<iframe\b[^>]*>/gi;
const ORIGIN_KEY = /^(?:targetOrigin|origin|origins|allowedOrigins|frameSrc|frame-src)$/i;

/** Every key/value pair inside an embed-app block's `app` JSON, depth first. */
function appEntries(block: Block): [string, unknown][] {
  if (block.type !== 'embed-app') return [];
  const out: [string, unknown][] = [];
  const visit = (value: unknown, key: string, depth: number) => {
    if (depth > 12) return;
    out.push([key, value]);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key, depth + 1);
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Block)) visit(v, k, depth + 1);
    }
  };
  visit(block.app, 'app', 0);
  return out;
}

function asBlock(node: CatalogTreeInput): Block | undefined {
  const block = node.props?.block;
  return block && typeof block === 'object' && !Array.isArray(block) ? (block as Block) : undefined;
}

function linkLabels(text: string): string[] {
  return [...text.matchAll(LINK_LABEL)].map((match) => match[1] ?? '');
}

/** Text a block shows as links: list items and Markdown link labels. */
function blockLinks(block: Block): { items: string[]; labels: string[] } {
  const items =
    block.type === 'list' && Array.isArray(block.items)
      ? block.items.map((item) =>
          item && typeof item === 'object' ? String((item as Block).text ?? '') : ''
        )
      : [];
  const text = [block.markdown, block.body, ...items]
    .filter((v) => typeof v === 'string')
    .join('\n');
  const ctaLabels =
    block.type === 'cta' && Array.isArray(block.actions)
      ? block.actions.map((action) =>
          action && typeof action === 'object' ? String((action as Block).label ?? '') : ''
        )
      : [];
  return { items, labels: [...linkLabels(text), ...ctaLabels] };
}

/** A list of three or more items that are each only a link: a navigation menu. */
function isNavLinkList(block: Block): boolean {
  const { items } = blockLinks(block);
  return items.length >= 3 && items.every((item) => NAV_LINK.test(item));
}

export interface GuidanceDetector {
  /** The exact `dontUseWhen` line, as the manifests write it. */
  line: string;
  /** Component ids whose manifests carry the line. */
  appliesTo: (id: string) => boolean;
  /** Returns why `node` breaks the guidance, or `null`. */
  detect: (node: CatalogTreeInput) => string | null;
}

export const GUIDANCE_DETECTORS: readonly GuidanceDetector[] = Object.freeze([
  {
    line: 'Application navigation, account controls or mutations.',
    appliesTo: (id: string) =>
      id.startsWith('blocks-') || id.startsWith('charts-') || id.startsWith('media-'),
    detect(node: CatalogTreeInput) {
      const block = asBlock(node);
      if (!block) return null;
      if (isNavLinkList(block)) return 'a list of bare links is application navigation';
      if (block.type === 'cta') return 'call-to-action buttons are mutations';
      const labels = blockLinks(block).labels;
      const account = labels.find((label) => ACCOUNT.test(label));
      if (account) return `"${account}" is an account control`;
      const mutation = labels.find((label) => MUTATION.test(label));
      if (mutation) return `"${mutation}" is a mutation`;
      return null;
    },
  },
  {
    line: 'Running untrusted app JSON with innerHTML, eval, or an unsandboxed iframe.',
    appliesTo: (id: string) => id === 'blocks-embed',
    detect(node: CatalogTreeInput) {
      const block = asBlock(node);
      if (!block) return null;
      for (const [key, value] of appEntries(block)) {
        if (SINK_KEY.test(key)) return `app JSON asks for an HTML sink ("${key}")`;
        if (typeof value !== 'string') continue;
        if (CODE_TEXT.test(value)) return 'app JSON carries code to evaluate';
        const iframes = value.match(IFRAME_TAG) ?? [];
        if (iframes.some((tag) => !/\bsandbox\b/i.test(tag))) {
          return 'app JSON embeds an iframe without a sandbox';
        }
      }
      return null;
    },
  },
  {
    line: 'Relaxing iframe sandbox (especially adding allow-same-origin) or skipping CSP frame-src / postMessage origin checks.',
    appliesTo: (id: string) => id === 'blocks-embed',
    detect(node: CatalogTreeInput) {
      const block = asBlock(node);
      if (!block) return null;
      for (const [key, value] of appEntries(block)) {
        if (
          /^sandbox$/i.test(key) &&
          typeof value === 'string' &&
          /allow-same-origin/i.test(value)
        ) {
          return 'the sandbox adds allow-same-origin';
        }
        const wildcard = Array.isArray(value) ? value.includes('*') : value === '*';
        if (ORIGIN_KEY.test(key) && wildcard) return `"${key}" accepts any origin`;
      }
      return null;
    },
  },
  {
    line: 'App chrome shells (sidebar, top-nav, dialogs)',
    appliesTo: (id: string) => id.startsWith('layout-'),
    detect(node: CatalogTreeInput) {
      const title = node.props?.title;
      if (typeof title === 'string' && CHROME_TITLE.test(title)) {
        return `a layout titled "${title}" is app chrome`;
      }
      const children = node.children ?? [];
      const navs = children.filter((child) => {
        const block = asBlock(child);
        return block !== undefined && isNavLinkList(block);
      });
      if (children.length > 0 && navs.length === children.length) {
        return 'a layout that holds only link lists is a navigation shell';
      }
      return null;
    },
  },
]);

function walk(
  nodes: readonly CatalogTreeInput[],
  path: string,
  visit: (node: CatalogTreeInput, path: string) => void
): void {
  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') return;
    const here = path ? `${path}.children.${index}` : String(index);
    visit(node, here);
    if (Array.isArray(node.children)) walk(node.children, here, visit);
  });
}

/** `dontUseWhen` findings for a tree, one line per node and broken guidance. */
export function checkGuidance(tree: CatalogTreeInput): string[] {
  const issues: string[] = [];
  walk([tree], '', (node, path) => {
    const id = typeof node.id === 'string' ? node.id : '';
    const lines = goldenManifest(id)?.dontUseWhen ?? [];
    for (const detector of GUIDANCE_DETECTORS) {
      if (!detector.appliesTo(id) || !lines.includes(detector.line)) continue;
      const why = detector.detect(node);
      if (why) issues.push(`${path} ${id}: ${why} ("${detector.line}")`);
    }
  });
  return issues;
}
