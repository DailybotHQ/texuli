import { safeHref, safeImageSrcset, safeMediaSrc } from '@texuli/core/url-policy';
import { createArtifactFrame } from '../frame/frame.ts';
import { renderCatalogTreeWithLimits } from '../limits/render.ts';
import { DEFAULT_TREE_LIMITS } from '../limits/types.ts';
import type { RenderNode } from '../renderer/types.ts';
import { renderRichText } from '../richtext/parse.ts';
import type { RichTextInline } from '../richtext/types.ts';
import { HOSTILE_SAMPLES } from './samples.ts';
import type {
  HostileCorpusOptions,
  HostileCorpusReport,
  HostileRunResult,
  HostileSample,
} from './types.ts';

const SCRIPTISH =
  /javascript:|vbscript:|data:\s*text\/html|<\s*script|onerror\s*=|onload\s*=|on\w+\s*=/i;

const URL_KEYS = new Set([
  'href',
  'src',
  'url',
  'poster',
  'srcurl',
  'mediasrc',
  'mediaurl',
  'action',
  'formaction',
  'cite',
  'data',
]);

/**
 * Walk a render tree and collect string prop values (and placeholder labels).
 */
export function collectRenderStrings(nodes: readonly RenderNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly RenderNode[]) => {
    for (const node of list) {
      if (node.kind === 'placeholder') {
        out.push(node.label, node.id);
        continue;
      }
      for (const value of Object.values(node.props)) {
        if (typeof value === 'string') out.push(value);
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * True when a string looks like an executable script URL or HTML event handler.
 */
export function looksExecutable(value: string): boolean {
  return SCRIPTISH.test(value);
}

/**
 * Assert a rendered tree is inert: no script-like strings in props, no
 * class/style keys.
 */
export function assertInertRoots(roots: readonly RenderNode[]): string[] {
  const failures: string[] = [];
  const walk = (list: readonly RenderNode[], path: string) => {
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i] as RenderNode;
      const here = `${path}[${i}]`;
      if (node.kind === 'component') {
        for (const key of Object.keys(node.props)) {
          if (key === 'class' || key === 'className' || key === 'style' || key === 'styles') {
            failures.push(`${here}: forbidden prop "${key}" survived`);
          }
          const value = node.props[key];
          if (typeof value === 'string' && looksExecutable(value)) {
            failures.push(`${here}.props.${key}: executable string survived`);
          }
        }
        walk(node.children, `${here}.children`);
      }
    }
  };
  walk(roots, 'roots');
  return failures;
}

function isUrlKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    URL_KEYS.has(lower) ||
    lower.endsWith('href') ||
    lower.endsWith('src') ||
    lower.endsWith('srcset') ||
    lower.endsWith('url')
  );
}

/**
 * Host-facing harden pass: drop URL props that fail the untrusted URL policy
 * and strip any remaining executable strings. Returns a new frozen tree.
 */
export function hardenInertRoots(roots: readonly RenderNode[]): readonly RenderNode[] {
  const harden = (list: readonly RenderNode[]): RenderNode[] =>
    list.map((node) => {
      if (node.kind === 'placeholder') {
        return Object.freeze({ ...node });
      }
      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node.props)) {
        if (key === 'class' || key === 'className' || key === 'style' || key === 'styles') {
          continue;
        }
        if (typeof value === 'string' && isUrlKey(key)) {
          if (key.toLowerCase().endsWith('srcset')) {
            const srcset = safeImageSrcset(value, 'untrusted');
            if (srcset && !looksExecutable(srcset)) props[key] = srcset;
            continue;
          }
          const href = safeHref(value, 'untrusted');
          const media = safeMediaSrc(value, 'untrusted');
          const ok = href ?? media;
          if (ok && !looksExecutable(ok)) {
            props[key] = ok;
          }
          // else drop the prop
          continue;
        }
        if (typeof value === 'string' && looksExecutable(value)) {
          continue;
        }
        props[key] = value;
      }
      return Object.freeze({
        kind: 'component' as const,
        id: node.id,
        props: Object.freeze(props),
        children: Object.freeze(harden(node.children)),
        ...(node.slot !== undefined ? { slot: node.slot } : {}),
      });
    });
  return Object.freeze(harden(roots));
}

function collectLinkHrefs(inlines: readonly RichTextInline[]): string[] {
  const hrefs: string[] = [];
  const walk = (list: readonly RichTextInline[]) => {
    for (const node of list) {
      if (node.type === 'link') {
        if (node.href) hrefs.push(node.href);
        walk(node.children);
      } else if (node.type === 'strong' || node.type === 'em') {
        walk(node.children);
      }
    }
  };
  walk(inlines);
  return hrefs;
}

/**
 * Run one hostile sample through limits → renderer → artifact frame (+ richtext).
 */
export function runHostileSample(
  sample: HostileSample,
  options: HostileCorpusOptions
): HostileRunResult {
  const failures: string[] = [];
  const tier = options.tier ?? 'untrusted';
  const catalog = options.catalog;

  let limits: HostileRunResult['limits'];
  let render: HostileRunResult['render'];
  let frame: HostileRunResult['frame'];
  let richtext: HostileRunResult['richtext'];

  // Raw JSON text: parse it as an attacker's payload would be (the last
  // duplicate key wins); text that is not JSON has nothing to render.
  let tree = sample.tree;
  if (sample.text !== undefined) {
    try {
      tree = JSON.parse(sample.text);
    } catch {
      tree = undefined;
    }
  }

  if (tree !== undefined) {
    limits = renderCatalogTreeWithLimits(tree, {
      catalog,
      tier,
      limits: {
        ...DEFAULT_TREE_LIMITS,
        maxDepth: 12,
        maxNodes: 80,
        maxBytes: 8_192,
        maxBranching: 32,
      },
    });

    const rejected = !limits.withinLimits;

    if (sample.expect?.limitsReject && !rejected) {
      failures.push('expected limits to reject the tree');
    }
    if (sample.expect?.limitsReject && rejected && limits.roots.length > 0) {
      failures.push('limits rejected but still returned roots');
    }

    if (!rejected) {
      const hardened = hardenInertRoots(limits.roots);
      render = {
        roots: hardened,
        diagnostics: limits.diagnostics,
      };
      failures.push(...assertInertRoots(render.roots));

      if (sample.expect?.emptyRoots && render.roots.length > 0) {
        failures.push('expected empty roots after render');
      }
      if (sample.expect?.hasPlaceholder) {
        const has = render.roots.some((n) => n.kind === 'placeholder');
        if (!has) failures.push('expected a placeholder root');
      }

      for (const text of collectRenderStrings(render.roots)) {
        if (looksExecutable(text)) {
          failures.push(`executable string in render output: ${text.slice(0, 80)}`);
        }
      }
    } else {
      render = { roots: [], diagnostics: limits.diagnostics };
    }

    const hostileLabel =
      sample.category === 'bidi' ? `Reply \u202Eexe\u202D \u200b` : `Hostile: ${sample.title}`;

    const rawFrame = createArtifactFrame({
      label: hostileLabel,
      source: 'hostile-corpus',
      catalog,
      tier,
      tree: rejected ? [] : tree,
    });
    frame = Object.freeze({
      ...rawFrame,
      roots: hardenInertRoots(rawFrame.roots),
    });

    if (sample.expect?.scrubbedLabel || sample.category === 'bidi') {
      if (/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(frame.label)) {
        failures.push('frame label retained bidi/control characters');
      }
    }

    failures.push(...assertInertRoots(frame.roots));

    for (const intent of frame.intents) {
      const payload = JSON.stringify(intent.payload ?? {});
      if (looksExecutable(payload) || looksExecutable(intent.summary)) {
        failures.push(`intent retained executable content: ${intent.id}`);
      }
    }
  }

  // Nothing in a sample may reach the shared prototype.
  const probe = {} as Record<string, unknown>;
  if (probe.polluted !== undefined || probe.isAdmin !== undefined) {
    failures.push('Object.prototype was polluted');
  }

  if (sample.richtext !== undefined) {
    richtext = renderRichText(sample.richtext, { hrefTrust: 'untrusted' });
    for (const para of richtext.document.paragraphs) {
      for (const href of collectLinkHrefs(para.children)) {
        if (looksExecutable(href)) {
          failures.push(`richtext link href executable: ${href.slice(0, 80)}`);
        }
      }
    }
    const blob = JSON.stringify(richtext.document);
    if (/javascript:|vbscript:|data:\s*text\/html/i.test(blob)) {
      failures.push('richtext document JSON retained script URL scheme');
    }
  }

  return {
    sample,
    inert: failures.length === 0,
    failures: Object.freeze(failures),
    ...(limits ? { limits } : {}),
    ...(render ? { render } : {}),
    ...(frame ? { frame } : {}),
    ...(richtext ? { richtext } : {}),
  };
}

/** Run the full corpus (or a subset). */
export function runHostileCorpus(options: HostileCorpusOptions): HostileCorpusReport {
  const only = options.only ? new Set(options.only) : null;
  const samples = HOSTILE_SAMPLES.filter((s) => (only ? only.has(s.id) : true));
  const results = samples.map((sample) => runHostileSample(sample, options));
  const failureCount = results.filter((r) => !r.inert).length;
  return {
    results: Object.freeze(results),
    ok: failureCount === 0,
    failureCount,
  };
}
